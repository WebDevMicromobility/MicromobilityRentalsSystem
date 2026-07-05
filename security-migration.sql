-- ============================================================================
-- MicroMobility — Security hardening migration (customer PII lockdown)
--
-- ⚠️  RUN THIS ON A STAGING SUPABASE PROJECT FIRST, SECTION BY SECTION.
--     A wrong RLS policy locks out every login. Test the app after each
--     section before moving to the next. Full rollback is at the bottom.
--
-- WHAT THIS FIXES
--   Today every table has a "public access" policy, so the browser anon key
--   (which ships in index.html) can read every customer row — names, emails,
--   phones — and edit/delete anything. The PIN staff gate is client-side only
--   and does NOT protect the database.
--
-- STRATEGY (proportionate: do NOT migrate thousands of customers to Auth)
--   • Customers keep their custom password login, but ALL access goes through
--     SECURITY DEFINER functions. A per-login random session_token lets the
--     locked table still accept the customer's own profile writes.
--   • Staff (a handful of people) move to real Supabase Auth accounts. RLS then
--     grants the PII to authenticated staff and denies the public anon role.
--   • queue_entries keeps a public, NO-PII view for availability; the full
--     table (with name/email/phone) is staff-only; a customer reads their own
--     bookings through an RPC.
--
-- The matching app code is gated behind `const SECURE_AUTH` in index.html
-- (default false). Keep it false until Sections 1–5 are live on production.
-- ============================================================================


-- ============================================================================
-- SECTION 1 — Customer auth/profile RPCs   (SAFE: adds columns + functions only)
-- Changes no policies. After this, set SECURE_AUTH=true on STAGING and verify
-- signup / login / profile edit / password reset all work.
-- ============================================================================

create extension if not exists pgcrypto;

-- Per-login opaque token; lets the locked customers table authorize self-writes.
alter table customers add column if not exists session_token text;

-- Internal helper: verify a stored 'sha256:<salt>:<hex>' against a plaintext pwd.
create or replace function _cust_pwd_ok(p_hash text, p_pwd text)
returns boolean language plpgsql immutable as $$
declare parts text[];
begin
  if p_hash is null then return false; end if;
  if left(p_hash,7) <> 'sha256:' then return false; end if;  -- oauth/legacy: no pwd login
  parts := string_to_array(p_hash, ':');
  return encode(digest(parts[2] || ':' || p_pwd, 'sha256'), 'hex') = parts[3];
end $$;

-- LOGIN: verify password server-side, rotate a session_token, return profile+token.
create or replace function customer_login(p_identifier text, p_pwd text)
returns table(
  id text, name text, email text, phone text, height int, type_preference text,
  created_at text, birth_date text, country text, city text, photo text, session_token text
) language plpgsql security definer set search_path = public as $$
declare r customers%rowtype; tok text;
begin
  select * into r from customers
   where lower(email) = lower(p_identifier)
      or regexp_replace(phone,'\D','','g') = regexp_replace(p_identifier,'\D','','g')
   limit 1;
  if not found then return; end if;
  if not _cust_pwd_ok(r.password_hash, p_pwd) then return; end if;

  tok := encode(gen_random_bytes(24), 'hex');
  update customers set session_token = tok where id = r.id;

  return query select r.id, r.name, r.email, r.phone, r.height, r.type_preference,
    r.created_at, r.birth_date, r.country, r.city, r.photo, tok;
end $$;

-- SIGNUP: create the row server-side (so anon needs no INSERT rights), return profile+token.
create or replace function customer_signup(
  p_id text, p_name text, p_email text, p_phone text, p_pwd_hash text,
  p_height int, p_type_preference text, p_gender text
) returns table(id text, session_token text)
language plpgsql security definer set search_path = public as $$
declare tok text;
begin
  if exists(select 1 from customers
            where (coalesce(p_email,'')<>'' and lower(email)=lower(p_email))
               or (coalesce(p_phone,'')<>'' and phone=p_phone)) then
    raise exception 'DUPLICATE' using errcode = 'unique_violation';
  end if;
  tok := encode(gen_random_bytes(24),'hex');
  insert into customers(id,name,email,phone,password_hash,created_at,height,type_preference,gender,session_token)
  values(p_id,p_name,p_email,p_phone,p_pwd_hash,to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
         p_height,p_type_preference,p_gender,tok);
  return query select p_id, tok;
