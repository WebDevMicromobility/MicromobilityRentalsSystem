-- ============================================================================
-- The photo bucket, stock costs, the return date, private sessions a rider is booked on,
-- and grants that never took effect.
--
--   1. PHOTOS. The public 'photos' bucket took an upload of any size and any type from the
--      anon key, anywhere in the bucket (policy "photos upload": bucket_id = 'photos' and
--      nothing else) - free hosting on an organisation already over its egress allowance.
--      Meanwhile the app's own uploads had all failed since 2026-07-06: it uploads with
--      upsert:true, which needs SELECT and UPDATE policies that do not exist, and signed-in
--      staff or Google/Apple riders (role authenticated) had no INSERT policy at all, so every
--      photo quietly fell back to a data URL in the row. The bucket now takes images only
--      (JPEG, PNG, WebP), 1 MB at most, and only under p/<id>.<ext>, the name the app gives
--      them; anon and authenticated may both upload. The app now uploads with upsert:false
--      (its names are unique; nothing is ever overwritten), so INSERT is all it needs.
--   2. STOCK COSTS. inventory.cost (what the shop pays per unit) was readable by anyone
--      through the "public read" policy. Column SELECT on it is withdrawn from anon and
--      authenticated (the bikes pattern: table grant revoked, every other column granted back);
--      staff read it through staff_inventory_costs(). The app lists the inventory columns
--      explicitly and merges the costs in for staff (_optionalFetch); writes are unchanged.
--   3. staff_return dated a damaged bike's maintenance by the server's UTC day: a bike back
--      before 03:00 in Jeddah was booked in on the previous day. It now uses the KSA day.
--   4. list_sessions also returns a private (tag-gated) session the rider already holds a live
--      booking on, so a booking whose member tag lapsed does not lose its night in My Rides.
--   5. The trigger functions and staff_mark_pwd_changed were "revoked" from anon and
--      authenticated in 20260904140000, which had no effect: EXECUTE is granted to PUBLIC, and
--      a revoke aimed at a role leaves PUBLIC's grant standing. Revoked from PUBLIC now.
--      Triggers do not need EXECUTE to fire (it is checked when a trigger is created), so no
--      write path changes; staff_mark_pwd_changed stays callable by authenticated staff.
--
-- Rollback: supabase/rollbacks/20260922124000_photos_costs_dates_and_grants.sql
-- ============================================================================

-- ── 1. The photo bucket ─────────────────────────────────────────────────────
update storage.buckets
   set file_size_limit = 1048576,
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
 where id = 'photos';

drop policy if exists "photos upload" on storage.objects;
create policy "photos upload" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'photos' and name ~ '^p/[A-Za-z0-9_-]{1,64}\.(jpg|jpeg|png|webp)$');

-- ── 2. What the shop pays for stock is staff's to see ──────────────────────
do $$
declare c record;
begin
  revoke select on public.inventory from anon, authenticated;
  for c in
    select column_name from information_schema.columns
     where table_schema = 'public' and table_name = 'inventory' and column_name <> 'cost'
  loop
    execute format('grant select (%I) on public.inventory to anon, authenticated', c.column_name);
  end loop;
end $$;

create or replace function public.staff_inventory_costs()
 returns table(id text, cost numeric)
 language plpgsql
 stable
 security definer
 set search_path to 'public'
as $function$
begin
  if not is_staff() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  return query select i.id, i.cost from public.inventory i;
end $function$;
revoke all on function public.staff_inventory_costs() from public, anon;
grant execute on function public.staff_inventory_costs() to authenticated;

