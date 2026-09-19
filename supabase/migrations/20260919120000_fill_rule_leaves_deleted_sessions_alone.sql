-- ============================================================================
-- Review fix, 2026-09-19: the fill rule stops resurrecting a deleted session,
-- and the last of the _ac marker goes.
--
-- _session_fill_status() moves a session between 'open' and 'full' as bookings come and
-- go. It only ever stood back for a session a person had CLOSED. A session a person
-- DELETED is 'deleted', which is neither, so the next booking that changed on it - a
-- cancellation, a rider edited at the desk - dropped the live count below capacity and the
-- rule wrote 'open' over the delete. The night came back into the customer wizard and into
-- every staff picker, with its old bookings, and nobody had asked for it.
--
-- The rule now only writes to a session that is already 'open' or 'full'. Those two are the
-- only states it owns; every other one is a person's decision, and it stays out of them.
--
-- _rider_session_open() still treated 'closed' plus an _ac marker in bike_slots as open,
-- from when the rule closed a full Petromin night itself. Since 20260916200000 the rule
-- marks 'full' like every other ride, that migration cleared every marker, and nothing
-- writes one any more, so the branch can only misread a night a person closed on purpose.
--
-- Rollback: re-run 20260916200000 (_session_fill_status) and 20260916193000
-- (_rider_session_open).
-- ============================================================================

CREATE OR REPLACE FUNCTION public._session_fill_status()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare _sid text; _cap int; _live int; _appr boolean; _st text; _petro boolean;
begin
  _sid := coalesce(new.session_id, old.session_id);
  if _sid is null then return null; end if;

  select coalesce(s.capacity,12), coalesce(s.needs_approval,false), coalesce(s.status,''),
         (coalesce(s.event_kind,'') = 'community' and coalesce(s.ride_kind,'') = 'petromin')
    into _cap, _appr, _st, _petro
    from sessions s where s.id = _sid;

  -- No such session, an approval ride, or a status this rule does not own. 'open' and 'full'
  -- are the two it moves between; 'closed', 'deleted' and anything added later are a
  -- person's decision, and writing over one of those un-deletes a night nobody asked for.
  if not found or _appr or _st not in ('open','full') then return null; end if;

  -- Exactly _capacity_guard's count: waitlist rows included, own-bike riders too on the
  -- Petromin ride.
  select count(*) into _live
    from queue_entries q
   where q.session_id = _sid
     and coalesce(q.status,'') not in ('cancelled','removed','noshow')
     and (_petro or coalesce(q.type_preference,'') <> 'Own');

  if _live >= _cap and _st <> 'full' then
    update sessions set status = 'full' where id = _sid;
  elsif _live < _cap and _st <> 'open' then
    update sessions set status = 'open' where id = _sid;
  end if;

  return null;
end $function$;

-- ── The last of the _ac marker ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._rider_session_open(s sessions)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
begin
  return s.status = 'open' or s.status = 'full';
end $function$;
