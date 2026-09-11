-- RPC checks for 20260911120000_bike_assignments_and_staff_checkin.sql.
-- Run on STAGING after the migration (SQL editor or psql). Everything happens inside
-- one transaction that is rolled back at the end: no row survives, no matter what.
-- Prints one NOTICE per passing check and raises on the first failure.
--
-- Covers: happy path (waiting -> active, bike -> in-use, one open assignment),
-- idempotent double call, a bike already in use, swap closes the old assignment,
-- return frees the bike / damaged sends it to maintenance, a CLASSIC return (direct
-- status write) closes the assignment through the trigger so the bike can go out again,
-- resolve by number and tag, and every RPC refuses a
-- non-staff caller and an anon session cannot read bike_assignments or the private
-- bike columns.
begin;

-- Fixtures, created as the table owner so RLS is not in the way yet.
create temp table _t (k text primary key, v text) on commit drop;
insert into _t values
  ('staff_uid', (select user_id::text from public.staff limit 1)),
  ('sess', 'chk-' || to_char(now(), 'YYYYMMDDHH24MISS')),
  ('b1', 'chk-bike-1-' || substr(md5(random()::text), 1, 6)),
  ('b2', 'chk-bike-2-' || substr(md5(random()::text), 1, 6)),
  ('q1', 'chk-q1-' || substr(md5(random()::text), 1, 8)),
  ('q2', 'chk-q2-' || substr(md5(random()::text), 1, 8)),
  ('q3', 'chk-q3-' || substr(md5(random()::text), 1, 8));

do $$ begin
  if (select v from _t where k = 'staff_uid') is null then
    raise exception 'no staff row to impersonate - add a staff user first';
  end if;
end $$;

insert into public.sessions (id, day, session_date, capacity, status, created_at)
  values ((select v from _t where k = 'sess'), 'Tuesday', '2099-01-05', 5, 'open', now()::text);
insert into public.bikes (id, name, size, type, colors, status, bike_number, tag_uid)
  values ((select v from _t where k = 'b1'), 'Check bike 1', 'M', 'Road', '[]', 'available', 9901, 'CHK04A1B2C3D4E5'),
         ((select v from _t where k = 'b2'), 'Check bike 2', 'M', 'Road', '[]', 'available', 9902, null);
insert into public.queue_entries (id, name, size, type_preference, paid, price, session_id, session_day, session_date, status, registered_at, walk_in)
  values ((select v from _t where k = 'q1'), 'Check Rider One', 'M', 'Road', false, 30, (select v from _t where k = 'sess'), 'Tuesday', '2099-01-05', 'waiting', now()::text, true),
         ((select v from _t where k = 'q2'), 'Check Rider Two', 'M', 'Road', false, 30, (select v from _t where k = 'sess'), 'Tuesday', '2099-01-05', 'waiting', now()::text, true),
         ((select v from _t where k = 'q3'), 'Check Rider Three', 'M', 'Road', false, 30, (select v from _t where k = 'sess'), 'Tuesday', '2099-01-05', 'waiting', now()::text, true);

-- ── Act as a staff member (role authenticated, JWT sub = a real staff user_id) ──
select set_config('request.jwt.claims', json_build_object('sub', (select v from _t where k = 'staff_uid'), 'role', 'authenticated')::text, true);
set local role authenticated;

do $$
declare r jsonb; q1 text := (select v from _t where k = 'q1'); b1 text := (select v from _t where k = 'b1');
begin
  r := public.staff_checkin(q1, b1);
  if not (r->>'ok')::bool or (r->>'noop')::bool then raise exception 'checkin: expected ok, non-noop, got %', r; end if;
  if (select status from public.queue_entries where id = q1) <> 'active' then raise exception 'checkin: booking not active'; end if;
  if (select assigned_bike_id from public.queue_entries where id = q1) <> b1 then raise exception 'checkin: assigned_bike_id not written'; end if;
  if (select checked_in_at from public.queue_entries where id = q1) !~ '^\d{4}-\d{2}-\d{2}T.*Z$' then raise exception 'checkin: checked_in_at not ISO Z text'; end if;
  if (select status from public.bikes where id = b1) <> 'in-use' then raise exception 'checkin: bike not in-use'; end if;
  if (select count(*) from public.bike_assignments where booking_id = q1 and returned_at is null) <> 1 then raise exception 'checkin: expected one open assignment'; end if;
  raise notice 'PASS checkin happy path';

  r := public.staff_checkin(q1, b1);
  if not (r->>'noop')::bool then raise exception 'checkin twice: expected noop, got %', r; end if;
  if (select count(*) from public.bike_assignments where booking_id = q1) <> 1 then raise exception 'checkin twice: duplicated the assignment'; end if;
  raise notice 'PASS checkin is idempotent';