-- ── 3. A damaged bike's date is the Jeddah date ─────────────────────────────
CREATE OR REPLACE FUNCTION public.staff_return(p_booking_id text, p_return_condition text DEFAULT 'ok'::text, p_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare q public.queue_entries%rowtype; bid text; n int := 0;
begin
  if not is_staff() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if p_return_condition not in ('ok','needs_check','damaged') then
    raise exception 'BAD_CONDITION: % (ok | needs_check | damaged)', p_return_condition;
  end if;

  select * into q from public.queue_entries where id = p_booking_id for update;
  if not found then raise exception 'BOOKING_NOT_FOUND: no booking %', p_booking_id; end if;
  if q.status = 'done' and not exists (select 1 from public.bike_assignments where booking_id = q.id and returned_at is null) then
    return jsonb_build_object('ok', true, 'noop', true);
  end if;
  if q.status <> 'active' then
    raise exception 'BAD_BOOKING_STATE: #% is %, not on a bike', coalesce(q.queue_num::text, q.id), q.status;
  end if;

  -- The bikes to free: every open assignment, plus the legacy pointer for a ride that
  -- went out before assignments existed and was not caught by the backfill.
  for bid in
    select distinct x.bike_id from (
      select bike_id from public.bike_assignments where booking_id = q.id and returned_at is null
      union
      select q.assigned_bike_id where q.assigned_bike_id is not null and q.assigned_bike_id not like '[%'
      union
      select arr from jsonb_array_elements_text(case when q.assigned_bike_id like '[%' then q.assigned_bike_id::jsonb else '[]'::jsonb end) as arr
    ) x order by 1
  loop
    perform 1 from public.bikes where id = bid for update;
    update public.bikes
       set status = case when p_return_condition = 'damaged' then 'maintenance' else 'available' end,
           -- the day in Jeddah, not the server's UTC day (a return before 03:00 is still today)
           retired_date = case when p_return_condition = 'damaged'
                               then to_char(now() at time zone 'Asia/Riyadh', 'YYYY-MM-DD') else retired_date end
     where id = bid;
    n := n + 1;
  end loop;

  update public.bike_assignments
     set returned_at = now(), returned_by = auth.uid(), return_condition = p_return_condition, return_notes = p_notes
   where booking_id = q.id and returned_at is null;
  update public.queue_entries set status = 'done', checked_out_at = public._iso_now() where id = q.id;
  return jsonb_build_object('ok', true, 'noop', false, 'bikes_freed', n);
end $function$;

-- ── 4. A private night the rider is already booked on stays in their list ──
CREATE OR REPLACE FUNCTION public.list_sessions(p_id text, p_token text)
 RETURNS SETOF sessions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
begin
  if p_id is not null and p_token is not null and _cust_token_ok(p_id, p_token) then
    return query
      select s.* from sessions s
       where s.required_tag_id is null
          or exists (select 1 from customer_tags ct
                      where ct.customer_id = p_id and ct.tag_id = s.required_tag_id
                        and _ctag_active(ct.starts_at, ct.expires_at))
          -- a booking the rider still holds keeps its night visible after the tag lapses
          or exists (select 1 from queue_entries q
                      where q.session_id = s.id and q.customer_id = p_id
                        and q.status in ('waiting','waitlist','active'))
       order by s.session_date;
  else
    return query
      select s.* from sessions s
       where s.required_tag_id is null
       order by s.session_date;
  end if;
end $function$;

-- ── 5. Revokes that take effect ─────────────────────────────────────────────
revoke execute on function
  public._approval_guard(), public._capacity_guard(), public._comm_no_carbon(),
  public._community_booking_gate(), public._customer_name_ok(), public._enforce_booking_price(),
  public._grant_auto_tags(), public._group_ride_cap(), public._promo_count(),
  public._rider_link_reprice(), public._rider_registration_guard(), public._session_fill_status(),
  public._session_status_by_hand(), public._solo_ride_cap(), public._wl_num_assign(),
  public.assign_queue_num(), public.queue_num_update_guard()
  from public, anon, authenticated;
revoke execute on function public.staff_mark_pwd_changed() from public, anon;
grant execute on function public.staff_mark_pwd_changed() to authenticated;
