-- ============================================================================
-- Ids, bike types, day names and the other id-like values have a shape the database holds.
--
-- The staff screens put these values into HTML and into inline handlers (a booking id is the
-- argument of every roster button; a photo is an <img src>; a social handle ends a link). They
-- are written by customers through the booking and profile RPCs and by the public Petromin
-- form, and until now any text at all was accepted: an id carrying a quote was one crafted
-- request away from running in a staff browser. The client now encodes what it renders
-- (e0f13cb); this is the half that stops the value being stored in the first place.
--
--   1. CHECK constraints, added NOT VALID and then validated, so the table is only scanned
--      once and never locked against writes for longer than the check itself. Production was
--      clean on 2026-09-22 (0 odd ids among 2,691 customers and 5,176 bookings; the longest id
--      is 17 characters), so every VALIDATE is expected to pass. If one fails, nothing in this
--      file has been applied: the whole migration is one transaction.
--   2. customer_signup and customer_oauth_signup refuse a malformed id, type, gender, height or
--      photo with a clean BAD_INPUT error instead of a constraint crash. The client only ever
--      sends good values (uid() is [a-z0-9]), so no current screen can reach the error.
--
-- Not constrained, on purpose: queue_entries.phone/email (staff type walk-in contacts in any
-- form, and a handful of historic rows break any strict rule - the RPCs clean new ones),
-- customers.email (one historic row has a doubled @; a NOT VALID check would still refuse
-- every later update of that customer), promo_code (staff choose codes; the price trigger
-- only ever keeps a code that exists).
--
-- Rollback: supabase/rollbacks/20260922120000_ids_and_types_have_a_shape.sql
-- Verify:   supabase/checks/review-fixes-2026-09-22.sql
-- ============================================================================

-- ── 1. Shapes that need more than a regular expression ─────────────────────
-- A booking's add-ons: a JSON array of {id, qty} (or, on old rows, bare ids).
create or replace function public._addons_ok(v text)
 returns boolean
 language plpgsql
 immutable
 set search_path to 'public'