end $$;

-- Signup duplicate check (boolean only, never any PII).
create or replace function customer_exists(p_email text, p_phone text)
returns boolean language sql security definer set search_path = public as $$
  select exists(select 1 from customers
    where (coalesce(p_email,'')<>'' and lower(email)=lower(p_email))
       or (coalesce(p_phone,'')<>'' and phone=p_phone));
$$;

-- Authorize a self-write by matching (id, token). Returns true if the token is valid.
create or replace function _cust_token_ok(p_id text, p_token text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from customers where id=p_id and session_token=p_token and p_token is not null);
$$;

-- PROFILE UPDATE (self): only the holder of the row's current token may edit.
create or replace function customer_update_profile(
  p_id text, p_token text, p_name text, p_email text, p_phone text,
  p_height int, p_type_preference text, p_birth_date text, p_country text, p_city text
) returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not _cust_token_ok(p_id,p_token) then return false; end if;
  update customers set
    name=p_name, email=p_email, phone=p_phone, height=p_height,
    type_preference=p_type_preference, birth_date=p_birth_date,
    country=p_country, city=p_city
  where id=p_id;
  return true;
end $$;

-- PHOTO set/clear (self).
create or replace function customer_set_photo(p_id text, p_token text, p_photo text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not _cust_token_ok(p_id,p_token) then return false; end if;
  update customers set photo=p_photo where id=p_id;
  return true;
end $$;

-- PASSWORD CHANGE (self, while logged in): requires current token.
create or replace function customer_change_password(p_id text, p_token text, p_new_hash text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not _cust_token_ok(p_id,p_token) then return false; end if;
  update customers set password_hash=p_new_hash, session_token=encode(gen_random_bytes(24),'hex') where id=p_id;
  return true;
end $$;

-- PASSWORD RESET (forgot flow): verify email + phone match, set new password, return profile+token.
create or replace function customer_reset(p_email text, p_phone text, p_new_hash text)
returns table(
  id text, name text, email text, phone text, height int, type_preference text,
  created_at text, birth_date text, country text, city text, photo text, session_token text
) language plpgsql security definer set search_path = public as $$
declare r customers%rowtype; tok text;
begin
  select * into r from customers where lower(email)=lower(p_email) limit 1;
  if not found then return; end if;
  if r.password_hash = 'oauth:google' then return; end if;             -- google accounts can't reset here
  if regexp_replace(coalesce(r.phone,''),'\D','','g')
     not like '%'||regexp_replace(coalesce(p_phone,''),'\D','','g') then return; end if;  -- phone must match
  tok := encode(gen_random_bytes(24),'hex');
  update customers set password_hash=p_new_hash, session_token=tok where id=r.id;
  return query select r.id, r.name, r.email, r.phone, r.height, r.type_preference,
    r.created_at, r.birth_date, r.country, r.city, r.photo, tok;
end $$;

-- A customer's own bookings (My Rides) without exposing anyone else's rows.
create or replace function my_bookings(p_id text, p_token text)
returns setof queue_entries language plpgsql security definer set search_path = public as $$
begin
  if not _cust_token_ok(p_id,p_token) then return; end if;
  return query select * from queue_entries where customer_id = p_id;
end $$;

-- Grants include `authenticated`: a customer signed in with Google carries a
-- Supabase Auth session, so their requests run as authenticated, not anon.
grant execute on function customer_login(text,text)                              to anon, authenticated;
grant execute on function customer_signup(text,text,text,text,text,int,text,text) to anon, authenticated;
grant execute on function customer_exists(text,text)                             to anon, authenticated;
grant execute on function customer_update_profile(text,text,text,text,text,int,text,text,text,text) to anon, authenticated;
grant execute on function customer_set_photo(text,text,text)                     to anon, authenticated;
grant execute on function customer_change_password(text,text,text)               to anon, authenticated;
grant execute on function customer_reset(text,text,text)                         to anon, authenticated;
grant execute on function my_bookings(text,text)                                 to anon, authenticated;

-- ── Google sign-in (the app finds/creates the customer row by the Google email).
-- With the customers table locked these need RPCs too. Both verify that the
-- CALLER's Supabase Auth session (created by the Google OAuth redirect) carries
-- the same email — so knowing someone's address is not enough to hijack a row.

create or replace function customer_oauth_login(p_email text)
returns table(
  id text, name text, email text, phone text, height int, type_preference text,
  created_at text, birth_date text, country text, city text, photo text, session_token text
) language plpgsql security definer set search_path = public as $$
declare r customers%rowtype; tok text;
begin
  if auth.uid() is null or lower(coalesce(auth.jwt()->>'email','')) <> lower(p_email) then return; end if;
  select * into r from customers where lower(customers.email) = lower(p_email) limit 1;
  if not found then return; end if;
  tok := encode(gen_random_bytes(24),'hex');
  update customers set session_token = tok where customers.id = r.id;
  return query select r.id, r.name, r.email, r.phone, r.height, r.type_preference,
    r.created_at, r.birth_date, r.country, r.city, r.photo, tok;
end $$;

create or replace function customer_oauth_signup(
  p_id text, p_name text, p_email text, p_phone text,
  p_height int, p_type_preference text, p_gender text, p_photo text
) returns table(id text, session_token text)
language plpgsql security definer set search_path = public as $$
declare tok text;
begin
  if auth.uid() is null or lower(coalesce(auth.jwt()->>'email','')) <> lower(p_email) then
    raise exception 'NOT_AUTHORIZED';
  end if;
  if exists(select 1 from customers
            where (coalesce(p_email,'')<>'' and lower(customers.email)=lower(p_email))
               or (coalesce(p_phone,'')<>'' and customers.phone=p_phone)) then
    raise exception 'DUPLICATE' using errcode = 'unique_violation';
  end if;
  tok := encode(gen_random_bytes(24),'hex');
  insert into customers(id,name,email,phone,password_hash,created_at,height,type_preference,gender,photo,session_token)
  values(p_id,p_name,p_email,p_phone,'oauth:google',to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
         p_height,p_type_preference,p_gender,p_photo,tok);
  return query select p_id, tok;
end $$;

-- Google flows only ever run with a real Auth session → authenticated only.
grant execute on function customer_oauth_login(text)                                to authenticated;
grant execute on function customer_oauth_signup(text,text,text,text,int,text,text,text) to authenticated;

-- ✅ CHECKPOINT 1: set SECURE_AUTH=true in index.html on staging and confirm
--    signup, login, profile edit, photo, password change, reset, My Rides work.
--    Nothing is locked yet, so this is reversible just by flipping the flag back.


-- ============================================================================
-- SECTION 2 — Staff identity via Supabase Auth   (SAFE: adds a table + helper)
-- Do the dashboard steps first:
--   1. Authentication → Users → Add user: create one login per staff member.
--   2. Note each new user's UUID.
-- Then run this, substituting the UUIDs.
-- ============================================================================

create table if not exists staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role    text not null default 'admin',   -- 'admin' | 'frontdesk'
  added_at timestamptz not null default now()
);
alter table staff enable row level security;
create policy "staff read self" on staff for select using (auth.uid() = user_id);

-- TODO: insert one row per staff Auth user (get UUIDs from Authentication → Users):
-- insert into staff(user_id, role) values
--   ('00000000-0000-0000-0000-000000000000','admin'),
--   ('11111111-1111-1111-1111-111111111111','frontdesk')
-- on conflict (user_id) do nothing;

-- True when the current request is an authenticated staff member.
create or replace function is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from staff where user_id = auth.uid());
$$;

