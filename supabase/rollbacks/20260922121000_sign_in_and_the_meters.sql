-- Rollback of 20260922121000_sign_in_and_the_meters.sql (run after the 122000 rollback:
-- promo_lookup, which that one drops, calls _ip_gate).
-- Every function below is its live definition of 2026-09-22 (pg_get_functiondef). Idempotent.

CREATE OR REPLACE FUNCTION public._oracle_gate()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare ip text; k text; thr login_throttle%rowtype; n int;
begin
  begin
    ip := split_part(coalesce(current_setting('request.headers', true)::json->>'x-forwarded-for','?'), ',', 1);
  exception when others then ip := '?';
  end;
  k := 'oracle:' || left(trim(ip), 60);
  select * into thr from login_throttle where identifier = k;
  if thr.locked_until is not null and thr.locked_until > now() then return false; end if;
  n := (case when thr.locked_until is not null and thr.locked_until <= now() then 0
             else coalesce(thr.fails, 0) end) + 1;
  insert into login_throttle(identifier, fails, locked_until)
    values (k, n, case when n >= 30 then now() + interval '5 minutes' else null end)
    on conflict (identifier) do update set fails = excluded.fails, locked_until = excluded.locked_until;
  return true;
end $function$;

CREATE OR REPLACE FUNCTION public._rider_gate()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare ip text; k text; thr login_throttle%rowtype; n int;
begin
  begin
    ip := split_part(coalesce(current_setting('request.headers', true)::json->>'x-forwarded-for','?'), ',', 1);
  exception when others then ip := '?';
  end;
  k := 'rider:' || left(trim(ip), 60);
  select * into thr from login_throttle where identifier = k;
  if thr.locked_until is not null and thr.locked_until > now() then return false; end if;
  n := (case when thr.locked_until is not null and thr.locked_until <= now() then 0
             else coalesce(thr.fails, 0) end) + 1;
  insert into login_throttle(identifier, fails, locked_until)
    values (k, n, case when n >= 300 then now() + interval '10 minutes' else null end)
    on conflict (identifier) do update set fails = excluded.fails, locked_until = excluded.locked_until;
  return true;
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

CREATE OR REPLACE FUNCTION public.customer_reset(p_email text, p_phone text, p_new_pwd text)
 RETURNS TABLE(id text, name text, email text, phone text, height integer, type_preference text, created_at text, birth_date text, country text, city text, photo text, session_token text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare r customers%rowtype; tok text; s_digits text; p_digits text;
begin
  select * into r from customers where lower(customers.email)=lower(p_email) limit 1;
  if not found then return; end if;
  if r.password_hash = 'oauth:google' then return; end if;

  s_digits := regexp_replace(coalesce(r.phone,''), '\D', '', 'g');
  p_digits := regexp_replace(coalesce(p_phone,''), '\D', '', 'g');
  if length(p_digits) < 7 or length(s_digits) < 7 then return; end if;
  if not (s_digits = p_digits
          or s_digits like '%' || p_digits
          or p_digits like '%' || s_digits) then return; end if;

  if length(coalesce(p_new_pwd,'')) < 8 then return; end if;
  tok := encode(gen_random_bytes(24),'hex');
  update customers set password_hash=crypt(p_new_pwd, gen_salt('bf')), session_token=tok
   where customers.id=r.id;
  return query select r.id, r.name, r.email, r.phone, r.height, r.type_preference,
    r.created_at, r.birth_date, r.country, r.city, r.photo, tok;
end $function$;

CREATE OR REPLACE FUNCTION public.customer_update_profile(p_id text, p_token text, p_name text, p_email text, p_phone text, p_height integer, p_type_preference text, p_birth_date text, p_country text, p_city text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
begin
  if not _cust_token_ok(p_id,p_token) then return false; end if;
  update customers set
    name=p_name, email=p_email, phone=p_phone, height=p_height,
    type_preference=p_type_preference, birth_date=p_birth_date,
    country=p_country, city=p_city
  where id=p_id;
  return true;
end $function$;

CREATE OR REPLACE FUNCTION public.customer_update_profile(p_id text, p_token text, p_name text, p_email text, p_phone text, p_height integer, p_type_preference text, p_birth_date text, p_country text, p_city text, p_nationality text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
begin
  if not _cust_token_ok(p_id,p_token) then return false; end if;
  update customers set
    name=p_name, email=p_email, phone=p_phone, height=p_height,
    type_preference=p_type_preference, birth_date=p_birth_date,
    country=p_country, city=p_city, nationality=p_nationality
  where id=p_id;
  return true;
end $function$;

CREATE OR REPLACE FUNCTION public.customer_set_photo(p_id text, p_token text, p_photo text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
begin
  if not _cust_token_ok(p_id,p_token) then return false; end if;
  update customers set photo=p_photo where id=p_id;
  return true;
end $function$;

CREATE OR REPLACE FUNCTION public.customer_set_socials(p_id text, p_token text, p_socials jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare clean jsonb := '{}'::jsonb; k text; v text;
begin
  if not _cust_token_ok(p_id,p_token) then return false; end if;
  if p_socials is not null and jsonb_typeof(p_socials) = 'object' then
    for k in select jsonb_object_keys(p_socials) loop
      if k in ('instagram','x','tiktok','linkedin') then
        v := left(regexp_replace(coalesce(p_socials->>k,''), '^[[:space:]@/]+|[[:space:]/]+$', '', 'g'), 100);
        if v <> '' then clean := clean || jsonb_build_object(k, v); end if;
      end if;
    end loop;
  end if;
  update customers set socials = case when clean = '{}'::jsonb then null else clean end where id = p_id;
  return true;
end $function$;

CREATE OR REPLACE FUNCTION public.customer_push_subscribe(p_id text, p_token text, p_endpoint text, p_p256dh text, p_auth text, p_ua text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
begin
  if not _cust_token_ok(p_id, p_token) then return false; end if;
  if coalesce(p_endpoint,'') = '' or coalesce(p_p256dh,'') = '' or coalesce(p_auth,'') = '' then
    return false;
  end if;
  if (select count(*) from push_subscriptions where customer_id = p_id) > 20
     and not exists (select 1 from push_subscriptions where endpoint = p_endpoint) then
    return false;
  end if;

  insert into push_subscriptions (id, customer_id, endpoint, p256dh, auth, user_agent)
  values (encode(gen_random_bytes(12),'hex'), p_id, p_endpoint, p_p256dh, p_auth, left(coalesce(p_ua,''), 200))
  on conflict (endpoint) do update
     set customer_id = excluded.customer_id,
         p256dh      = excluded.p256dh,
         auth        = excluded.auth,
         user_agent  = excluded.user_agent,
         fail_count  = 0;
  return true;
end $function$;

drop function if exists public._ymd_ok(text);
drop function if exists public._ip_gate(text, integer, interval);
drop function if exists public._client_ip();
alter table public.login_throttle drop column if exists updated_at;
