-- ─────────────────────────────────────────────────────────────────────────────
-- Bike assignments as a history, and the check-in / return / swap that write it.
--
-- For the JCC Open Sport Days pop-up: staff scan a booking, tap the bike's NFC
-- tag (which opens /?bike=042 on the same iPhone), and confirm. The booking goes
-- waiting -> active and the bike available -> in-use exactly as the desk does
-- today by hand; what is new is a bike_assignments row per handover, so who rode
-- which bike, from when to when, and in what condition it came back, is on
-- record instead of being inferred from queue_entries.assigned_bike_id.
--
-- ADDITIVE ONLY. No existing column is altered or dropped. The tables and the
-- RPCs are named so they lift into the new platform untouched.
--
-- What this file does, in order:
--   1. bikes: ten new columns (NFC tag, serial, spec detail, notes, timestamps).
--   2. bikes: column-level SELECT. The table stays public-read because the
--      customer booking screen loads it, but the new columns are readable only
--      through the staff RPCs below. Postgres ignores a column REVOKE while a
--      table-level GRANT exists, so the table grant is revoked and re-granted per
--      column for anon and authenticated. Staff ARE role authenticated (Google
--      customers are too), so the staff-only path cannot be a role grant: it is
--      staff_bike_private() / staff_resolve_bike(), both gated on is_staff().
--      CLIENT CONSEQUENCE: select('*') on bikes now fails for these roles; the app
--      lists columns explicitly (loadData and the status poll). Deploy that
--      client before pushing this migration to production.
--   3. bike_assignments: the history table, staff-only, no anon policy at all.
--   4. Backfill: one open assignment per ride currently out, so a bike handed
--      over before this migration can still be returned through staff_return.
--   5. RPCs: staff_checkin, staff_return, staff_swap_bike, staff_resolve_bike,
--      staff_bike_private, staff_link_tag. Every one is SECURITY DEFINER with an
--      explicit is_staff() check as its first statement, EXECUTE revoked from
--      anon. The existing queue_entries triggers (price, approval, promo count,
--      fill status) are the guard; the RPCs satisfy them, they do not bypass them.
--   6. A trigger on queue_entries: whenever a booking leaves 'active' by ANY path
--      (the classic Return button, no-show, cancel, remove, undo check-in), every
--      open assignment on it is closed with return_condition 'auto'. Without it a
--      classic return would leave the row open and the one-open-assignment-per-bike
--      index would refuse the next staff_checkin on that bike. Same file, so there
--      is no window in which new check-ins can outrun old-style returns.
--
-- Rollback (in this order):
--   drop function if exists public.staff_checkin(text,text);
--   drop function if exists public.staff_return(text,text,text);
--   drop function if exists public.staff_swap_bike(text,text);
--   drop function if exists public.staff_resolve_bike(text);
--   drop function if exists public.staff_bike_private(text);
--   drop function if exists public.staff_link_tag(text,text);
--   drop trigger if exists queue_entries_close_assignments on public.queue_entries;
--   drop function if exists public._close_assignments_on_leave_active();
--   drop table if exists public.bike_assignments;
--   drop trigger if exists bikes_touch_updated_at on public.bikes;
--   drop function if exists public._bikes_touch_updated_at();
--   grant select on public.bikes to anon, authenticated;   -- restores select('*')
--   alter table public.bikes
--     drop column if exists tag_uid, drop column if exists serial_number,
--     drop column if exists model_year, drop column if exists wheel_size,
--     drop column if exists brake_type, drop column if exists pedal_type,
--     drop column if exists condition, drop column if exists notes,
--     drop column if exists created_at, drop column if exists updated_at;
-- Run supabase/checks/security-attributes.sql after applying (or rolling back).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. bikes: new columns ───────────────────────────────────────────────────────
alter table public.bikes
  add column if not exists tag_uid       text,          -- NFC chip UID (upper-case hex); for HID readers
  add column if not exists serial_number text,
  add column if not exists model_year    integer,
  add column if not exists wheel_size    text,
  add column if not exists brake_type    text,
  add column if not exists pedal_type    text,
  add column if not exists condition     text,
  add column if not exists notes         text,
  add column if not exists created_at    timestamptz not null default now(),
  add column if not exists updated_at    timestamptz not null default now();

