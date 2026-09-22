-- ============================================================================
-- Google/Apple sign-in accepts only a login Google or Apple vouched for (2026-09-22).
--
-- customer_oauth_login opens the rider account whose email matches the Supabase Auth login's
-- email. Supabase can also make a login from an email and a password; if "Confirm email" is
-- ever off, such a login carries an email nobody proved they own, and this function would open
-- that rider's account for whoever typed it. So both OAuth functions now also require the
-- login's provider (app_metadata.provider in the JWT) to be google or apple. Staff sign in with
-- email and password but never call these two functions, so nothing changes for them.
-- Rebuilt from the live definitions (customer_oauth_login pg_get_functiondef 2026-09-22,
-- md5 c8d15f11…; customer_oauth_signup as 20260922120100 left it): SECURITY DEFINER and
-- search_path unchanged; the only change is the provider condition.
-- Rollback: the same two functions without the provider condition (see 20260922120100 and the
-- live definition quoted above).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.customer_oauth_login(p_email text)
 RETURNS TABLE(id text, name text, email text, phone text, height integer, type_preference text, created_at text, birth_date text, country text, city text, photo text, session_token text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare r customers%rowtype; tok text;
begin
  -- Only a login Google or Apple vouched for: an email-and-password Supabase login carries an
  -- email nobody may have confirmed, and must never open the rider account with that email.
  if auth.uid() is null or lower(coalesce(auth.jwt()->>'email','')) <> lower(p_email)
     or coalesce(auth.jwt()->'app_metadata'->>'provider','') not in ('google','apple') then return; end if;
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

CREATE OR REPLACE FUNCTION public.customer_oauth_signup(p_id text, p_name text, p_email text, p_phone text, p_height integer, p_type_preference text, p_gender text, p_photo text)
 RETURNS TABLE(id text, session_token text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare tok text; v_photo text;
begin
  if auth.uid() is null or lower(coalesce(auth.jwt()->>'email','')) <> lower(p_email)
     or coalesce(auth.jwt()->'app_metadata'->>'provider','') not in ('google','apple') then
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