end $$;

do $$
declare q2 text := (select v from _t where k = 'q2'); b1 text := (select v from _t where k = 'b1');
begin
  begin
    perform public.staff_checkin(q2, b1);
    raise exception 'in-use bike: expected BIKE_UNAVAILABLE, got success';
  exception when others then
    if sqlerrm not like 'BIKE_UNAVAILABLE%' then raise; end if;
    if sqlerrm not like '%Check Rider One%' then raise exception 'in-use bike: message should name the holder, got %', sqlerrm; end if;
  end;
  if (select status from public.queue_entries where id = q2) <> 'waiting' then raise exception 'in-use bike: second booking must stay waiting'; end if;
  raise notice 'PASS bike already in use is refused and names the rider';
end $$;

do $$
declare r jsonb; q1 text := (select v from _t where k = 'q1'); b1 text := (select v from _t where k = 'b1'); b2 text := (select v from _t where k = 'b2');
begin
  r := public.staff_swap_bike(q1, b2);
  if (r->>'noop')::bool then raise exception 'swap: expected a real swap, got %', r; end if;
  if (select return_condition from public.bike_assignments where booking_id = q1 and bike_id = b1) <> 'swapped' then raise exception 'swap: old assignment not closed as swapped'; end if;
  if (select status from public.bikes where id = b1) <> 'available' then raise exception 'swap: old bike not freed'; end if;
  if (select status from public.bikes where id = b2) <> 'in-use' then raise exception 'swap: new bike not in-use'; end if;
  if (select assigned_bike_id from public.queue_entries where id = q1) <> b2 then raise exception 'swap: assigned_bike_id not moved'; end if;
  if (select count(*) from public.bike_assignments where booking_id = q1 and returned_at is null) <> 1 then raise exception 'swap: expected exactly one open assignment'; end if;
  r := public.staff_swap_bike(q1, b2);
  if not (r->>'noop')::bool then raise exception 'swap same bike: expected noop'; end if;
  raise notice 'PASS swap closes the old assignment and claims the new bike';
end $$;

do $$
declare r jsonb; q1 text := (select v from _t where k = 'q1'); b2 text := (select v from _t where k = 'b2');
begin
  r := public.staff_return(q1, 'damaged', 'bent derailleur');
  if (select status from public.queue_entries where id = q1) <> 'done' then raise exception 'return: booking not done'; end if;
  if (select checked_out_at from public.queue_entries where id = q1) is null then raise exception 'return: checked_out_at not stamped'; end if;
  if (select status from public.bikes where id = b2) <> 'maintenance' then raise exception 'return damaged: bike should be in maintenance'; end if;
  if (select retired_date from public.bikes where id = b2) <> current_date::text then raise exception 'return damaged: retired_date should be today'; end if;
  if (select return_notes from public.bike_assignments where booking_id = q1 and bike_id = b2) <> 'bent derailleur' then raise exception 'return: notes not stored'; end if;
  if exists (select 1 from public.bike_assignments where booking_id = q1 and returned_at is null) then raise exception 'return: an assignment is still open'; end if;
  r := public.staff_return(q1, 'ok', null);
  if not (r->>'noop')::bool then raise exception 'return twice: expected noop'; end if;
  raise notice 'PASS return closes the assignment; damaged goes to maintenance; second return is a noop';
end $$;