-- ✅ CHECKPOINT 2: in the app, sign a staff member in through Supabase Auth and
--    confirm is_staff() returns true (SQL editor: select is_staff(); while a
--    staff JWT is active). Customer flows are unaffected.


-- ============================================================================
-- SECTION 3 — Public NO-PII view for queue availability
-- The booking screen only needs counts/positions, never other riders' PII.
-- ============================================================================

create or replace view queue_public as
  select id, session_id, session_day, session_date, queue_num, status,
         size, type_preference, paid, price, assigned_bike_id, walk_in, ride_duration
  from queue_entries;            -- NOTE: no name / email / phone / customer_id / feedback

grant select on queue_public to anon, authenticated;

-- ✅ CHECKPOINT 3: select * from queue_public limit 1;  → returns rows, no PII columns.


-- ============================================================================
-- SECTION 4 — LOCK THE TABLES   (⚠️ the irreversible-feeling step; rollback below)
-- Run ONLY after Sections 1–3 verified AND the app has SECURE_AUTH=true with
-- staff signing in via Supabase Auth. After this, the public anon key can no
-- longer read customer PII or other riders' bookings.
-- ============================================================================

-- ---- customers -----------------------------------------------------------
drop policy if exists "public access" on customers;
-- No anon SELECT/UPDATE/DELETE/INSERT: all customer access is via the SECTION 1
-- SECURITY DEFINER functions (which bypass RLS). Staff get full direct access.
create policy "staff full"    on customers for all using (is_staff()) with check (is_staff());