create unique index if not exists bikes_tag_uid_uniq on public.bikes (tag_uid) where tag_uid is not null;

create or replace function public._bikes_touch_updated_at()
 returns trigger language plpgsql security definer set search_path to 'public'
as $$ begin new.updated_at := now(); return new; end $$;
revoke execute on function public._bikes_touch_updated_at() from public, anon, authenticated;
drop trigger if exists bikes_touch_updated_at on public.bikes;
create trigger bikes_touch_updated_at before update on public.bikes
  for each row execute function public._bikes_touch_updated_at();

-- 2. bikes: column-level SELECT ───────────────────────────────────────────────
-- Every column that existed before this migration stays readable by anon and
-- authenticated (the RLS "public read" policy is untouched); the ten new ones are
-- not. Enumerated from the live catalogue rather than a hard-coded list, so a
-- column added by an earlier hand-run script is not silently hidden.
do $$
declare c record;
begin
  revoke select on public.bikes from anon, authenticated;
  for c in
    select column_name from information_schema.columns
    where table_schema = 'public' and table_name = 'bikes'
      and column_name not in ('tag_uid','serial_number','model_year','wheel_size',
                              'brake_type','pedal_type','condition','notes',
                              'created_at','updated_at')
  loop
    execute format('grant select (%I) on public.bikes to anon, authenticated', c.column_name);
  end loop;
end $$;

-- 3. bike_assignments ─────────────────────────────────────────────────────────
create table if not exists public.bike_assignments (
  id               uuid primary key default gen_random_uuid(),
  booking_id       text not null references public.queue_entries(id) on delete cascade,
  bike_id          text not null references public.bikes(id),
  assigned_at      timestamptz not null default now(),
  assigned_by      uuid references auth.users(id) on delete set null,
  returned_at      timestamptz,
  returned_by      uuid references auth.users(id) on delete set null,
  return_condition text check (return_condition in ('ok','needs_check','damaged','swapped','auto')),
  return_notes     text
);
create index if not exists bike_assignments_booking_idx on public.bike_assignments (booking_id);
create index if not exists bike_assignments_open_bike_idx on public.bike_assignments (bike_id) where returned_at is null;
create unique index if not exists one_open_assignment_per_bike
  on public.bike_assignments (bike_id) where returned_at is null;

alter table public.bike_assignments enable row level security;
-- Staff only. No policy of any kind for anon; the default table grant is revoked
-- from anon too, so the answer to a customer session is a permission error, not
-- an empty list that invites guessing.
revoke all on public.bike_assignments from anon;
drop policy if exists "staff read"   on public.bike_assignments;
drop policy if exists "staff insert" on public.bike_assignments;
drop policy if exists "staff update" on public.bike_assignments;
drop policy if exists "staff delete" on public.bike_assignments;
create policy "staff read"   on public.bike_assignments for select using ((select is_staff()));
create policy "staff insert" on public.bike_assignments for insert with check ((select is_staff()));
create policy "staff update" on public.bike_assignments for update using ((select is_staff())) with check ((select is_staff()));
create policy "staff delete" on public.bike_assignments for delete using ((select is_admin()));

-- 3b. Leaving 'active' by any path closes the open assignment ─────────────────
-- The classic Return button, no-show, cancel, remove and undo check-in all write
-- queue_entries.status directly and know nothing about bike_assignments. AFTER UPDATE
-- so staff_return, which closes its rows with a real condition BEFORE setting the
-- status, finds nothing left for the trigger to touch.
create or replace function public._close_assignments_on_leave_active()
 returns trigger language plpgsql security definer set search_path to 'public'
as $$
begin
  update public.bike_assignments
     set returned_at = now(),
         returned_by = coalesce(returned_by, auth.uid()),
         return_condition = coalesce(return_condition, 'auto')
   where booking_id = new.id and returned_at is null;
  return new;
