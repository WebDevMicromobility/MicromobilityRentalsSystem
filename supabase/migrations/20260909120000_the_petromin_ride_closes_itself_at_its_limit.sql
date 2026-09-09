-- ─────────────────────────────────────────────────────────────────────────────
-- Petromin's Wednesdays CLOSES when it reaches its limit. It does not go Fully
-- Booked.
--
-- Fully Booked still sells: the guard rewrites the booking to `waitlist` and the
-- rider joins a queue. That is right for the circuit, where a returned bike is a
-- place somebody waiting can have. It is not what the Wednesday ride wants — at
-- its number the ride is done, and a rider who taps it should be told so rather
-- than parked in a queue that may never move. `closed` is the status that means
-- that: customer_create_booking only accepts a session that is `open` or `full`,
-- so a closed one refuses bookings outright, waitlist included.
--
-- THE HARD PART IS TELLING THE TWO CLOSES APART.
--
-- `closed` already means "a person closed this" — weather, a venue problem, a
-- decision — and 20260903140000 made that outrank the fill rule absolutely:
-- nothing re-opens it but a person. If the rule starts writing `closed` too, and
-- is also allowed to re-open one, then a cancellation on a session closed for
-- weather would put it back on sale. That is the bug this migration has to not
-- have.
--
-- So a self-close is marked: `_ac: true` in the bike_slots settings blob, written
-- with the status in the same UPDATE. It lives where `_time` and `_wl` already
-- live, so there is no column to add.
--
--   ·  rule closes it        -> status closed, _ac set
--   ·  a place frees, _ac    -> status open,   _ac cleared   (it re-opens itself)
--   ·  a place frees, no _ac -> nothing. A person closed this one.
--   ·  a person sets status  -> the client clears _ac (toggleSession), so the
--                               close becomes theirs and the rule lets it be.
--
-- STAFF CAN STILL SEAT A RIDER on a self-closed ride: staff writes never went
-- through customer_create_booking, and the client's desk pickers now offer a
-- self-closed session (_deskPickable). Same exemption staff have from the
-- capacity guard, the members gate and the two-rider cap.
--
-- SCOPE: the Petromin ride only. Every other session keeps Fully Booked exactly
-- as it was — the circuit's waitlist is the whole point of it there. A legacy
-- Petromin row sitting at `full` settles to `open` or `closed` on the next write.
--
-- The count is the one from 20260908120000, own-bike riders included.
--
-- Rollback: re-apply the body from 20260908120000, then
--   update sessions set bike_slots = (bike_slots::jsonb - '_ac')::text
--    where coalesce(nullif(bike_slots,'')::jsonb,'{}'::jsonb) ? '_ac';
--   (sessions the rule had closed stay closed; staff re-open them by hand)
--
--   NB the test is `? '_ac'`, not `bike_slots like '%_ac%'`: in LIKE the underscore is a
--   single-character WILDCARD, so that pattern matches any row with "ac" in its settings and
--   would cast rows this migration never touched.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public._session_fill_status()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare _sid text; _cap int; _live int; _appr boolean; _st text;
        _petro boolean; _raw text; _slots jsonb; _auto boolean;
begin
  _sid := coalesce(new.session_id, old.session_id);
  if _sid is null then return null; end if;

  select coalesce(s.capacity,12), coalesce(s.needs_approval,false), coalesce(s.status,''),
         (coalesce(s.event_kind,'') = 'community' and coalesce(s.ride_kind,'') = 'petromin'),
         s.bike_slots
    into _cap, _appr, _st, _petro, _raw
    from sessions s where s.id = _sid;

  -- No such session, or an approval ride: staff pick those riders by hand.
  if not found or _appr then return null; end if;

  -- Malformed settings must not take the fill rule down with them.
  begin
    _slots := coalesce(nullif(_raw,'')::jsonb, '{}'::jsonb);
  exception when others then _slots := '{}'::jsonb;
  end;
  _auto := coalesce((_slots->>'_ac')::boolean, false);

  -- A close a PERSON made outranks the rule, as it always has. Ours does not.
  if _st = 'closed' and not _auto then return null; end if;

  -- Exactly _capacity_guard's count: waitlist rows included, own-bike riders too
  -- on the Petromin ride.
  select count(*) into _live
    from queue_entries q
   where q.session_id = _sid
     and coalesce(q.status,'') not in ('cancelled','removed','noshow')
     and (_petro or coalesce(q.type_preference,'') <> 'Own');

  if _petro then
    if _live >= _cap and _st <> 'closed' then
      update sessions
         set status = 'closed',
             bike_slots = (_slots || '{"_ac":true}'::jsonb)::text
       where id = _sid;
    elsif _live < _cap and _st = 'closed' then      -- reached only when _auto
      update sessions
         set status = 'open',
             bike_slots = (_slots - '_ac')::text
       where id = _sid;
    elsif _live < _cap and _st <> 'open' then       -- a legacy 'full' row settles
      update sessions set status = 'open' where id = _sid;
    end if;
  else
    if _live >= _cap and _st <> 'full' then
      update sessions set status = 'full' where id = _sid;
    elsif _live < _cap and _st <> 'open' then
      -- A session that was Petromin when the rule closed it and is not any more: re-open it,
      -- and drop the marker with it so nothing carries a stale claim on somebody's close.
      update sessions
         set status = 'open',
             bike_slots = case when _auto then (_slots - '_ac')::text else bike_slots end
       where id = _sid;
    end if;
  end if;

  return null;
end $function$;

-- State the rule once for the Wednesday rides that already exist. Deliberately
-- narrow: only a session the rule itself had marked `full` is converted, and it
-- is marked as ours on the way. Sessions a PERSON closed are not touched — that
-- includes 2026-09-09-pw, closed by hand at the desk this morning, which must not
-- start re-opening itself.
update sessions s
   set status = 'closed',
       bike_slots = (coalesce(nullif(s.bike_slots,'')::jsonb,'{}'::jsonb) || '{"_ac":true}'::jsonb)::text
 where coalesce(s.needs_approval,false) = false
   and coalesce(s.event_kind,'') = 'community'
   and coalesce(s.ride_kind,'') = 'petromin'
   and coalesce(s.status,'') = 'full'
   and (select count(*) from queue_entries q
         where q.session_id = s.id
           and coalesce(q.status,'') not in ('cancelled','removed','noshow')) >= coalesce(s.capacity,12);
