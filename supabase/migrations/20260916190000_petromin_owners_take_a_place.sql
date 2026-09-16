-- ─────────────────────────────────────────────────────────────────────────────
-- On the Petromin ride, a rider on their own bike takes a place.
--
-- Everywhere else a place allocates a Micromobility bike, so an owner takes none
-- (20260825120000_capacity_counts_every_place_taken). The Petromin ride's places
-- are the track's, not the rack's: the venue admits N riders, and an owner is one
-- of them. So there, and only there, own-bike rows count against capacity in
-- both triggers -- the guard that waitlists a booking, and the rule that marks
-- the session full.
--
-- The fill rule also behaves differently on the Petromin ride: it writes
-- 'closed' rather than 'full', and leaves an _ac marker in bike_slots so it can
-- tell its own close from a person's and undo it when a place frees. A close a
-- person made (no marker) still outranks the rule.
--
-- These two definitions were applied to production directly on 2026-09-16 and
-- found there; this file records them so the repo describes the live database.
-- The client applies the same test (_ownTakesPlace / _holdsSpot in app.src.html).
--
-- Rollback: re-run 20260825120000 and 20260903140000.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public._capacity_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
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
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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