end $$;
revoke execute on function public._close_assignments_on_leave_active() from public, anon, authenticated;
drop trigger if exists queue_entries_close_assignments on public.queue_entries;
create trigger queue_entries_close_assignments
  after update of status on public.queue_entries
  for each row when (old.status = 'active' and new.status is distinct from 'active')
  execute function public._close_assignments_on_leave_active();

-- 4. Backfill: rides out right now get an open assignment ─────────────────────
-- assigned_bike_id is a bike id, or a JSON array of them for a multi-bike booking.
insert into public.bike_assignments (booking_id, bike_id, assigned_at)
select q.id, b.id,
       case when q.checked_in_at ~ '^\d{4}-\d{2}-\d{2}T' then q.checked_in_at::timestamptz else now() end
from public.queue_entries q
join public.bikes b on b.id = q.assigned_bike_id
where q.status = 'active' and q.assigned_bike_id is not null and q.assigned_bike_id not like '[%'
on conflict (bike_id) where returned_at is null do nothing;

insert into public.bike_assignments (booking_id, bike_id, assigned_at)
select q.id, b.id,
       case when q.checked_in_at ~ '^\d{4}-\d{2}-\d{2}T' then q.checked_in_at::timestamptz else now() end
from public.queue_entries q
cross join lateral jsonb_array_elements_text(q.assigned_bike_id::jsonb) as arr(bike_id)
join public.bikes b on b.id = arr.bike_id
where q.status = 'active' and q.assigned_bike_id like '[%'
on conflict (bike_id) where returned_at is null do nothing;

-- 5. RPCs ─────────────────────────────────────────────────────────────────────
-- Timestamps on queue_entries are ISO text with a Z, as the client writes them.
create or replace function public._iso_now()
 returns text language sql stable security definer set search_path to 'public'
as $$ select to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'); $$;
revoke execute on function public._iso_now() from public, anon, authenticated;

-- staff_checkin(p_booking_id, p_bike_id)
--   waiting/waitlist -> active, bike available -> in-use, one assignment row.
--   Idempotent: the same booking + bike again is a no-op success. A booking already
--   active on ANOTHER bike is refused (that is a swap). Lock order everywhere in this
--   file: booking row first, then bike rows by id.
create or replace function public.staff_checkin(p_booking_id text, p_bike_id text)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare q public.queue_entries%rowtype; b public.bikes%rowtype; a_id uuid; holder text;
begin
  if not is_staff() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;

  select * into q from public.queue_entries where id = p_booking_id for update;
  if not found then raise exception 'BOOKING_NOT_FOUND: no booking %', p_booking_id; end if;
  select * into b from public.bikes where id = p_bike_id for update;
  if not found then raise exception 'BIKE_NOT_FOUND: no bike %', p_bike_id; end if;

  if q.status = 'active' then
    if exists (select 1 from public.bike_assignments where booking_id = q.id and bike_id = b.id and returned_at is null) then
      return jsonb_build_object('ok', true, 'noop', true);
    end if;
    if q.assigned_bike_id = b.id then
      -- checked in before this migration on this very bike: record it, then it is a no-op
      insert into public.bike_assignments (booking_id, bike_id, assigned_by) values (q.id, b.id, auth.uid())
      on conflict (bike_id) where returned_at is null do nothing;
      return jsonb_build_object('ok', true, 'noop', true);
    end if;
    raise exception 'BAD_BOOKING_STATE: #% is already on another bike - use staff_swap_bike', coalesce(q.queue_num::text, q.id);
  end if;
  if q.status not in ('waiting','waitlist') then
    raise exception 'BAD_BOOKING_STATE: #% is %, not waiting', coalesce(q.queue_num::text, q.id), q.status;
  end if;

  if b.status <> 'available' then
    select e.name into holder from public.bike_assignments ba join public.queue_entries e on e.id = ba.booking_id
      where ba.bike_id = b.id and ba.returned_at is null limit 1;
    raise exception 'BIKE_UNAVAILABLE: bike % is %%', coalesce(b.bike_number::text, b.name), b.status,
      case when holder is not null then ' (with ' || holder || ')' else '' end;
  end if;

  update public.bikes set status = 'in-use' where id = b.id;
  update public.queue_entries
     set status = 'active', assigned_bike_id = b.id, checked_in_at = public._iso_now()
   where id = q.id;
  insert into public.bike_assignments (booking_id, bike_id, assigned_by)
    values (q.id, b.id, auth.uid()) returning id into a_id;
  return jsonb_build_object('ok', true, 'noop', false, 'assignment_id', a_id);
