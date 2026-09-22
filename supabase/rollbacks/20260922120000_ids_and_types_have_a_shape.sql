-- Rollback of 20260922120000_ids_and_types_have_a_shape.sql.
-- Run the rollbacks newest first (124000, 123000, 122000, 121000, then this one): the later
-- migrations' functions call the helpers this one drops.
-- Restores the constraint-free tables and the sign-up functions exactly as they were live on
-- 2026-09-22 (pg_get_functiondef). Idempotent.

alter table public.customers drop constraint if exists customers_id_shape;
alter table public.customers drop constraint if exists customers_type_known;
alter table public.customers drop constraint if exists customers_gender_known;
alter table public.customers drop constraint if exists customers_phone_shape;
alter table public.customers drop constraint if exists customers_photo_shape;
alter table public.customers drop constraint if exists customers_birth_date_shape;
alter table public.customers drop constraint if exists customers_socials_shape;
alter table public.queue_entries drop constraint if exists queue_entries_id_shape;
alter table public.queue_entries drop constraint if exists queue_entries_group_id_shape;
alter table public.queue_entries drop constraint if exists queue_entries_customer_id_shape;
alter table public.queue_entries drop constraint if exists queue_entries_session_day_known;
alter table public.queue_entries drop constraint if exists queue_entries_type_known;
alter table public.queue_entries drop constraint if exists queue_entries_size_known;
alter table public.queue_entries drop constraint if exists queue_entries_session_date_shape;
alter table public.queue_entries drop constraint if exists queue_entries_registered_at_shape;
alter table public.queue_entries drop constraint if exists queue_entries_waiver_version_shape;
alter table public.queue_entries drop constraint if exists queue_entries_addons_shape;
alter table public.rider_registrations drop constraint if exists rider_registrations_badge_shape;
alter table public.rider_registrations drop constraint if exists rider_registrations_phone_shape;

CREATE OR REPLACE FUNCTION public.customer_signup(p_id text, p_name text, p_email text, p_phone text, p_pwd text, p_height integer, p_type_preference text, p_gender text)
 RETURNS TABLE(id text, session_token text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare tok text;
begin
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
end $function$;

drop function if exists public._addons_ok(text);
drop function if exists public._socials_ok(jsonb);
drop function if exists public._type_ok(text);