do $$
declare r jsonb; b1 text := (select v from _t where k = 'b1');
begin
  r := public.staff_resolve_bike('9901');
  if not (r->>'found')::bool or r->'bike'->>'id' <> b1 then raise exception 'resolve by number failed: %', r; end if;
  r := public.staff_resolve_bike('chk-04a1-b2c3 d4e5');
  if not (r->>'found')::bool or r->'bike'->>'id' <> b1 then raise exception 'resolve by tag uid (normalised) failed: %', r; end if;
  r := public.staff_resolve_bike('nope');
  if (r->>'found')::bool then raise exception 'resolve unknown should not find'; end if;
  begin
    perform public.staff_link_tag((select v from _t where k = 'b2'), 'CHK04A1B2C3D4E5');
    raise exception 'link_tag: expected TAG_IN_USE';
  exception when others then if sqlerrm not like 'TAG_IN_USE%' then raise; end if; end;
  raise notice 'PASS resolve by number and tag; a tag on another bike is refused';
end $$;

-- The classic Return button writes status = 'done' straight to queue_entries and frees the
-- bike itself; the trigger must close the open assignment, or the next staff_checkin on
-- that bike hits the one-open-assignment-per-bike index.
do $$
declare r jsonb; q2 text := (select v from _t where k = 'q2'); q3 text := (select v from _t where k = 'q3'); b1 text := (select v from _t where k = 'b1');
begin
  r := public.staff_checkin(q2, b1);
  if (select count(*) from public.bike_assignments where bike_id = b1 and returned_at is null) <> 1 then raise exception 'classic: expected one open assignment on b1'; end if;
  update public.queue_entries set status = 'done' where id = q2;      -- what doReturn() writes
  update public.bikes set status = 'available' where id = b1;          -- and the bike it frees
  if (select return_condition from public.bike_assignments where booking_id = q2 and bike_id = b1) <> 'auto' then raise exception 'classic return: assignment not closed as auto'; end if;
  if exists (select 1 from public.bike_assignments where bike_id = b1 and returned_at is null) then raise exception 'classic return: b1 still has an open assignment'; end if;
  r := public.staff_checkin(q3, b1);
  if (r->>'noop')::bool or (select status from public.queue_entries where id = q3) <> 'active' then raise exception 'after classic return: staff_checkin on the same bike failed: %', r; end if;
  update public.queue_entries set status = 'noshow' where id = q3;    -- and any other way out of active
  if exists (select 1 from public.bike_assignments where bike_id = b1 and returned_at is null) then raise exception 'leaving active via noshow: assignment still open'; end if;
  update public.bikes set status = 'available' where id = b1;
  raise notice 'PASS a classic return closes the assignment (auto) and the bike can be checked out again';
end $$;

-- ── Act as a signed-in NON-staff user: every RPC must refuse ──
select set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid()::text, 'role', 'authenticated')::text, true);
do $$
declare fn text; q2 text := (select v from _t where k = 'q2'); b1 text := (select v from _t where k = 'b1');
begin
  foreach fn in array array['checkin','return','swap','resolve','private','link'] loop
    begin
      case fn
        when 'checkin' then perform public.staff_checkin(q2, b1);
        when 'return'  then perform public.staff_return(q2, 'ok', null);
        when 'swap'    then perform public.staff_swap_bike(q2, b1);
        when 'resolve' then perform public.staff_resolve_bike('9901');
        when 'private' then perform * from public.staff_bike_private(null);
        when 'link'    then perform public.staff_link_tag(b1, 'ABC');
      end case;
      raise exception 'non-staff % : expected FORBIDDEN, got success', fn;
    exception when others then
      if sqlerrm <> 'FORBIDDEN' then raise; end if;
    end;
  end loop;
  if (select count(*) from public.bike_assignments) <> 0 then raise exception 'non-staff can read bike_assignments'; end if;
  raise notice 'PASS non-staff caller is refused by all six RPCs and sees no assignments';
end $$;

-- ── Anon: no assignments, and the private bike columns are not selectable ──
set local role anon;
do $$
begin
  begin
    perform tag_uid from public.bikes limit 1;
    raise exception 'anon can select bikes.tag_uid';
  exception when insufficient_privilege then null; end;
  begin
    perform * from public.bike_assignments limit 1;
    raise exception 'anon can select bike_assignments';
  exception when insufficient_privilege then null; end;
  perform id, name, status, type, size, bike_number from public.bikes limit 1; -- the public columns still read
  raise notice 'PASS anon cannot read private columns or assignments; public columns still read';
end $$;

rollback;