end $$;
revoke execute on function public.staff_checkin(text,text) from public, anon;
grant execute on function public.staff_checkin(text,text) to authenticated;

-- staff_return(p_booking_id, p_return_condition, p_notes)
--   active -> done; every open assignment on the booking is closed; each bike goes
--   back to available, or to maintenance (dated today, as the register does) when the
--   condition is 'damaged'. A booking already done with nothing open is a no-op.
create or replace function public.staff_return(p_booking_id text, p_return_condition text default 'ok', p_notes text default null)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $$
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
end $$;
revoke execute on function public.staff_return(text,text,text) from public, anon;
grant execute on function public.staff_return(text,text,text) to authenticated;

-- staff_swap_bike(p_booking_id, p_new_bike_id)
--   For a wrong or faulty bike before the ride: the open assignment closes as 'swapped',
--   the old bike is freed, the new one claimed and assigned. Same bike again is a no-op.
create or replace function public.staff_swap_bike(p_booking_id text, p_new_bike_id text)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare q public.queue_entries%rowtype; nb public.bikes%rowtype; bid text; a_id uuid;
begin
  if not is_staff() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;

  select * into q from public.queue_entries where id = p_booking_id for update;
  if not found then raise exception 'BOOKING_NOT_FOUND: no booking %', p_booking_id; end if;
  if q.status <> 'active' then
    raise exception 'BAD_BOOKING_STATE: #% is %, not on a bike', coalesce(q.queue_num::text, q.id), q.status;
  end if;
  if exists (select 1 from public.bike_assignments where booking_id = q.id and bike_id = p_new_bike_id and returned_at is null) then
    return jsonb_build_object('ok', true, 'noop', true);
  end if;

  -- old bikes first (lower ids lock first), then the new one, all by id order
  for bid in
    select distinct x.bike_id from (
      select bike_id from public.bike_assignments where booking_id = q.id and returned_at is null
      union
      select q.assigned_bike_id where q.assigned_bike_id is not null and q.assigned_bike_id not like '[%'
      union
      select arr from jsonb_array_elements_text(case when q.assigned_bike_id like '[%' then q.assigned_bike_id::jsonb else '[]'::jsonb end) as arr
    ) x where x.bike_id <> p_new_bike_id order by 1
  loop
    perform 1 from public.bikes where id = bid for update;
    update public.bikes set status = 'available' where id = bid and status = 'in-use';
  end loop;
  update public.bike_assignments
     set returned_at = now(), returned_by = auth.uid(), return_condition = 'swapped'
   where booking_id = q.id and returned_at is null;

  select * into nb from public.bikes where id = p_new_bike_id for update;
  if not found then raise exception 'BIKE_NOT_FOUND: no bike %', p_new_bike_id; end if;
  if nb.status <> 'available' then
    raise exception 'BIKE_UNAVAILABLE: bike % is %', coalesce(nb.bike_number::text, nb.name), nb.status;
  end if;
  update public.bikes set status = 'in-use' where id = nb.id;
  update public.queue_entries set assigned_bike_id = nb.id where id = q.id;
  insert into public.bike_assignments (booking_id, bike_id, assigned_by)
    values (q.id, nb.id, auth.uid()) returning id into a_id;
  return jsonb_build_object('ok', true, 'noop', false, 'assignment_id', a_id);
end $$;
revoke execute on function public.staff_swap_bike(text,text) from public, anon;
grant execute on function public.staff_swap_bike(text,text) to authenticated;

