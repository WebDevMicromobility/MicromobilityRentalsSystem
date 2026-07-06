-- PRODUCTION pre-setup: Sections 1-3 (SAFE — adds functions/table/view, locks nothing).
-- Includes the customer auth RPCs, staff table + is_staff(), queue_public view,
-- and the customer self-write RPCs. The live app keeps working after this.
-- Safe to re-run (create-or-replace / if-not-exists).

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
) language plpgsql security definer set search_path = public, extensions as $$
declare r customers%rowtype; tok text;
begin
  -- Columns qualified with customers.*: bare email/phone would be ambiguous
  -- against this function's RETURNS TABLE(... email, phone ...) output names.
  select * into r from customers
   where lower(customers.email) = lower(p_identifier)
      or regexp_replace(customers.phone,'\D','','g') = regexp_replace(p_identifier,'\D','','g')
   limit 1;
  if not found then return; end if;
  if not _cust_pwd_ok(r.password_hash, p_pwd) then return; end if;

  tok := encode(gen_random_bytes(24), 'hex');
  update customers set session_token = tok where customers.id = r.id; -- qualified: id is also a RETURNS TABLE output name
  return query select r.id, r.name, r.email, r.phone, r.height, r.type_preference,
    r.created_at, r.birth_date, r.country, r.city, r.photo, tok;
end $$;

-- SIGNUP: create the row server-side (so anon needs no INSERT rights), return profile+token.
create or replace function customer_signup(
  p_id text, p_name text, p_email text, p_phone text, p_pwd_hash text,
  p_height int, p_type_preference text, p_gender text
) returns table(id text, session_token text)
language plpgsql security definer set search_path = public, extensions as $$
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
returns boolean language sql security definer set search_path = public, extensions as $$
  select exists(select 1 from customers
    where (coalesce(p_email,'')<>'' and lower(email)=lower(p_email))
       or (coalesce(p_phone,'')<>'' and phone=p_phone));
$$;

-- Authorize a self-write by matching (id, token). Returns true if the token is valid.
create or replace function _cust_token_ok(p_id text, p_token text)
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select exists(select 1 from customers where id=p_id and session_token=p_token and p_token is not null);
$$;

-- PROFILE UPDATE (self): only the holder of the row's current token may edit.
create or replace function customer_update_profile(
  p_id text, p_token text, p_name text, p_email text, p_phone text,
  p_height int, p_type_preference text, p_birth_date text, p_country text, p_city text
) returns boolean language plpgsql security definer set search_path = public, extensions as $$
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
returns boolean language plpgsql security definer set search_path = public, extensions as $$
begin
  if not _cust_token_ok(p_id,p_token) then return false; end if;
  update customers set photo=p_photo where id=p_id;
  return true;
end $$;

-- PASSWORD CHANGE (self, while logged in): requires current token.
create or replace function customer_change_password(p_id text, p_token text, p_new_hash text)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
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
) language plpgsql security definer set search_path = public, extensions as $$
declare r customers%rowtype; tok text;
begin
  select * into r from customers where lower(customers.email)=lower(p_email) limit 1; -- qualified: avoids ambiguity with the RETURNS TABLE email column
  if not found then return; end if;
  if r.password_hash = 'oauth:google' then return; end if;             -- google accounts can't reset here
  if regexp_replace(coalesce(r.phone,''),'\D','','g')
     not like '%'||regexp_replace(coalesce(p_phone,''),'\D','','g') then return; end if;  -- phone must match
  tok := encode(gen_random_bytes(24),'hex');
  update customers set password_hash=p_new_hash, session_token=tok where customers.id=r.id; -- qualified: id is also a RETURNS TABLE output name
  return query select r.id, r.name, r.email, r.phone, r.height, r.type_preference,
    r.created_at, r.birth_date, r.country, r.city, r.photo, tok;
end $$;

-- A customer's own bookings (My Rides) without exposing anyone else's rows.
create or replace function my_bookings(p_id text, p_token text)
returns setof queue_entries language plpgsql security definer set search_path = public, extensions as $$
begin
  if not _cust_token_ok(p_id,p_token) then return; end if;
  return query select * from queue_entries where customer_id = p_id;
end $$;

-- CUSTOMER WRITES on their OWN booking. Once Section 4 locks queue_entries SELECT,
-- the app can no longer UPDATE via the REST API (PostgREST can't write rows RLS
-- hides), so self-cancel / modify / rate route through these token-checked RPCs.
-- Whitelisted patch: only fields a customer may change, only on a row they own,
-- and `status` only to safe values (never 'active'/'done'/'noshow').
create or replace function customer_booking_update(p_id text, p_token text, p_entry_id text, p_patch jsonb)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
begin
  if not _cust_token_ok(p_id, p_token) then return false; end if;
  if not exists(select 1 from queue_entries where id = p_entry_id and customer_id = p_id) then return false; end if;
  if (p_patch ? 'status') and (p_patch->>'status') not in ('cancelled','waiting','waitlist') then return false; end if;
  update queue_entries q set
    type_preference  = coalesce(p_patch->>'type_preference', q.type_preference),
    price            = coalesce((p_patch->>'price')::numeric, q.price),
    size             = coalesce(p_patch->>'size', q.size),
    height           = coalesce((p_patch->>'height')::int, q.height),
    status           = coalesce(p_patch->>'status', q.status),
    queue_num        = coalesce((p_patch->>'queue_num')::int, q.queue_num),
    promo_code       = coalesce(p_patch->>'promo_code', q.promo_code),
    rating_bike      = case when p_patch ? 'rating_bike' then nullif(p_patch->>'rating_bike','')::int else q.rating_bike end,
    rating_exp       = case when p_patch ? 'rating_exp'  then nullif(p_patch->>'rating_exp','')::int  else q.rating_exp end,
    feedback         = case when p_patch ? 'feedback'    then p_patch->>'feedback'                    else q.feedback end,
    addons           = case when p_patch ? 'addons'      then p_patch->>'addons'                      else q.addons end,
    assigned_bike_id = case when p_patch ? 'assigned_bike_id' then null                              else q.assigned_bike_id end
  where q.id = p_entry_id;
  return true;
end $$;

-- Close the queue-number gap a customer's cancellation leaves (shifts the riders
-- behind it down one). Touches other rows, so it is gated by a valid customer token.
create or replace function customer_shiftdown(p_id text, p_token text, p_session_id text, p_from_num int)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
begin
  if not _cust_token_ok(p_id, p_token) then return false; end if;
  update queue_entries set queue_num = queue_num - 1
   where session_id = p_session_id and status = 'waiting' and queue_num > p_from_num;
  return true;
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
grant execute on function customer_booking_update(text,text,text,jsonb)           to anon, authenticated;
grant execute on function customer_shiftdown(text,text,text,int)                  to anon, authenticated;

-- ── Google sign-in (the app finds/creates the customer row by the Google email).
-- With the customers table locked these need RPCs too. Both verify that the
-- CALLER's Supabase Auth session (created by the Google OAuth redirect) carries
-- the same email — so knowing someone's address is not enough to hijack a row.

create or replace function customer_oauth_login(p_email text)
returns table(
  id text, name text, email text, phone text, height int, type_preference text,
  created_at text, birth_date text, country text, city text, photo text, session_token text
) language plpgsql security definer set search_path = public, extensions as $$
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
language plpgsql security definer set search_path = public, extensions as $$
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
returns boolean language sql stable security definer set search_path = public, extensions as $$
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
