-- ─────────────────────────────────────────────────────────────────────────────
-- Bike owners count against the limit on the Petromin Wednesday ride.
--
-- Everywhere else a place allocates a Micromobility bike, so a rider who brought
-- their own needs none and takes none: `type_preference = 'Own'` has been outside
-- the count on both sides of the wire since the seat rule was written. That is
-- still right for the circuit and for the Saturday ride.
--
-- It is wrong for Petromin's Wednesdays. The number on that session is how many
-- riders the ride can take out at all — Petromin's own limit, not a count of the
-- bikes going out — so a rider on their own bike is inside it exactly like anyone
-- else. Until now the guard waved them straight past a full ride and, worse, did
-- not count the ones already on it, so a ride "with 3 places left" could already
-- be over its limit by however many owners had booked.
--
-- WHAT CHANGES, and only on that ride:
--   · _capacity_guard      — an own-bike booking can now be moved to the waitlist,
--                            and every own-bike row already on the session counts
--                            towards the number that decides it.
--   · _session_fill_status — the same count, so Fully Booked / Open agrees with it.
-- Both keep their existing scope: approval rides are exempt, staff are exempt from
-- the capacity guard, and cancelled/removed/no-show rows never count.
--
-- WHY ride_kind, when 20260819180000 said policy should not turn on a brand name.
-- Because this rule is one the client states too, and the two MUST agree about who
-- is next (BUSINESS-RULES §4.1). The client's test is _isGroupRide — event_kind and
-- ride_kind — so this one is the same two columns. Keying it on `needs_approval =
-- false` instead would read a session the client calls Saturday as Petromin the one
-- time it matters: ride_kind and paid_ride are written in a SECOND, tolerant update
-- (app.src.html, session creation), and when that write is lost the row keeps
-- needs_approval = false while both sides read ride_kind as Saturday. Same columns,
-- same answer, including when the data is half-written.
--
-- Existing bookings are left where they are: nobody who is already on a Wednesday
-- ride is bumped to the waitlist by this. What it changes is the next booking, and
-- the session's own Open / Fully Booked flag — which the tail of this migration
-- re-settles for the Wednesday sessions that already exist, exactly as
-- 20260903140000 did when that rule was introduced.
--
-- Attributes: _capacity_guard stays INVOKER and _session_fill_status stays DEFINER,
-- both copied from the previous migration's header rather than from prosrc. Run
-- supabase/checks/security-attributes.sql afterwards — it should print nothing.
--
-- Rollback: re-apply the bodies from 20260826140000 (_capacity_guard) and
-- 20260903140000 (_session_fill_status), then re-run this file's two UPDATEs with
-- the `_own_counts` term dropped to re-settle the statuses.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public._capacity_guard()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
declare cap int; live int; _own_counts boolean;
begin
  -- A promotion moves a rider from waitlist to waiting and takes no new place:
  -- the row was already counted against capacity while it waited.
  if coalesce(current_setting('mm.promoting', true), '') = '1' then return new; end if;

  if new.status='waiting' and not is_staff() then
    -- Approval rides are exempt: staff pick those riders by hand, so the capacity
    -- number means nothing there. No row leaves cap null and nothing is metered.
    select coalesce(s.capacity,12),
           (coalesce(s.event_kind,'') = 'community' and coalesce(s.ride_kind,'') = 'petromin')
      into cap, _own_counts
      from sessions s
     where s.id = new.session_id and coalesce(s.needs_approval,false) = false;

    -- The owner walks past the count on every ride but the Petromin one.
    if cap is not null and (coalesce(new.type_preference,'') <> 'Own' or _own_counts) then
      perform pg_advisory_xact_lock(hashtext('cap:'||new.session_id));
      select count(*) into live from queue_entries q
        where q.session_id = new.session_id
          and coalesce(q.status,'') not in ('cancelled','removed','noshow')
          and (_own_counts or coalesce(q.type_preference,'') <> 'Own');
      if live >= cap then new.status := 'waitlist'; end if;
    end if;
  end if;
  return new;
end$function$;

CREATE OR REPLACE FUNCTION public._session_fill_status()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare _sid text; _cap int; _live int; _appr boolean; _st text; _own_counts boolean;
begin
  _sid := coalesce(new.session_id, old.session_id);
  if _sid is null then return null; end if;

  select coalesce(s.capacity,12), coalesce(s.needs_approval,false), coalesce(s.status,''),
         (coalesce(s.event_kind,'') = 'community' and coalesce(s.ride_kind,'') = 'petromin')
    into _cap, _appr, _st, _own_counts
    from sessions s where s.id = _sid;

  -- No such session, an approval ride, or one a person deliberately closed.
  if not found or _appr or _st = 'closed' then return null; end if;

  -- Exactly _capacity_guard's count, own-bike rule included, or the session would
  -- read Open while the guard is already waitlisting people.
  select count(*) into _live
    from queue_entries q
   where q.session_id = _sid
     and coalesce(q.status,'') not in ('cancelled','removed','noshow')
     and (_own_counts or coalesce(q.type_preference,'') <> 'Own');

  if _live >= _cap and _st <> 'full' then
    update sessions set status = 'full' where id = _sid;
  elsif _live < _cap and _st <> 'open' then
    update sessions set status = 'open' where id = _sid;
  end if;

  return null;
end $function$;

-- The rule is only true of sessions written to from now on, so state it once for the
-- ones that already exist. Only the Wednesday rides can move — everywhere else the
-- count is unchanged — and closed sessions and approval rides are left alone, exactly
-- as the trigger leaves them.
update sessions s set status = 'full'
 where coalesce(s.needs_approval,false) = false
   and coalesce(s.event_kind,'') = 'community'
   and coalesce(s.ride_kind,'') = 'petromin'
   and coalesce(s.status,'') = 'open'
   and (select count(*) from queue_entries q
         where q.session_id = s.id
           and coalesce(q.status,'') not in ('cancelled','removed','noshow')) >= coalesce(s.capacity,12);

update sessions s set status = 'open'
 where coalesce(s.needs_approval,false) = false
   and coalesce(s.event_kind,'') = 'community'
   and coalesce(s.ride_kind,'') = 'petromin'
   and coalesce(s.status,'') = 'full'
   and (select count(*) from queue_entries q
         where q.session_id = s.id
           and coalesce(q.status,'') not in ('cancelled','removed','noshow')) < coalesce(s.capacity,12);