-- staff_resolve_bike(p_code)
--   One lookup for everything the Bike field can receive: a bike number typed on the
--   keypad or carried by /?bike=042, a bike id, or an NFC tag UID from a HID reader.
--   Returns the spec line's ingredients plus who has the bike if it is out.
create or replace function public.staff_resolve_bike(p_code text)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare code text := trim(coalesce(p_code, '')); b public.bikes%rowtype; holder record;
begin
  if not is_staff() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if code = '' then return jsonb_build_object('found', false); end if;

  if code ~ '^\d{1,4}$' then
    select * into b from public.bikes where bike_number = code::int and status <> 'retired' limit 1;
  end if;
  if b.id is null then
    select * into b from public.bikes where id = code limit 1;
  end if;
  if b.id is null then
    select * into b from public.bikes where upper(tag_uid) = upper(regexp_replace(code, '[^0-9A-Za-z]', '', 'g')) limit 1;
  end if;
  if b.id is null then return jsonb_build_object('found', false); end if;

  select e.name, ba.assigned_at into holder
    from public.bike_assignments ba join public.queue_entries e on e.id = ba.booking_id
   where ba.bike_id = b.id and ba.returned_at is null limit 1;

  return jsonb_build_object(
    'found', true,
    'bike', jsonb_build_object(
      'id', b.id, 'name', b.name, 'bike_number', b.bike_number, 'type', b.type, 'size', b.size,
      'status', b.status, 'frame_type', b.frame_type, 'brand', b.brand, 'model', b.model,
      'groupset', b.groupset, 'colors', b.colors, 'color_names', b.color_names,
      'tag_uid', b.tag_uid, 'serial_number', b.serial_number, 'model_year', b.model_year,
      'wheel_size', b.wheel_size, 'brake_type', b.brake_type, 'pedal_type', b.pedal_type,
      'condition', b.condition, 'notes', b.notes),
    'rented_to', case when holder.name is null then null
                 else jsonb_build_object('name', holder.name, 'since', holder.assigned_at) end);
end $$;
revoke execute on function public.staff_resolve_bike(text) from public, anon;
grant execute on function public.staff_resolve_bike(text) to authenticated;

-- staff_bike_private(p_bike_id)
--   The ten staff-only columns, for one bike or the whole register (null).
create or replace function public.staff_bike_private(p_bike_id text default null)
 returns table (id text, tag_uid text, serial_number text, model_year integer, wheel_size text,
                brake_type text, pedal_type text, condition text, notes text,
                created_at timestamptz, updated_at timestamptz)
 language plpgsql security definer set search_path to 'public'
as $$
begin
  if not is_staff() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  return query
    select b.id, b.tag_uid, b.serial_number, b.model_year, b.wheel_size, b.brake_type, b.pedal_type,
           b.condition, b.notes, b.created_at, b.updated_at
      from public.bikes b
     where p_bike_id is null or b.id = p_bike_id;
end $$;
revoke execute on function public.staff_bike_private(text) from public, anon;
grant execute on function public.staff_bike_private(text) to authenticated;

-- staff_link_tag(p_bike_id, p_tag_uid)
--   "Link this tag to bike 042": stores the normalised UID; a UID already on another
--   bike is refused by name. An empty UID clears the link.
create or replace function public.staff_link_tag(p_bike_id text, p_tag_uid text)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare uid text := nullif(upper(regexp_replace(coalesce(p_tag_uid, ''), '[^0-9A-Za-z]', '', 'g')), ''); other record;
begin
  if not is_staff() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if not exists (select 1 from public.bikes where id = p_bike_id) then
    raise exception 'BIKE_NOT_FOUND: no bike %', p_bike_id;
  end if;
  if uid is not null then
    select id, bike_number, name into other from public.bikes where upper(tag_uid) = uid and id <> p_bike_id limit 1;
    if other.id is not null then
      raise exception 'TAG_IN_USE: that tag is on bike %', coalesce(other.bike_number::text, other.name);
    end if;
  end if;
  update public.bikes set tag_uid = uid where id = p_bike_id;
  return jsonb_build_object('ok', true, 'tag_uid', uid);
end $$;
revoke execute on function public.staff_link_tag(text,text) from public, anon;
grant execute on function public.staff_link_tag(text,text) to authenticated;
