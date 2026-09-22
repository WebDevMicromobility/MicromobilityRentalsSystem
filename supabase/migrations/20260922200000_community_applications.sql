-- ============================================================================
-- Community membership applications (micromobility.sa/community/registration).
--
-- APPLIED AND VERIFIED 2026-09-22 (Supabase MCP apply_migration after a rollback-only dry run of
-- every path; history row renamed to this file's version; security-attributes check clean).
--
-- A rider asks to join the riding community on a public form. Staff read the application
-- in Community > Applications and approve or reject it. Approving creates the rider's
-- account from what they gave, with a temporary password staff send them, and grants the
-- Community tag (slug 'saturday'); an applicant who already has an account keeps it and is
-- only tagged. The rider must choose their own password the first time they sign in with
-- the temporary one.
--
--  1. customers.profession - asked on the form, staff-only like the social handles.
--  2. customers.must_change_pwd - true while the password is one staff handed out. Any
--     other password change clears it (trigger _customers_pwd_changed), so a rider who uses
--     "Forgot password" instead is not asked again.
--  3. community_applications - one row per application. No anon access at all; staff read
--     and write under is_staff(). The form writes only through community_apply.
--  4. community_apply(p jsonb) - anon, throttled per network (_ip_gate 'community', 20 in
--     10 minutes). Every field is required and checked here again (the form checks first).
--     A second application while one is still pending, with the same email or phone,
--     updates that one (submissions + 1) instead of adding a duplicate.
--  5. staff_community_approve(p_id, p_by) - staff only. New rider: account + temporary
--     password (returned ONCE, never stored readable) + tag. Existing account (same email,
--     Apple relay email or phone): tag, and fill in only the details that account lacks.
--     The Privacy Notice confirmation and the ride-news answer from the form are recorded
--     on the account either way (the ride-news answer only if it is newer).
--  6. staff_community_new_password(p_id) - a fresh temporary password for an approved
--     application's new account, while the rider has not chosen their own yet.
--     account_oauth records whether that account signs in with Google/Apple (no password),
--     so the welcome message can be shown again later with the right sign-in line.
--  7. staff_community_decide(p_id, p_status, p_by) - reject a pending application, or put
--     a rejected one back to pending. Approved ones cannot be moved.
--  8. customer_pwd_state(p_id, p_token) / customer_set_own_password(p_id, p_token, p_new) -
--     the rider's side of the forced change. The change is allowed ONLY while
--     must_change_pwd is set, so a stolen session token still cannot change a password.
--
-- Rollback:
--   drop function if exists public.customer_set_own_password(text,text,text);
--   drop function if exists public.customer_pwd_state(text,text);
--   drop function if exists public.staff_community_decide(uuid,text,text);
--   drop function if exists public.staff_community_new_password(uuid);
--   drop function if exists public.staff_community_approve(uuid,text);
--   drop function if exists public.community_apply(jsonb);
--   drop function if exists public._community_temp_pwd();
--   drop trigger if exists customers_pwd_changed on public.customers;
--   drop function if exists public._customers_pwd_changed();
--   drop table if exists public.community_applications;
--   alter table public.customers drop column if exists must_change_pwd;
--   alter table public.customers drop column if exists profession;
-- Idempotent.
-- ============================================================================

begin;

alter table public.customers add column if not exists profession text;
alter table public.customers add column if not exists must_change_pwd boolean not null default false;

create table if not exists public.community_applications (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  submissions      integer not null default 1,
  status           text not null default 'pending' check (status in ('pending','approved','rejected')),
  name             text not null,
  email            text not null,
  phone            text not null,
  height           integer not null check (height between 100 and 250),
  birth_date       text not null check (birth_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  gender           text not null check (gender in ('male','female')),
  nationality      text not null,
  bike_type        text not null check (bike_type in ('Road','Hybrid')),
  instagram        text not null,
  linkedin         text not null,
  profession       text not null,
  lang             text not null default 'en',
  privacy_version  text not null,
  ride_news        boolean not null default false,
  decided_at       timestamptz,
  decided_by       text,
  customer_id      text references public.customers(id) on delete set null,
  existing_account boolean,
  account_oauth    boolean
);
alter table public.community_applications add column if not exists account_oauth boolean;
create index if not exists community_applications_status_idx on public.community_applications (status, created_at desc);
create index if not exists community_applications_email_idx  on public.community_applications (lower(email));
create index if not exists community_applications_phone_idx  on public.community_applications (phone);

alter table public.community_applications enable row level security;
drop policy if exists "staff read applications"   on public.community_applications;
drop policy if exists "staff update applications" on public.community_applications;
create policy "staff read applications"   on public.community_applications for select to authenticated using ((select is_staff()));
create policy "staff update applications" on public.community_applications for update to authenticated using ((select is_staff())) with check ((select is_staff()));
revoke all on public.community_applications from public, anon, authenticated;
grant select, update on public.community_applications to authenticated;

-- A password change clears the "must change" mark unless the change IS a temporary password
-- (those set mm.temp_pwd for their own transaction).
create or replace function public._customers_pwd_changed()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
begin
  if new.password_hash is distinct from old.password_hash
     and coalesce(current_setting('mm.temp_pwd', true), '') <> '1' then
    new.must_change_pwd := false;
  end if;
  return new;
end $function$;
drop trigger if exists customers_pwd_changed on public.customers;
create trigger customers_pwd_changed before update of password_hash on public.customers
  for each row execute function public._customers_pwd_changed();
revoke execute on function public._customers_pwd_changed() from public, anon, authenticated;

-- Ten characters from an alphabet with no look-alikes (no 0/O, 1/l/I), always holding an
-- upper-case letter, a lower-case letter and a digit: the site's own password rule.
create or replace function public._community_temp_pwd()
 returns text
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
as $function$
declare
  up  constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  lo  constant text := 'abcdefghijkmnpqrstuvwxyz';
  dg  constant text := '23456789';
  al  constant text := up || lo || dg;
  b bytea := gen_random_bytes(10);
  s text := ''; i int;
begin
  s := substr(up, 1 + get_byte(b,0) % length(up), 1)
    || substr(lo, 1 + get_byte(b,1) % length(lo), 1)
    || substr(dg, 1 + get_byte(b,2) % length(dg), 1);
  for i in 3..9 loop s := s || substr(al, 1 + get_byte(b,i) % length(al), 1); end loop;
  -- shuffle so the kinds do not always sit in the same places
  select string_agg(ch, '' order by k) into s
    from (select substr(s, n, 1) ch, get_byte(gen_random_bytes(1), 0) * 16 + n k from generate_series(1, length(s)) n) x;
  return s;
end $function$;
revoke execute on function public._community_temp_pwd() from public, anon, authenticated;

create or replace function public.community_apply(p jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
as $function$
declare
  v_name   text := regexp_replace(trim(coalesce(p->>'name','')), '\s+', ' ', 'g');
  v_email  text := lower(trim(coalesce(p->>'email','')));
  v_phone  text := trim(coalesce(p->>'phone',''));
  v_height int;
  v_birth  text := trim(coalesce(p->>'birth_date',''));
  v_gender text := coalesce(p->>'gender','');
  v_nat    text := trim(coalesce(p->>'nationality',''));
  v_type   text := coalesce(p->>'bike_type','');
  v_ig     text := regexp_replace(trim(coalesce(p->>'instagram','')), '^@+', '');
  v_li     text := trim(coalesce(p->>'linkedin',''));
  v_prof   text := regexp_replace(trim(coalesce(p->>'profession','')), '\s+', ' ', 'g');
  v_lang   text := coalesce(nullif(p->>'lang',''), 'en');
  v_pv     text := coalesce(p->>'privacy_version','');
  v_news   boolean := coalesce((p->>'ride_news')::boolean, false);
  v_today  date := (now() at time zone 'Asia/Riyadh')::date;
  v_bd     date;
  v_prev   community_applications%rowtype;
begin
  if not _ip_gate('community', 20, interval '10 minutes') then
    return jsonb_build_object('ok', false, 'error', 'throttled');
  end if;
  begin v_height := nullif(regexp_replace(coalesce(p->>'height',''), '\D', '', 'g'), '')::int;
  exception when others then v_height := null; end;

  if v_name = '' or length(v_name) > 120 or v_name !~ '\s' or not _name_chars_ok(v_name) then
    return jsonb_build_object('ok', false, 'error', 'name'); end if;
  if length(v_email) > 254 or v_email !~ '^[a-z0-9._%+''-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$' then
    return jsonb_build_object('ok', false, 'error', 'email'); end if;
  if v_phone !~ '^\+[1-9][0-9]{7,14}$' or (v_phone like '+966%' and v_phone !~ '^\+9665[0-9]{8}$') then
    return jsonb_build_object('ok', false, 'error', 'phone'); end if;
  if v_height is null or v_height < 100 or v_height > 250 then
    return jsonb_build_object('ok', false, 'error', 'height'); end if;
  begin v_bd := v_birth::date; exception when others then v_bd := null; end;
  -- The site's birth-date rule: never in the future, and nobody five or younger.
  if v_bd is null or v_birth !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or v_bd > v_today
     or v_bd > (v_today - interval '6 years')::date or v_bd < date '1900-01-01' then
    return jsonb_build_object('ok', false, 'error', 'birth_date'); end if;
  if v_gender not in ('male','female') then return jsonb_build_object('ok', false, 'error', 'gender'); end if;
  if v_nat = '' or length(v_nat) > 60 or v_nat ~ '[<>"`]' then return jsonb_build_object('ok', false, 'error', 'nationality'); end if;
  if v_type not in ('Road','Hybrid') then return jsonb_build_object('ok', false, 'error', 'bike_type'); end if;
  if v_ig !~ '^[A-Za-z0-9._]{1,30}$' then return jsonb_build_object('ok', false, 'error', 'instagram'); end if;
  if v_li !~ '^[A-Za-z0-9._%-]{3,100}$' then return jsonb_build_object('ok', false, 'error', 'linkedin'); end if;
  if length(v_prof) < 2 or length(v_prof) > 80 or v_prof ~ '[<>"`{}]' then
    return jsonb_build_object('ok', false, 'error', 'profession'); end if;
  if v_pv !~ '^\d{4}-\d{2}-\d{2}$' then return jsonb_build_object('ok', false, 'error', 'privacy'); end if;
  if v_lang !~ '^[a-z]{2}$' then v_lang := 'en'; end if;

  -- One pending application per person: the same email or phone updates it.
  perform pg_advisory_xact_lock(hashtext('commapp:' || v_email));
  perform pg_advisory_xact_lock(hashtext('commapp:' || v_phone));
  select * into v_prev from community_applications
   where status = 'pending' and (lower(email) = v_email or phone = v_phone)
   order by (lower(email) = v_email) desc, created_at limit 1;
  if v_prev.id is not null then
    update community_applications set
      name = v_name, email = v_email, phone = v_phone, height = v_height, birth_date = v_birth,
      gender = v_gender, nationality = v_nat, bike_type = v_type, instagram = v_ig, linkedin = v_li,
      profession = v_prof, lang = v_lang, privacy_version = v_pv, ride_news = v_news,
      submissions = submissions + 1, updated_at = now()
     where id = v_prev.id;
  else
    insert into community_applications (name, email, phone, height, birth_date, gender, nationality,
      bike_type, instagram, linkedin, profession, lang, privacy_version, ride_news)
    values (v_name, v_email, v_phone, v_height, v_birth, v_gender, v_nat, v_type, v_ig, v_li,
      v_prof, v_lang, v_pv, v_news);
  end if;
  -- The form learns nothing about accounts or earlier applications.
  return jsonb_build_object('ok', true);
end $function$;
revoke execute on function public.community_apply(jsonb) from public;
grant  execute on function public.community_apply(jsonb) to anon, authenticated;

create or replace function public.staff_community_approve(p_id uuid, p_by text default null)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
as $function$
declare
  a community_applications%rowtype;
  c customers%rowtype;
  v_id text; v_pwd text; v_digits text; v_socials jsonb; v_ms bigint;
  v_by text := left(coalesce(nullif(trim(p_by), ''), 'staff'), 80);
begin
  if not is_staff() then raise exception 'STAFF_ONLY' using errcode = '42501'; end if;
  select * into a from community_applications where id = p_id for update;
  if a.id is null then return jsonb_build_object('ok', false, 'error', 'missing'); end if;
  if a.status <> 'pending' then return jsonb_build_object('ok', false, 'error', 'decided', 'status', a.status); end if;

  v_digits := regexp_replace(a.phone, '\D', '', 'g');
  v_ms := (extract(epoch from now()) * 1000)::bigint;
  select * into c from customers
   where lower(trim(email)) = lower(a.email) or lower(trim(apple_email)) = lower(a.email)
   order by (lower(trim(email)) = lower(a.email)) desc nulls last, created_at limit 1;
  if c.id is null then
    select * into c from customers where regexp_replace(coalesce(phone,''), '\D', '', 'g') = v_digits
     order by created_at limit 1;
  end if;

  if c.id is not null then
    -- Already a rider: keep their account and password; add only what it lacks.
    v_socials := coalesce(c.socials, '{}'::jsonb);
    if not (v_socials ? 'instagram') then v_socials := v_socials || jsonb_build_object('instagram', a.instagram); end if;
    if not (v_socials ? 'linkedin')  then v_socials := v_socials || jsonb_build_object('linkedin',  a.linkedin);  end if;
    update customers set
      profession  = coalesce(nullif(trim(profession), ''), a.profession),
      socials     = v_socials,
      birth_date  = coalesce(nullif(birth_date, ''), a.birth_date),
      nationality = coalesce(nullif(nationality, ''), a.nationality),
      height      = coalesce(height, a.height),
      gender      = coalesce(gender, a.gender),
      privacy_version = case when privacy_version is null or privacy_version < a.privacy_version then a.privacy_version else privacy_version end,
      privacy_at      = case when privacy_version is null or privacy_version < a.privacy_version then a.updated_at else privacy_at end,
      ride_news       = case when ride_news_at is null or ride_news_at < a.updated_at then a.ride_news else ride_news end,
      ride_news_at    = case when ride_news_at is null or ride_news_at < a.updated_at then a.updated_at else ride_news_at end
     where id = c.id;
    v_id := c.id;
  else
    v_id := 'ca' || encode(gen_random_bytes(8), 'hex');
    v_pwd := _community_temp_pwd();
    insert into customers (id, name, email, phone, password_hash, created_at, height, type_preference,
      gender, birth_date, nationality, socials, profession, session_token, must_change_pwd,
      privacy_version, privacy_at, ride_news, ride_news_at)
    values (v_id, a.name, a.email, a.phone, crypt(v_pwd, gen_salt('bf')),
      to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), a.height, a.bike_type,
      a.gender, a.birth_date, a.nationality,
      jsonb_build_object('instagram', a.instagram, 'linkedin', a.linkedin), a.profession,
      encode(gen_random_bytes(24), 'hex'), true,
      a.privacy_version, a.updated_at, a.ride_news, a.updated_at);
  end if;

  insert into customer_tags (customer_id, tag_id, added_by, added_at, note)
  values (v_id, 'tag_saturday', v_by, v_ms, 'Community application')
  on conflict (customer_id, tag_id) do nothing;

  update community_applications set status = 'approved', decided_at = now(), decided_by = v_by,
    customer_id = v_id, existing_account = (c.id is not null), updated_at = now()
   where id = a.id;

  select * into c from customers where id = v_id;
  -- Kept so the welcome message can be shown again later with the right sign-in line.
  update community_applications set account_oauth = coalesce(c.password_hash, '') like 'oauth:%' where id = a.id;
  -- oauth: the account signs in with Google or Apple, so the message says so instead of a password.
  return jsonb_build_object('ok', true, 'existing', v_pwd is null, 'customer_id', v_id,
    'name', c.name, 'email', c.email, 'phone', c.phone, 'password', v_pwd, 'lang', a.lang,
    'oauth', coalesce(c.password_hash, '') like 'oauth:%');
end $function$;
revoke execute on function public.staff_community_approve(uuid, text) from public, anon;
grant  execute on function public.staff_community_approve(uuid, text) to authenticated;

create or replace function public.staff_community_new_password(p_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
as $function$
declare a community_applications%rowtype; c customers%rowtype; v_pwd text;
begin
  if not is_staff() then raise exception 'STAFF_ONLY' using errcode = '42501'; end if;
  select * into a from community_applications where id = p_id;
  if a.id is null or a.status <> 'approved' or a.customer_id is null or a.existing_account then
    return jsonb_build_object('ok', false, 'error', 'not_new');
  end if;
  select * into c from customers where id = a.customer_id for update;
  if c.id is null then return jsonb_build_object('ok', false, 'error', 'missing'); end if;
  -- Once the rider has chosen a password, it is theirs: staff cannot swap it from here.
  if not c.must_change_pwd then return jsonb_build_object('ok', false, 'error', 'chosen'); end if;
  v_pwd := _community_temp_pwd();
  perform set_config('mm.temp_pwd', '1', true);
  update customers set password_hash = crypt(v_pwd, gen_salt('bf')),
    session_token = encode(gen_random_bytes(24), 'hex'), must_change_pwd = true
   where id = c.id;
  perform set_config('mm.temp_pwd', '', true);
  return jsonb_build_object('ok', true, 'existing', false, 'customer_id', c.id, 'name', c.name,
    'email', c.email, 'phone', c.phone, 'password', v_pwd, 'lang', a.lang);
end $function$;
revoke execute on function public.staff_community_new_password(uuid) from public, anon;
grant  execute on function public.staff_community_new_password(uuid) to authenticated;

create or replace function public.staff_community_decide(p_id uuid, p_status text, p_by text default null)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare a community_applications%rowtype;
begin
  if not is_staff() then raise exception 'STAFF_ONLY' using errcode = '42501'; end if;
  if p_status not in ('rejected','pending') then return jsonb_build_object('ok', false, 'error', 'status'); end if;
  select * into a from community_applications where id = p_id for update;
  if a.id is null then return jsonb_build_object('ok', false, 'error', 'missing'); end if;
  if a.status = 'approved' or a.status = p_status then
    return jsonb_build_object('ok', false, 'error', 'decided', 'status', a.status);
  end if;
  update community_applications set status = p_status,
    decided_at = case when p_status = 'pending' then null else now() end,
    decided_by = case when p_status = 'pending' then null else left(coalesce(nullif(trim(p_by), ''), 'staff'), 80) end,
    updated_at = now()
   where id = a.id;
  return jsonb_build_object('ok', true, 'status', p_status);
end $function$;
revoke execute on function public.staff_community_decide(uuid, text, text) from public, anon;
grant  execute on function public.staff_community_decide(uuid, text, text) to authenticated;

create or replace function public.customer_pwd_state(p_id text, p_token text)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select coalesce((select must_change_pwd from customers where id = p_id and session_token = p_token and p_token is not null), false);
$function$;
revoke execute on function public.customer_pwd_state(text, text) from public;
grant  execute on function public.customer_pwd_state(text, text) to anon, authenticated;

-- Returns the new session token (other devices signed in with the temporary password are
-- signed out), or raises: NO_CHANGE_DUE when no temporary password is waiting, WEAK_PASSWORD.
create or replace function public.customer_set_own_password(p_id text, p_token text, p_new_pwd text)
 returns text
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
as $function$
declare c customers%rowtype; tok text;
begin
  if not _cust_token_ok(p_id, p_token) then raise exception 'BAD_TOKEN' using errcode = '28000'; end if;
  select * into c from customers where id = p_id for update;
  if not c.must_change_pwd then raise exception 'NO_CHANGE_DUE' using errcode = 'P0001'; end if;
  if length(coalesce(p_new_pwd, '')) < 8 or p_new_pwd !~ '[A-Z]' or p_new_pwd !~ '[0-9]' then
    raise exception 'WEAK_PASSWORD' using errcode = '22023';
  end if;
  if _cust_pwd_ok(c.password_hash, p_new_pwd) then raise exception 'SAME_PASSWORD' using errcode = '22023'; end if;
  tok := encode(gen_random_bytes(24), 'hex');
  update customers set password_hash = crypt(p_new_pwd, gen_salt('bf')), session_token = tok,
    must_change_pwd = false
   where id = p_id;
  return tok;
end $function$;
revoke execute on function public.customer_set_own_password(text, text, text) from public;
grant  execute on function public.customer_set_own_password(text, text, text) to anon, authenticated;

commit;
