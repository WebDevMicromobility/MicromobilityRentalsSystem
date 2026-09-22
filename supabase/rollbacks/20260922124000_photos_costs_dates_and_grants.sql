-- Rollback of 20260922124000_photos_costs_dates_and_grants.sql (run this one first).
-- Restores the bucket, the open cost column, and staff_return / list_sessions exactly as they
-- were live on 2026-09-22 (pg_get_functiondef). Idempotent.
-- If the app build that reads inventory columns by name is ALSO rolled back, this rollback must
-- run before that build ships: the old build reads inventory with select('*').

update storage.buckets set file_size_limit = null, allowed_mime_types = null where id = 'photos';
drop policy if exists "photos upload" on storage.objects;
create policy "photos upload" on storage.objects for insert to anon with check (bucket_id = 'photos'::text);

-- The table grant makes select('*') work again; the per-column grants beside it are harmless.
grant select on public.inventory to anon, authenticated;
drop function if exists public.staff_inventory_costs();

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
           retired_date = case when p_return_condition = 'damaged' then current_date::text else retired_date end
     where id = bid;
    n := n + 1;
  end loop;

  update public.bike_assignments
     set returned_at = now(), returned_by = auth.uid(), return_condition = p_return_condition, return_notes = p_notes
   where booking_id = q.id and returned_at is null;
  update public.queue_entries set status = 'done', checked_out_at = public._iso_now() where id = q.id;
  return jsonb_build_object('ok', true, 'noop', false, 'bikes_freed', n);
end $function$;

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
       order by s.session_date;
  else
    return query
      select s.* from sessions s
       where s.required_tag_id is null
       order by s.session_date;
  end if;
end $function$;

-- Live had PUBLIC EXECUTE on these (the earlier role revokes never removed it).
grant execute on function
  public._approval_guard(), public._capacity_guard(), public._comm_no_carbon(),
  public._community_booking_gate(), public._customer_name_ok(), public._enforce_booking_price(),
  public._grant_auto_tags(), public._group_ride_cap(), public._promo_count(),
  public._rider_link_reprice(), public._rider_registration_guard(), public._session_fill_status(),
  public._session_status_by_hand(), public._solo_ride_cap(), public._wl_num_assign(),
  public.assign_queue_num(), public.queue_num_update_guard(), public.staff_mark_pwd_changed()
  to public;