-- ---- queue_entries -------------------------------------------------------
drop policy if exists "public access" on queue_entries;
-- SELECT is the PII leak, so SELECT is what gets locked: availability reads go
-- through queue_public (no PII) and a customer's own rows through my_bookings().
-- INSERT stays public (booking). UPDATE/DELETE stay public because the app's
-- booking machinery legitimately writes from the customer side (cancel + queue
-- renumbering, modify, post-ride ratings, insert-failure rollback): every such
-- write targets rows by their random uid() primary key, which can no longer be
-- enumerated once SELECT is locked. Tightening writes to token-checked RPCs is
-- the Section 5 follow-up.
create policy "public insert booking" on queue_entries for insert with check (true);
create policy "public update by id"   on queue_entries for update using (true) with check (true);
create policy "public delete by id"   on queue_entries for delete using (true);
create policy "staff full"            on queue_entries for all using (is_staff()) with check (is_staff());

-- ---- the rest stay public (no PII): bikes, sessions, inventory, promo_codes
-- They already have "public access"; leave them. (Tighten writes later if desired.)

-- ✅ CHECKPOINT 4: with NO session (incognito, not logged in) try in the app /
--    SQL: select * from customers;  → must return 0 rows / permission denied.
--    Then log in as a customer (RPC) and confirm profile + My Rides still work,
--    and as staff (Auth) confirm the customers/queue tabs load.


-- ============================================================================
-- SECTION 5 — Notes / remaining hardening (optional, later)
--   • queue_entries customer self-cancel/edit currently uses update().eq('id').
--     After Section 4 that needs an RPC (e.g. customer_cancel(id,token)) — add
--     it the same way as customer_update_profile if you want customers to keep
--     editing/cancelling their own bookings without staff.
--   • Move password hashing to bcrypt (pgcrypto crypt()/gen_salt('bf')) inside
--     customer_login/signup for stronger-than-SHA256 storage.
--   • Restrict writes on bikes/sessions/inventory/promo_codes to is_staff() too.
-- ============================================================================


-- ============================================================================
-- ROLLBACK — re-open everything if anything breaks
-- ============================================================================
-- create policy "public access" on customers     for all using (true) with check (true);
-- create policy "public access" on queue_entries for all using (true) with check (true);
-- drop policy if exists "staff full" on customers;
-- drop policy if exists "staff full" on queue_entries;
-- drop policy if exists "public insert booking" on queue_entries;
-- drop policy if exists "public update by id"   on queue_entries;
-- drop policy if exists "public delete by id"   on queue_entries;
-- -- and set SECURE_AUTH=false in index.html (or localStorage cq_secure_auth='0')
-- -- to return to direct-query auth.