as $function$
declare j jsonb; x jsonb;
begin
  if v is null or v = '' then return true; end if;
  begin j := v::jsonb; exception when others then return false; end;
  if jsonb_typeof(j) <> 'array' or jsonb_array_length(j) > 50 then return false; end if;
  for x in select * from jsonb_array_elements(j) loop
    if jsonb_typeof(x) = 'string' then
      if (x #>> '{}') !~ '^[A-Za-z0-9_-]{1,64}$' then return false; end if;
    elsif jsonb_typeof(x) = 'object' then
      if coalesce(x->>'id','') !~ '^[A-Za-z0-9_-]{1,64}$' then return false; end if;
      if x ? 'qty' and coalesce(x->>'qty','') !~ '^[0-9]{1,3}$' then return false; end if;
    else
      return false;
    end if;
  end loop;
  return true;
end $function$;

-- Social handles: the four networks the profile offers, each a bare handle (the client's
-- SOCIAL_NETS rules, loosened to their union so no handle it accepts is refused here).
create or replace function public._socials_ok(v jsonb)
 returns boolean
 language sql
 immutable
 set search_path to 'public'
as $function$
  select v is null or (jsonb_typeof(v) = 'object' and not exists (
    select 1 from jsonb_each(v) e
     where e.key not in ('instagram','x','tiktok','linkedin')
        or jsonb_typeof(e.value) <> 'string'
        or (e.value #>> '{}') !~ '^[A-Za-z0-9._%-]{1,100}$'))
$function$;

-- The bike types the app knows. 'None' marks a booking on a session with no bike (the pool,
-- the workshop); 'Own' a rider on their own bike; 'Gravel' is a fleet type staff can pick.
create or replace function public._type_ok(v text)
 returns boolean
 language sql
 immutable
 set search_path to 'public'
as $function$
  select v in ('Road','Hybrid','Mountain','Road Carbon','Gravel','Kids','Any','Own','None')
$function$;

-- ── 2. The constraints ──────────────────────────────────────────────────────
alter table public.customers drop constraint if exists customers_id_shape;
alter table public.customers add constraint customers_id_shape
  check (id ~ '^[A-Za-z0-9_-]{1,64}$') not valid;
alter table public.customers drop constraint if exists customers_type_known;
alter table public.customers add constraint customers_type_known
  check (type_preference is null or _type_ok(type_preference)) not valid;
alter table public.customers drop constraint if exists customers_gender_known;
alter table public.customers add constraint customers_gender_known
  check (gender is null or gender in ('male','female')) not valid;
-- '' stays legal: My Account lets a rider with an email clear their phone.
alter table public.customers drop constraint if exists customers_phone_shape;
alter table public.customers add constraint customers_phone_shape
  check (phone is null or phone = '' or phone ~ '^\+?[0-9]{6,15}$') not valid;
alter table public.customers drop constraint if exists customers_photo_shape;
alter table public.customers add constraint customers_photo_shape
  check (photo is null or photo ~ '^(https://[^[:space:]"''<>`\\]+|data:image/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]+)$') not valid;
alter table public.customers drop constraint if exists customers_birth_date_shape;
alter table public.customers add constraint customers_birth_date_shape
  check (birth_date is null or birth_date = '' or birth_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$') not valid;
alter table public.customers drop constraint if exists customers_socials_shape;
alter table public.customers add constraint customers_socials_shape
  check (_socials_ok(socials)) not valid;

alter table public.queue_entries drop constraint if exists queue_entries_id_shape;
alter table public.queue_entries add constraint queue_entries_id_shape
  check (id ~ '^[A-Za-z0-9_-]{1,64}$') not valid;
alter table public.queue_entries drop constraint if exists queue_entries_group_id_shape;
alter table public.queue_entries add constraint queue_entries_group_id_shape
  check (group_id is null or group_id ~ '^[A-Za-z0-9_-]{1,64}$') not valid;
alter table public.queue_entries drop constraint if exists queue_entries_customer_id_shape;
alter table public.queue_entries add constraint queue_entries_customer_id_shape
  check (customer_id is null or customer_id ~ '^[A-Za-z0-9_-]{1,64}$') not valid;
alter table public.queue_entries drop constraint if exists queue_entries_session_day_known;
alter table public.queue_entries add constraint queue_entries_session_day_known
  check (session_day in ('Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday')) not valid;
alter table public.queue_entries drop constraint if exists queue_entries_type_known;
alter table public.queue_entries add constraint queue_entries_type_known
  check (_type_ok(type_preference)) not valid;
alter table public.queue_entries drop constraint if exists queue_entries_size_known;
alter table public.queue_entries add constraint queue_entries_size_known
  check (size in ('','XS','S','M','L','XL')) not valid;
alter table public.queue_entries drop constraint if exists queue_entries_session_date_shape;
alter table public.queue_entries add constraint queue_entries_session_date_shape
  check (session_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$') not valid;
alter table public.queue_entries drop constraint if exists queue_entries_registered_at_shape;
alter table public.queue_entries add constraint queue_entries_registered_at_shape
  check (registered_at ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}[T ][0-9]{2}:[0-9]{2}') not valid;
alter table public.queue_entries drop constraint if exists queue_entries_waiver_version_shape;
alter table public.queue_entries add constraint queue_entries_waiver_version_shape
  check (waiver_version is null or waiver_version ~ '^[A-Za-z0-9._-]{1,40}$') not valid;
alter table public.queue_entries drop constraint if exists queue_entries_addons_shape;
alter table public.queue_entries add constraint queue_entries_addons_shape
  check (_addons_ok(addons)) not valid;

-- The badge is typed by the public on the Petromin form. It is a staff-issued number, so
-- letters, digits and the separators people actually type, and at least one letter or digit
-- (badge_key keeps only those, and an empty key would make every such badge one badge).
alter table public.rider_registrations drop constraint if exists rider_registrations_badge_shape;
alter table public.rider_registrations add constraint rider_registrations_badge_shape
  check (badge ~ '^[A-Za-z0-9 ._/#’-]{1,40}$' and badge ~ '[A-Za-z0-9]') not valid;
alter table public.rider_registrations drop constraint if exists rider_registrations_phone_shape;
alter table public.rider_registrations add constraint rider_registrations_phone_shape
  check (phone is null or phone ~ '^\+[0-9]{8,15}$') not valid;

alter table public.customers validate constraint customers_id_shape;
alter table public.customers validate constraint customers_type_known;
alter table public.customers validate constraint customers_gender_known;
alter table public.customers validate constraint customers_phone_shape;
alter table public.customers validate constraint customers_photo_shape;
alter table public.customers validate constraint customers_birth_date_shape;
alter table public.customers validate constraint customers_socials_shape;
alter table public.queue_entries validate constraint queue_entries_id_shape;
alter table public.queue_entries validate constraint queue_entries_group_id_shape;
alter table public.queue_entries validate constraint queue_entries_customer_id_shape;
alter table public.queue_entries validate constraint queue_entries_session_day_known;
alter table public.queue_entries validate constraint queue_entries_type_known;
alter table public.queue_entries validate constraint queue_entries_size_known;
alter table public.queue_entries validate constraint queue_entries_session_date_shape;
alter table public.queue_entries validate constraint queue_entries_registered_at_shape;
alter table public.queue_entries validate constraint queue_entries_waiver_version_shape;
alter table public.queue_entries validate constraint queue_entries_addons_shape;
alter table public.rider_registrations validate constraint rider_registrations_badge_shape;
alter table public.rider_registrations validate constraint rider_registrations_phone_shape;

-- ── 3. Sign-up says what is wrong instead of crashing into a constraint ────
-- Rebuilt from the live definitions (pg_get_functiondef, 2026-09-22): header, SECURITY DEFINER
-- and search_path unchanged. The only addition is the input check at the top.
CREATE OR REPLACE FUNCTION public.customer_signup(p_id text, p_name text, p_email text, p_phone text, p_pwd text, p_height integer, p_type_preference text, p_gender text)
 RETURNS TABLE(id text, session_token text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare tok text;
begin
  -- An empty choice is no choice: '' is stored the way the column's own default would be.
  p_gender := nullif(p_gender, '');
  p_type_preference := coalesce(nullif(p_type_preference, ''), 'Any');
  if coalesce(p_id,'') !~ '^[A-Za-z0-9_-]{1,64}$' then raise exception 'BAD_INPUT' using errcode = '22023', detail = 'id'; end if;
  if not _type_ok(p_type_preference) then raise exception 'BAD_INPUT' using errcode = '22023', detail = 'type_preference'; end if;
  if p_gender is not null and p_gender not in ('male','female') then raise exception 'BAD_INPUT' using errcode = '22023', detail = 'gender'; end if;
  if p_height is not null and (p_height < 100 or p_height > 250) then raise exception 'BAD_INPUT' using errcode = '22023', detail = 'height'; end if;
  if coalesce(p_phone,'') <> '' and p_phone !~ '^\+?[0-9]{6,15}$' then raise exception 'BAD_INPUT' using errcode = '22023', detail = 'phone'; end if;
  if exists(select 1 from customers
            where (coalesce(p_email,'')<>'' and lower(email)=lower(p_email))
               or (coalesce(p_phone,'')<>'' and phone=p_phone)) then
    raise exception 'DUPLICATE' using errcode = 'unique_violation';
  end if;
  tok := encode(gen_random_bytes(24),'hex');
  insert into customers(id,name,email,phone,password_hash,created_at,height,type_preference,gender,session_token)
  values(p_id,p_name,p_email,p_phone,crypt(p_pwd, gen_salt('bf')),to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
         p_height,p_type_preference,p_gender,tok);
  return query select p_id, tok;
end $function$;

CREATE OR REPLACE FUNCTION public.customer_oauth_signup(p_id text, p_name text, p_email text, p_phone text, p_height integer, p_type_preference text, p_gender text, p_photo text)
 RETURNS TABLE(id text, session_token text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare tok text; v_photo text;
begin
  if auth.uid() is null or lower(coalesce(auth.jwt()->>'email','')) <> lower(p_email) then
    raise exception 'NOT_AUTHORIZED';
  end if;
  p_gender := nullif(p_gender, '');
  p_type_preference := coalesce(nullif(p_type_preference, ''), 'Any');
  if coalesce(p_id,'') !~ '^[A-Za-z0-9_-]{1,64}$' then raise exception 'BAD_INPUT' using errcode = '22023', detail = 'id'; end if;
  if not _type_ok(p_type_preference) then raise exception 'BAD_INPUT' using errcode = '22023', detail = 'type_preference'; end if;
  if p_gender is not null and p_gender not in ('male','female') then raise exception 'BAD_INPUT' using errcode = '22023', detail = 'gender'; end if;
  if p_height is not null and (p_height < 100 or p_height > 250) then raise exception 'BAD_INPUT' using errcode = '22023', detail = 'height'; end if;
  if coalesce(p_phone,'') <> '' and p_phone !~ '^\+?[0-9]{6,15}$' then raise exception 'BAD_INPUT' using errcode = '22023', detail = 'phone'; end if;
  -- The provider's avatar is a link; anything that is not a plain https URL is simply not kept.
  v_photo := case when length(p_photo) <= 2000 and p_photo ~ '^https://[^[:space:]"''<>`\\]+$' then p_photo end;
  if exists(select 1 from customers
            where (coalesce(p_email,'')<>'' and lower(customers.email)=lower(p_email))
               or (coalesce(p_phone,'')<>'' and customers.phone=p_phone)) then
    raise exception 'DUPLICATE' using errcode = 'unique_violation';
  end if;
  tok := encode(gen_random_bytes(24),'hex');
  insert into customers(id,name,email,phone,password_hash,created_at,height,type_preference,gender,photo,session_token)
  values(p_id,p_name,p_email,p_phone,'oauth:google',to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
         p_height,p_type_preference,p_gender,v_photo,tok);
  return query select p_id, tok;
end $function$;
