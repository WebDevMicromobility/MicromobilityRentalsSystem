-- ============================================================================
-- Deleting an account in one step, two narrow profile saves, and codes on the three
-- booking refusals.
--
-- NOT APPLIED YET. The app works with or without it: every client change falls back to the
-- old behaviour when a function is missing (PGRST202 / 42883), so it does not matter whether
-- the site or this migration ships first.
--
--  1. staff_delete_customer(p_id) -> jsonb. Admin only (is_admin()). Refuses an account with
--     a waiting, waitlisted or riding booking: {ok:false, error:'LIVE_BOOKINGS', live:n}
--     ({ok:false, error:'NOT_FOUND'} for an id that is not there). Otherwise, in ONE
--     transaction: unlinks every queue_entries and cashier_sales row (customer_id -> null),
--     deletes customer_tags and push_subscriptions, and deletes the customers row
--     (customer_flags cascade; rider_registrations.matched_customer_id is set null by its
--     key). Returns {ok:true, bookings, sales, tags, push_subscriptions, flags, rider_links}.
--     The staff panel used to do this in five writes from the device, so a dropped connection
--     could leave an account half-deleted, and push_subscriptions has no staff delete policy,
--     so a rider's push subscriptions were never actually removed.
--     Execute: authenticated only.
--  2. customer_set_height(p_id, p_token, p_height) and
--     customer_set_birth_nat(p_id, p_token, p_birth_date, p_nationality) -> boolean.
--     Token-checked (_cust_token_ok), validated exactly as customer_update_profile does.
--     The booking wizard (first height) and the profile gate (birth date + nationality) used
--     to read the whole profile and write it all back through customer_update_profile, which
--     could put back a value staff had just corrected. Execute: anon + authenticated.
--  3. _community_booking_gate, _solo_ride_cap and _group_ride_cap raise their English
--     sentences as before, now with DETAIL 'MEMBERS_ONLY', 'ONE_PER_SESSION' and 'GROUP_CAP',
--     which the app reads before it falls back to matching the sentence. Rebuilt from their
--     live definitions; SECURITY DEFINER and search_path unchanged.
--
-- Rollback: supabase/rollbacks/20260922150000_account_delete_narrow_saves_refusal_codes.sql
-- Check:    supabase/checks/account-delete-narrow-saves-refusal-codes.sql (every ok true),
--           then supabase/checks/security-attributes.sql (no rows).
-- Idempotent.
-- ============================================================================

begin;

-- 1. Deleting an account, in one transaction ------------------------------------------------
create or replace function public.staff_delete_customer(p_id text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_live int; v_bookings int := 0; v_sales int := 0; v_tags int := 0; v_push int := 0;
  v_flags int := 0; v_riders int := 0;
begin
  -- Admins only, as in the staff panel and in the customers table's own delete policy.
  if not is_admin() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  -- The account row is locked first. A booking being made for it needs that row (its foreign
  -- key), so it waits here and then fails on the missing account, instead of landing between
  -- the check below and the delete.
  perform 1 from customers where id = p_id for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); end if;
  select count(*) into v_live from queue_entries
   where customer_id = p_id and status in ('waiting', 'waitlist', 'active');
  if v_live > 0 then
    return jsonb_build_object('ok', false, 'error', 'LIVE_BOOKINGS', 'live', v_live);
  end if;
  -- Past bookings and sales stay, name and all, so rosters, close-outs and analytics read as
  -- they did; they only lose the link. Every row the server holds, not a date window.
  update queue_entries set customer_id = null where customer_id = p_id;
  get diagnostics v_bookings = row_count;
  update cashier_sales set customer_id = null where customer_id = p_id;
  get diagnostics v_sales = row_count;
  -- What was personal to the account goes with it. No key ties these two to customers.
  delete from customer_tags where customer_id = p_id;
  get diagnostics v_tags = row_count;
  delete from push_subscriptions where customer_id = p_id;
  get diagnostics v_push = row_count;
  -- The keys do the rest: customer_flags go with the account (on delete cascade) and a rider
  -- registration matched to it keeps its row with the match cleared (on delete set null).
  -- Counted first, so the answer says everything that moved.
  select count(*) into v_flags from customer_flags where customer_id = p_id;
  select count(*) into v_riders from rider_registrations where matched_customer_id = p_id;
  delete from customers where id = p_id;
  return jsonb_build_object('ok', true, 'bookings', v_bookings, 'sales', v_sales, 'tags', v_tags,
                            'push_subscriptions', v_push, 'flags', v_flags, 'rider_links', v_riders);
end $function$;

revoke execute on function public.staff_delete_customer(text) from public, anon;
grant  execute on function public.staff_delete_customer(text) to authenticated;

-- 2. Two narrow saves for the rider's own account --------------------------------------------
-- Same rules as customer_update_profile: height null clears, 100-250 is stored, anything else
-- keeps what is there; a birth date '' or null clears, a valid one (_ymd_ok) is stored,
-- anything else keeps what is there; nationality is cut to 80 characters.
create or replace function public.customer_set_height(p_id text, p_token text, p_height integer)
 returns boolean
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
as $function$
begin
  if not _cust_token_ok(p_id, p_token) then return false; end if;
  update customers
     set height = case when p_height is null then null
                       when p_height between 100 and 250 then p_height
                       else height end
   where id = p_id;
  return found;
end $function$;

revoke execute on function public.customer_set_height(text, text, integer) from public;
grant  execute on function public.customer_set_height(text, text, integer) to anon, authenticated;

create or replace function public.customer_set_birth_nat(p_id text, p_token text, p_birth_date text, p_nationality text)
 returns boolean
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
as $function$
begin
  if not _cust_token_ok(p_id, p_token) then return false; end if;
  update customers
     set birth_date  = case when nullif(p_birth_date, '') is null then null
                            when _ymd_ok(p_birth_date) then p_birth_date
                            else birth_date end,
         nationality = left(p_nationality, 80)
   where id = p_id;
  return found;
end $function$;

revoke execute on function public.customer_set_birth_nat(text, text, text, text) from public;
grant  execute on function public.customer_set_birth_nat(text, text, text, text) to anon, authenticated;

-- 3. A code on each booking refusal ------------------------------------------------------------
-- Each function below is its live definition (pg_get_functiondef, 2026-09-22) with one change:
-- `using detail = '<CODE>'` on its raise. The English message is unchanged (staff screens show
-- it). CREATE OR REPLACE keeps each function's grants (EXECUTE for postgres only).

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
    raise exception 'This ride is for community members only.' using detail = 'MEMBERS_ONLY';
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
    raise exception 'One place per person on this session.' using detail = 'ONE_PER_SESSION';
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
    raise exception 'Up to 2 riders per booking on this ride.' using detail = 'GROUP_CAP';
  end if;

  return new;
end $function$;

commit;
