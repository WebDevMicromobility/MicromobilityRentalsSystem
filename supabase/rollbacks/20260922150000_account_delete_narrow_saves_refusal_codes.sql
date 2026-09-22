-- Rollback of 20260922150000_account_delete_narrow_saves_refusal_codes.sql.
-- Drops the three new functions and puts the three booking-rule triggers back exactly as they
-- were live on 2026-09-22 (pg_get_functiondef; body md5s below). Idempotent.
-- The app keeps working after it: every call it makes to these functions falls back when the
-- function is missing, and without the DETAIL codes it matches the English sentences.
--   _community_booking_gate  prosrc md5 74f3bbf7b34a5fffef9f46948d7a2c82
--   _solo_ride_cap           prosrc md5 3ae6b07174952c63d8d342683148d0c8
--   _group_ride_cap          prosrc md5 812ffc5a72ca95735ff9b84f3046320e

begin;

drop function if exists public.staff_delete_customer(text);
drop function if exists public.customer_set_height(text, text, integer);
drop function if exists public.customer_set_birth_nat(text, text, text, text);

CREATE OR REPLACE FUNCTION public._community_booking_gate()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
begin
  if exists (select 1 from sessions s
              where s.id = new.session_id
                and s.event_kind = 'community'
                and coalesce(s.open_to_all, false) = false)
     and not is_staff()
     and (new.customer_id is null or not exists (
            select 1
              from customer_tags ct
              join tags tg on tg.id = ct.tag_id
             where ct.customer_id = new.customer_id
               and lower(tg.slug) = 'saturday'
               and _ctag_active(ct.starts_at, ct.expires_at)))
  then
    raise exception 'This ride is for community members only.';
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public._solo_ride_cap()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare _live int;
begin
  if new.customer_id is null or (select is_staff()) then return new; end if;

  if not exists (select 1 from sessions s
                  where s.id = new.session_id
                    and s.event_kind = 'community'
                    and coalesce(s.needs_approval, false) = true) then
    return new;
  end if;

  select count(*) into _live
    from queue_entries q
   where q.session_id = new.session_id
     and q.customer_id = new.customer_id
     and coalesce(q.status, '') not in ('cancelled', 'removed', 'noshow')
     and q.id <> new.id;

  if _live >= 1 then
    raise exception 'One place per person on this session.';
  end if;

  return new;
end $function$;

CREATE OR REPLACE FUNCTION public._group_ride_cap()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare _live int;
begin
  if new.customer_id is null or (select is_staff()) then return new; end if;

  if not exists (select 1 from sessions s
                  where s.id = new.session_id
                    and s.event_kind = 'community'
                    and coalesce(s.needs_approval,false) = false) then
    return new;
  end if;

  select count(*) into _live
    from queue_entries q
   where q.session_id = new.session_id
     and q.customer_id = new.customer_id
     and coalesce(q.status,'') not in ('cancelled','removed','noshow')
     and q.id <> new.id;

  if _live >= 2 then
    raise exception 'Up to 2 riders per booking on this ride.';
  end if;

  return new;
end $function$;

commit;
