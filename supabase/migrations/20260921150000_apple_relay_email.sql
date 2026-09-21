-- ============================================================================
-- Apple "Hide My Email" accounts get a real email, and keep Apple sign-in.
--
-- 120 accounts (2026-09-21) signed up with Apple and hid their email, so their only address
-- is a private relay (…@privaterelay.appleid.com), and none of them has a password. Each is
-- asked, at their next event pick, for the email they actually use plus a password. That
-- email becomes the account's main email everywhere; the relay address is kept beside it
-- for Continue with Apple. The rider can then sign in with the Apple button, or with either
-- address and the password.
--
--  1. customers.apple_email — the account's Apple relay address. Unique, and never equal
--     to another account's main email (and the reverse). A trigger fills it whenever a
--     relay address is the main email, and keeps it when the main email moves off one, so
--     every write path (the check-up, My Account, the staff editor) keeps Apple sign-in.
--     Backfilled for the existing relay accounts.
--  2. customer_oauth_login and customer_login also match apple_email, so the relay address
--     still finds the account after the main email has changed.
--  3. customer_exists answers for apple_email too (sign-up must not reuse one).
--  4. customer_apple_signup: the Apple sign-up for a hidden email. Takes the real email and a
--     password in the same step and creates the account with both addresses.
--  5. customer_fix_fields / customer_fix_save (20260921140000) learn two asks that no one
--     stores: 'email' while the main email is a relay address, and 'password' while an
--     account with an Apple address has no password. Neither is written to fix_fields.
--     The new main email may not be a relay address.
--
-- Bookings keep the address they were made with (rewriting them from a customer's session
-- would re-run the price, capacity and members triggers). Staff screens show the account's
-- current email for a booking that still carries a relay address.
--
-- Headers of the three re-created login functions are copied from production (2026-09-21),
-- not from prosrc — see supabase/checks/security-attributes.sql.
--
-- Rollback:
--   drop function if exists public.customer_apple_signup(text,text,text,text,int,text,text,text,text,text);
--   drop trigger if exists customers_email_alias on public.customers;
--   drop function if exists public._customer_email_alias();
--   -- customer_oauth_login / customer_login / customer_exists: re-run their previous definitions
--   -- customer_fix_fields / customer_fix_save: re-run 20260921140000
--   alter table public.customers drop column if exists apple_email;
-- Idempotent: safe to re-run.
-- ============================================================================

alter table public.customers add column if not exists apple_email text;
create unique index if not exists customers_apple_email_lower_uniq
  on public.customers (lower(btrim(apple_email))) where coalesce(btrim(apple_email),'') <> '';

-- 1. Keep the relay address, and keep the two address columns from colliding across accounts.
create or replace function public._customer_email_alias()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare e text; a text;
begin
  e := lower(btrim(coalesce(new.email,'')));
  if e like '%@privaterelay.appleid.com' and coalesce(btrim(new.apple_email),'') = '' then
    new.apple_email := e;
  end if;
  if tg_op = 'UPDATE' and coalesce(btrim(new.apple_email),'') = ''
     and lower(btrim(coalesce(old.email,''))) like '%@privaterelay.appleid.com' then
    new.apple_email := lower(btrim(old.email));   -- the main email moved off the relay address
  end if;
  a := lower(btrim(coalesce(new.apple_email,'')));
  if e <> '' and exists(select 1 from customers c where c.id <> new.id and lower(btrim(c.apple_email)) = e) then
    raise exception 'email_taken' using errcode = '23505';
  end if;
  if a <> '' and exists(select 1 from customers c where c.id <> new.id and lower(btrim(c.email)) = a) then
    raise exception 'email_taken' using errcode = '23505';
  end if;
  return new;
end $$;
revoke execute on function public._customer_email_alias() from public, anon, authenticated;
drop trigger if exists customers_email_alias on public.customers;
create trigger customers_email_alias before insert or update of email, apple_email on public.customers
  for each row execute function public._customer_email_alias();

update public.customers set apple_email = lower(btrim(email))
 where lower(btrim(email)) like '%@privaterelay.appleid.com' and coalesce(btrim(apple_email),'') = '';

