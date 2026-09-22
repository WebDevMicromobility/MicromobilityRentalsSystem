-- ============================================================================
-- Sign-in, password reset and the per-network meters, fixed where they could be walked round.
--
--   1. The per-network meters (_oracle_gate on customer_exists / staff_email_for_phone,
--      _rider_gate on the Petromin form) keyed a caller on the LEFT-most X-Forwarded-For entry.
--      That entry is whatever the caller sends: proxies append to the header, they do not
--      replace it. A fresh made-up value per request was a fresh budget per request. They now
--      key on cf-connecting-ip, which Cloudflare sets itself and overwrites if a caller sends
--      one, and fall back to the old entry only when that header is absent. The budget is now a
--      real window (a quiet spell as long as the window starts the count again; before, calls
--      added up forever until the first lock), and rows nobody has touched for a day are pruned:
--      login_throttle only ever grew (1,144 rows on 2026-09-22). One helper, _ip_gate, does it
--      for all three budgets.
--   2. customer_login kept its lockout under the raw identifier while it matched phones on
--      their digits, so "a+9665…", "b+9665…" and "+966 5…" were one account and a thousand
--      eight-try budgets. The meter is now keyed on what the lookup matches on (the email, or
--      the phone's digits) and a second meter follows the ACCOUNT, so switching between its
--      email and its phone does not double the tries. An email sign-in no longer matches a
--      customer whose phone has no digits: '' = '' made any such account (My Account lets a
--      rider clear their phone) the answer to every digit-less email, with LIMIT 1 and no
--      order deciding which. When two accounts share a phone, the one whose password matches
--      is the one signed in, instead of whichever the scan met first.
--   3. customer_reset lost its throttle when 20260815120000 rewrote it (sql/applied/
--      prod-section8.sql had one, keyed 'reset:<email>'). It is back, 8 misses then 15 minutes,
--      and the attempt also spends from the per-network budget. A locked email answers LOCKED,
--      which the app already turns into its "too many attempts" message.
--   4. customer_update_profile (both overloads) keeps a malformed phone, height, type or birth
--      date out instead of storing it, and refuses a phone another account already holds
--      (phone_taken, as the correction form does) - only when the phone actually changes, so
--      the few accounts that already share one can still save the rest of their profile.
--   5. customer_set_photo keeps a photo only as an https link or an image data URL;
--      customer_set_socials keeps a handle only in the shape the profile form accepts.
--   6. customer_push_subscribe no longer hands a browser's subscription to whoever names its
--      endpoint: an existing row moves to a new account only when the caller also holds that
--      browser's own keys (the same browser signing in to another account). The app still
--      calls it (setupPush), so it stays.
--
-- Every function below is rebuilt from its LIVE definition (pg_get_functiondef, 2026-09-22):
-- SECURITY DEFINER and search_path are restated exactly, and CREATE OR REPLACE keeps each
-- existing function's grants; the new helpers are closed to anon and authenticated.
-- Rollback: supabase/rollbacks/20260922121000_sign_in_and_the_meters.sql
-- ============================================================================

-- ── 1. The meters ───────────────────────────────────────────────────────────
alter table public.login_throttle add column if not exists updated_at timestamptz not null default now();

-- The caller's address as the edge saw it. cf-connecting-ip cannot be forged from outside
-- (Cloudflare overwrites it); the left-most X-Forwarded-For entry can, so it is the fallback.
create or replace function public._client_ip()
 returns text
 language plpgsql
 stable
 set search_path to 'public'
as $function$
declare h json;
begin
  begin h := nullif(current_setting('request.headers', true), '')::json;
  exception when others then h := null;
  end;
  return left(coalesce(nullif(btrim(h->>'cf-connecting-ip'), ''),
                       nullif(btrim(split_part(coalesce(h->>'x-forwarded-for', ''), ',', 1)), ''),
                       '?'), 60);
end $function$;
revoke all on function public._client_ip() from public, anon, authenticated;

-- p_max calls per network inside a p_window-long spell, then locked for p_window.
create or replace function public._ip_gate(p_prefix text, p_max integer, p_window interval)
 returns boolean
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare k text := p_prefix || ':' || _client_ip(); thr login_throttle%rowtype; n int;
begin
  -- About one call in fifty sweeps rows nobody has touched for a day and that hold no lock.
  if random() < 0.02 then
    delete from login_throttle
     where updated_at < now() - interval '1 day'
       and (locked_until is null or locked_until < now());
  end if;
  select * into thr from login_throttle where identifier = k;
  if thr.locked_until is not null and thr.locked_until > now() then return false; end if;
  n := (case when thr.identifier is null
               or (thr.locked_until is not null and thr.locked_until <= now())
               or thr.updated_at < now() - p_window then 0
             else coalesce(thr.fails, 0) end) + 1;
  insert into login_throttle(identifier, fails, locked_until, updated_at)
    values (k, n, case when n >= p_max then now() + p_window else null end, now())
    on conflict (identifier) do update
      set fails = excluded.fails, locked_until = excluded.locked_until, updated_at = excluded.updated_at;
  return true;
end $function$;
revoke all on function public._ip_gate(text, integer, interval) from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public._oracle_gate()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  -- 30 lookups per network in a five-minute spell (customer_exists, staff_email_for_phone,
  -- customer_reset). A shared network is metered as one caller; that is the price of metering.
  return _ip_gate('oracle', 30, interval '5 minutes');
end $function$;
revoke all on function public._oracle_gate() from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public._rider_gate()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  -- Looser than _oracle_gate: a whole pop-up shares one venue Wi-Fi address.
  return _ip_gate('rider', 300, interval '10 minutes');
end $function$;
revoke all on function public._rider_gate() from public, anon, authenticated;

-- ── 2. Sign-in ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.customer_login(p_identifier text, p_pwd text)
 RETURNS TABLE(id text, name text, email text, phone text, height integer, type_preference text, created_at text, birth_date text, country text, city text, photo text, session_token text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare r customers%rowtype; c customers%rowtype; tok text; ident text; digits text; k text;
        thr login_throttle%rowtype; athr login_throttle%rowtype; nfails int; ok boolean := false;
        tried text[] := '{}'; aid text;
begin
  ident := lower(trim(coalesce(p_identifier, '')));
  digits := regexp_replace(coalesce(p_identifier, ''), '\D', '', 'g');
  -- The meter follows what the lookup matches on: the email as typed, or the phone's digits.
  k := case when position('@' in ident) > 0 or digits = '' then ident else 'phone:' || digits end;
  select * into thr from login_throttle where identifier = k;
  if thr.locked_until is not null and thr.locked_until > now() then
    raise exception 'LOCKED' using errcode = 'P0001';   -- too many attempts; the app shows a wait message
  end if;

  -- Columns qualified with customers.*: bare email/phone would be ambiguous
  -- against this function's RETURNS TABLE(... email, phone ...) output names.
  -- apple_email: an Apple relay address signs in to the same account as its real email.
  if position('@' in ident) > 0 then
    for c in select * from customers
              where lower(customers.email) = ident or lower(customers.apple_email) = ident
              order by (lower(customers.email) = ident) desc nulls last, customers.created_at
              limit 2 loop
      select * into athr from login_throttle where identifier = 'acct:' || c.id;
      if athr.locked_until is not null and athr.locked_until > now() then
        raise exception 'LOCKED' using errcode = 'P0001';
      end if;
      tried := tried || c.id;
      if _cust_pwd_ok(c.password_hash, p_pwd) then r := c; ok := true; exit; end if;
    end loop;
  elsif length(digits) >= 6 then
    -- A phone shared by two accounts signs in to the one whose password this is.
    for c in select * from customers
              where regexp_replace(customers.phone, '\D', '', 'g') = digits
              order by customers.created_at
              limit 5 loop
      select * into athr from login_throttle where identifier = 'acct:' || c.id;
      if athr.locked_until is not null and athr.locked_until > now() then continue; end if;
      tried := tried || c.id;
      if _cust_pwd_ok(c.password_hash, p_pwd) then r := c; ok := true; exit; end if;
    end loop;
  end if;

  if not ok then
    -- record the failure on the identifier and on every account it was tried against;
    -- a just-expired lock, or a day without failures, starts the count again
    nfails := (case when (thr.locked_until is not null and thr.locked_until <= now())
                      or thr.updated_at < now() - interval '1 day' then 0
                    else coalesce(thr.fails, 0) end) + 1;
    insert into login_throttle(identifier, fails, locked_until, updated_at)
      values (k, nfails, case when nfails >= 8 then now() + interval '15 minutes' else null end, now())
      on conflict (identifier) do update set fails = excluded.fails, locked_until = excluded.locked_until, updated_at = excluded.updated_at;
    foreach aid in array tried loop
      select * into athr from login_throttle where identifier = 'acct:' || aid;
      nfails := (case when (athr.locked_until is not null and athr.locked_until <= now())
                        or athr.updated_at < now() - interval '1 day' then 0
                      else coalesce(athr.fails, 0) end) + 1;
      insert into login_throttle(identifier, fails, locked_until, updated_at)
        values ('acct:' || aid, nfails, case when nfails >= 8 then now() + interval '15 minutes' else null end, now())
        on conflict (identifier) do update set fails = excluded.fails, locked_until = excluded.locked_until, updated_at = excluded.updated_at;
    end loop;
    return;
  end if;
  delete from login_throttle where identifier in (k, 'acct:' || r.id);   -- success clears both counters

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

-- ── 3. Password reset ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.customer_reset(p_email text, p_phone text, p_new_pwd text)
 RETURNS TABLE(id text, name text, email text, phone text, height integer, type_preference text, created_at text, birth_date text, country text, city text, photo text, session_token text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare r customers%rowtype; tok text; s_digits text; p_digits text; k text; thr login_throttle%rowtype; nfails int;
begin
  -- Keyed on the email, so a known email cannot be brute-forced on the phone check.
  k := 'reset:' || lower(trim(coalesce(p_email, '')));
  select * into thr from login_throttle where identifier = k;
  if thr.locked_until is not null and thr.locked_until > now() then
    raise exception 'LOCKED' using errcode = 'P0001';
  end if;
  -- Over the per-network budget reads as "no match", like customer_exists.
  if not _oracle_gate() then return; end if;

  select * into r from customers where lower(customers.email)=lower(p_email) limit 1;
  if found and coalesce(r.password_hash,'') not like 'oauth:%' then
    s_digits := regexp_replace(coalesce(r.phone,''), '\D', '', 'g');
    p_digits := regexp_replace(coalesce(p_phone,''), '\D', '', 'g');
    -- a short or empty phone is never proof of ownership
    if length(p_digits) >= 7 and length(s_digits) >= 7
       and (s_digits = p_digits or s_digits like '%' || p_digits or p_digits like '%' || s_digits)
       and length(coalesce(p_new_pwd,'')) >= 8 then
      delete from login_throttle where identifier = k;   -- success clears the counter
      tok := encode(gen_random_bytes(24),'hex');
      update customers set password_hash=crypt(p_new_pwd, gen_salt('bf')), session_token=tok
       where customers.id=r.id;
      return query select r.id, r.name, r.email, r.phone, r.height, r.type_preference,
        r.created_at, r.birth_date, r.country, r.city, r.photo, tok;
      return;
    end if;
  end if;

  nfails := (case when (thr.locked_until is not null and thr.locked_until <= now())
                    or thr.updated_at < now() - interval '1 day' then 0
                  else coalesce(thr.fails, 0) end) + 1;
  insert into login_throttle(identifier, fails, locked_until, updated_at)
    values (k, nfails, case when nfails >= 8 then now() + interval '15 minutes' else null end, now())
    on conflict (identifier) do update set fails = excluded.fails, locked_until = excluded.locked_until, updated_at = excluded.updated_at;
  return;
end $function$;

-- ── 4. The profile ──────────────────────────────────────────────────────────
-- A date that is a real calendar day, in the rider's past.
create or replace function public._ymd_ok(v text)
 returns boolean
 language plpgsql
 stable
 set search_path to 'public'
as $function$
begin
  if v is null or v !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then return false; end if;
  return v::date between date '1900-01-01' and (now() at time zone 'Asia/Riyadh')::date;
exception when others then
  return false;
end $function$;

CREATE OR REPLACE FUNCTION public.customer_update_profile(p_id text, p_token text, p_name text, p_email text, p_phone text, p_height integer, p_type_preference text, p_birth_date text, p_country text, p_city text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
begin
  -- The 10-argument form is the 11-argument one without a nationality: the stored one is kept.
  if not _cust_token_ok(p_id,p_token) then return false; end if;
  return customer_update_profile(p_id, p_token, p_name, p_email, p_phone, p_height, p_type_preference,
    p_birth_date, p_country, p_city, (select c.nationality from customers c where c.id = p_id));
end $function$;

CREATE OR REPLACE FUNCTION public.customer_update_profile(p_id text, p_token text, p_name text, p_email text, p_phone text, p_height integer, p_type_preference text, p_birth_date text, p_country text, p_city text, p_nationality text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare c customers%rowtype; v_phone text; v_email text;
begin
  if not _cust_token_ok(p_id,p_token) then return false; end if;
  select * into c from customers where customers.id = p_id;
  if not found then return false; end if;

  -- A phone is stored in the shape sign-up and the correction form accept, or cleared; any
  -- other text leaves the stored one. A number another account holds is refused, but only when
  -- it is a change: a few accounts already share one, and they must still save their profile.
  v_phone := nullif(btrim(coalesce(p_phone,'')), '');
  if p_phone is null then v_phone := null;
  elsif v_phone is null then v_phone := '';
  elsif v_phone !~ '^\+?[0-9]{8,15}$' then v_phone := c.phone;
  end if;
  if coalesce(v_phone,'') <> '' and v_phone is distinct from c.phone
     and exists (select 1 from customers o where o.id <> p_id
                  and regexp_replace(coalesce(o.phone,''), '\D', '', 'g') = regexp_replace(v_phone, '\D', '', 'g')) then
    raise exception 'phone_taken' using errcode = '23505';
  end if;
  v_email := nullif(btrim(coalesce(p_email,'')), '');
  if v_email is not null and v_email !~ '^[^[:space:]@<>"''()]+@[^[:space:]@<>"''()]+\.[^[:space:]@<>"''()]+$' then
    v_email := c.email;
  elsif v_email is null then
    v_email := case when p_email is null then null else '' end;
  end if;

  update customers set
    name            = coalesce(nullif(btrim(p_name), ''), c.name),
    email           = v_email,
    phone           = v_phone,
    height          = case when p_height is null then null when p_height between 100 and 250 then p_height else c.height end,
    type_preference = case when _type_ok(p_type_preference) then p_type_preference else c.type_preference end,
    birth_date      = case when nullif(p_birth_date,'') is null then null when _ymd_ok(p_birth_date) then p_birth_date else c.birth_date end,
    country         = left(p_country, 80),
    city            = left(p_city, 120),
    nationality     = left(p_nationality, 80)
  where customers.id = p_id;
  return true;
end $function$;

-- ── 5. Photo and social handles ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.customer_set_photo(p_id text, p_token text, p_photo text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
begin
  if not _cust_token_ok(p_id,p_token) then return false; end if;
  -- A photo is a Storage (or provider) https link, or the small data URL the app falls back to.
  -- Anything else - a script URL, markup, a multi-megabyte blob - is refused.
  if p_photo is not null
     and not ((length(p_photo) <= 2000 and p_photo ~ '^https://[^[:space:]"''<>`\\]+$')
              or (length(p_photo) <= 700000 and p_photo ~ '^data:image/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]+$')) then
    return false;
  end if;
  update customers set photo=p_photo where id=p_id;
  return true;
end $function$;

CREATE OR REPLACE FUNCTION public.customer_set_socials(p_id text, p_token text, p_socials jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare clean jsonb := '{}'::jsonb; k text; v text; rule text;
begin
  if not _cust_token_ok(p_id,p_token) then return false; end if;
  if p_socials is not null and jsonb_typeof(p_socials) = 'object' then
    for k in select jsonb_object_keys(p_socials) loop
      if k in ('instagram','x','tiktok','linkedin') then
        v := left(regexp_replace(coalesce(p_socials->>k,''), '^[[:space:]@/]+|[[:space:]/]+$', '', 'g'), 100);
        -- The handle rules the profile form applies (SOCIAL_NETS); a handle outside them is dropped.
        rule := case k when 'x' then '^[A-Za-z0-9_]{1,15}$'
                       when 'linkedin' then '^[A-Za-z0-9._%-]{3,100}$'
                       else '^[A-Za-z0-9._]{1,30}$' end;
        if v <> '' and v ~ rule then
          clean := clean || jsonb_build_object(k, v);
        end if;
      end if;
    end loop;
  end if;
  update customers set socials = case when clean = '{}'::jsonb then null else clean end where id = p_id;
  return true;
end $function$;

-- ── 6. Web push ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.customer_push_subscribe(p_id text, p_token text, p_endpoint text, p_p256dh text, p_auth text, p_ua text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare n int;
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
         fail_count  = 0
   -- Knowing an endpoint is not owning it. The row is refreshed for its own account, or moved
   -- to another only by the browser that holds its secret (one device, a new account).
   where push_subscriptions.customer_id = excluded.customer_id
      or push_subscriptions.auth = excluded.auth;
  get diagnostics n = row_count;
  return n > 0;
end $function$;