-- 2. Sign-in by Apple (the relay address comes back in the JWT) or by email + password.
CREATE OR REPLACE FUNCTION public.customer_oauth_login(p_email text)
 RETURNS TABLE(id text, name text, email text, phone text, height integer, type_preference text, created_at text, birth_date text, country text, city text, photo text, session_token text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare r customers%rowtype; tok text;
begin
  if auth.uid() is null or lower(coalesce(auth.jwt()->>'email','')) <> lower(p_email) then return; end if;
  -- The main email first; an Apple relay address kept beside a real email second.
  select * into r from customers
   where lower(customers.email) = lower(p_email) or lower(customers.apple_email) = lower(p_email)
   order by coalesce(lower(customers.email) = lower(p_email), false) desc
   limit 1;
  if not found then return; end if;
  tok := coalesce(nullif(r.session_token,''), encode(gen_random_bytes(24),'hex'));
  update customers set session_token = tok where customers.id = r.id;
  return query select r.id, r.name, r.email, r.phone, r.height, r.type_preference,
    r.created_at, r.birth_date, r.country, r.city, r.photo, tok;
end $function$;

CREATE OR REPLACE FUNCTION public.customer_login(p_identifier text, p_pwd text)
 RETURNS TABLE(id text, name text, email text, phone text, height integer, type_preference text, created_at text, birth_date text, country text, city text, photo text, session_token text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare r customers%rowtype; tok text; ident text; thr login_throttle%rowtype; nfails int;
begin
  ident := lower(trim(p_identifier));
  select * into thr from login_throttle where identifier = ident;
  if thr.locked_until is not null and thr.locked_until > now() then
    raise exception 'LOCKED' using errcode = 'P0001';   -- too many attempts; the app shows a wait message
  end if;
  -- Columns qualified with customers.*: bare email/phone would be ambiguous
  -- against this function's RETURNS TABLE(... email, phone ...) output names.
  -- apple_email: an Apple relay address signs in to the same account as its real email.
  select * into r from customers
   where lower(customers.email) = ident
      or lower(customers.apple_email) = ident
      or regexp_replace(customers.phone,'\D','','g') = regexp_replace(p_identifier,'\D','','g')
   limit 1;
  if not found or not _cust_pwd_ok(r.password_hash, p_pwd) then
    -- record the failure; a just-expired lock resets the counter first
    nfails := (case when thr.locked_until is not null and thr.locked_until <= now() then 0 else coalesce(thr.fails,0) end) + 1;
    insert into login_throttle(identifier, fails, locked_until)
      values (ident, nfails, case when nfails >= 8 then now() + interval '15 minutes' else null end)
      on conflict (identifier) do update set fails = excluded.fails, locked_until = excluded.locked_until;
    return;
  end if;
  delete from login_throttle where identifier = ident;   -- success clears the counter

  -- Reuse the live token so other signed-in devices stay valid; mint only when absent.
  tok := coalesce(nullif(r.session_token,''), encode(gen_random_bytes(24), 'hex'));
  -- Transparent upgrade: re-hash a legacy sha256 password to bcrypt on login.
  if left(r.password_hash, 7) = 'sha256:' then
    update customers set session_token = tok, password_hash = crypt(p_pwd, gen_salt('bf')) where customers.id = r.id;
  else
    update customers set session_token = tok where customers.id = r.id; -- qualified: id is also a RETURNS TABLE output name
  end if;
  return query select r.id, r.name, r.email, r.phone, r.height, r.type_preference,
    r.created_at, r.birth_date, r.country, r.city, r.photo, tok;
end $function$;

-- 3. Sign-up must not reuse an address that already signs in somewhere.
CREATE OR REPLACE FUNCTION public.customer_exists(p_email text, p_phone text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  -- Over budget answers "no account", not an error: the reply's SHAPE must not
  -- become the new oracle.
  if not _oracle_gate() then return false; end if;
  return exists(select 1 from customers
    where (coalesce(p_email,'')<>'' and (lower(email)=lower(p_email) or lower(apple_email)=lower(p_email)))
       or (coalesce(p_phone,'')<>'' and phone=p_phone));
end $function$;

-- 4. Apple sign-up with a hidden email: the real email and a password in the same step.
create or replace function public.customer_apple_signup(
  p_id text, p_name text, p_email text, p_phone text, p_height int, p_type_preference text,
  p_gender text, p_photo text, p_contact_email text, p_pwd text
) returns table(id text, session_token text)
language plpgsql security definer set search_path = public, extensions as $$
declare tok text; relay text; ce text;
begin
  relay := lower(btrim(coalesce(p_email,'')));
  ce := lower(btrim(coalesce(p_contact_email,'')));
  if auth.uid() is null or lower(coalesce(auth.jwt()->>'email','')) <> relay then
    raise exception 'NOT_AUTHORIZED';
  end if;
  if relay not like '%@privaterelay.appleid.com' then raise exception 'NOT_RELAY'; end if;
  if ce !~ '^[^[:space:]@<>"''()]+@[^[:space:]@<>"''()]+\.[^[:space:]@<>"''()]+$'
     or ce like '%@privaterelay.appleid.com' then
    raise exception 'BAD_EMAIL';
  end if;
  if char_length(coalesce(p_pwd,'')) < 8 then raise exception 'BAD_PASSWORD'; end if;
  if exists(select 1 from customers c
             where lower(btrim(c.email)) in (ce, relay) or lower(btrim(c.apple_email)) in (ce, relay)) then
    raise exception 'email_taken' using errcode = '23505';
  end if;
  if coalesce(p_phone,'') <> '' and exists(select 1 from customers c where c.phone = p_phone) then
    raise exception 'DUPLICATE' using errcode = 'unique_violation';
  end if;
  tok := encode(gen_random_bytes(24),'hex');
  insert into customers(id,name,email,apple_email,phone,password_hash,created_at,height,type_preference,gender,photo,session_token)
  values(p_id,p_name,ce,relay,p_phone,crypt(p_pwd, gen_salt('bf')),
         to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
         p_height,p_type_preference,p_gender,p_photo,tok);
  return query select p_id, tok;
end $$;
revoke execute on function public.customer_apple_signup(text,text,text,text,int,text,text,text,text,text) from public;
grant  execute on function public.customer_apple_signup(text,text,text,text,int,text,text,text,text,text) to anon, authenticated;

-- 5. The check-up: two asks nobody stores, on top of what staff flagged.
create or replace function public.customer_fix_fields(p_id text, p_token text)
returns text[] language plpgsql stable security definer set search_path = public, extensions as $$
declare c customers%rowtype; f text[];
begin
  if not _cust_token_ok(p_id,p_token) then return null; end if;
  select * into c from customers where customers.id = p_id;
  if not found then return null; end if;
  f := coalesce(c.fix_fields,'{}'::text[]);
  if lower(coalesce(c.email,'')) like '%@privaterelay.appleid.com' and not ('email' = any(f)) then
    f := f || 'email'::text;
  end if;
  if coalesce(btrim(c.apple_email),'') <> '' and coalesce(c.password_hash,'') like 'oauth:%' then
    f := f || 'password'::text;
  end if;
  return f;
end $$;
revoke execute on function public.customer_fix_fields(text,text) from public;
grant  execute on function public.customer_fix_fields(text,text) to anon, authenticated;

create or replace function public.customer_fix_save(p_id text, p_token text, p_values jsonb)
returns text[] language plpgsql security definer set search_path = public, extensions as $$
declare
  c      customers%rowtype;
  stored text[];
  flags  text[];
  done   text[] := '{}';
  k text;
  v text;
begin
  if not _cust_token_ok(p_id,p_token) then return null; end if;
  select * into c from customers where customers.id = p_id for update;
  if not found then return null; end if;
  stored := coalesce(c.fix_fields,'{}'::text[]);
  flags := stored;
  if lower(coalesce(c.email,'')) like '%@privaterelay.appleid.com' and not ('email' = any(flags)) then
    flags := flags || 'email'::text;
  end if;
  if coalesce(btrim(c.apple_email),'') <> '' and coalesce(c.password_hash,'') like 'oauth:%' then
    flags := flags || 'password'::text;
  end if;
  if p_values is null or jsonb_typeof(p_values) <> 'object' then return flags; end if;

  -- Country and city are answered together: a city belongs to its country, so a flag on
  -- either takes both answers and a new country never keeps the old one's city. The city
  -- may be empty for a country the app has no city list for.
  if 'country' = any(flags) or 'city' = any(flags) then
    v := nullif(btrim(coalesce(p_values->>'country','')),'');
    if v is not null then
      update customers set country = left(v,80),
        city = left(nullif(btrim(coalesce(p_values->>'city','')),''),120)
      where id = p_id;
      done := done || array['country','city'];
    end if;
  end if;

  foreach k in array flags loop
    if not (p_values ? k) then continue; end if;
    if k = 'password' then
      v := p_values->>'password';                                -- a password is taken as typed, never trimmed
      if char_length(coalesce(v,'')) < 8 then continue; end if;
      update customers set password_hash = crypt(v, gen_salt('bf')) where id = p_id;
      done := done || k;
      continue;
    end if;
    v := nullif(btrim(coalesce(p_values->>k,'')),'');
    if v is null then continue; end if;                       -- an empty answer fixes nothing
    case k
      when 'name' then
        if char_length(v) < 2 then continue; end if;
        update customers set name = left(v,120) where id = p_id;
      when 'email' then
        v := lower(v);
        if v !~ '^[^[:space:]@<>"''()]+@[^[:space:]@<>"''()]+\.[^[:space:]@<>"''()]+$' then continue; end if;
        if v like '%@privaterelay.appleid.com' then continue; end if;   -- the main email is a real one
        if exists(select 1 from customers o where o.id <> p_id
                    and (lower(btrim(o.email)) = v or lower(btrim(o.apple_email)) = v)) then
          raise exception 'email_taken' using errcode = '23505';
        end if;
        update customers set email = v where id = p_id;        -- the trigger keeps the relay address
      when 'phone' then
        if v !~ '^\+?[0-9]{8,15}$' then continue; end if;
        if exists(select 1 from customers o where o.phone = v and o.id <> p_id) then
          raise exception 'phone_taken' using errcode = '23505';
        end if;
        update customers set phone = v where id = p_id;
      when 'birth_date' then
        if v !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then continue; end if;
        update customers set birth_date = v where id = p_id;
      when 'gender' then
        if v not in ('male','female') then continue; end if;
        update customers set gender = v where id = p_id;
      when 'nationality' then update customers set nationality = left(v,80) where id = p_id;
      when 'country', 'city' then continue;                      -- answered above, as a pair
      when 'height' then
        if v !~ '^[0-9]{3}$' or v::int not between 100 and 250 then continue; end if;
        update customers set height = v::int where id = p_id;
      when 'photo' then
        if v !~ '^https://' then continue; end if;                -- Storage URLs only, never a data URL
        update customers set photo = v where id = p_id;
      else continue;
    end case;
    done := done || k;
  end loop;

  -- Only staff flags are stored; the two computed asks disappear once they are answered.
  stored := array(select f from unnest(stored) f where f <> all(done));
  update customers set fix_fields = case when cardinality(stored) = 0 then null else stored end where id = p_id;
  return array(select f from unnest(flags) f where f <> all(done));
end $$;
revoke execute on function public.customer_fix_save(text,text,jsonb) from public;
grant  execute on function public.customer_fix_save(text,text,jsonb) to anon, authenticated;

-- Verify:
--   select count(*) from customers where lower(email) like '%@privaterelay.appleid.com' and apple_email is null;  -- expect 0
--   select proname, prosecdef from pg_proc where proname in
--     ('customer_oauth_login','customer_login','customer_exists','customer_apple_signup',
--      'customer_fix_fields','customer_fix_save','_customer_email_alias');                   -- expect all true
-- Then run supabase/checks/security-attributes.sql (expect no rows).
