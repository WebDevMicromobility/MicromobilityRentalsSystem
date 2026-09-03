-- ─────────────────────────────────────────────────────────────────────────────
-- A session marks itself Fully Booked, and re-opens itself.
--
-- Staff have always done this by hand ("Mark Full" / "Re-open"). Doing it by
-- hand means the window between the last bike going and somebody noticing is
-- however long it takes somebody to notice, and in that window the session
-- still reads Open to every rider looking at it.
--
-- The rule, which is the one the capacity guard already applies to bookings:
--
--   live rows >= capacity  ->  full
--   live rows <  capacity  ->  open
--
-- "Live" is exactly _capacity_guard's count -- not cancelled/removed/noshow,
-- and not an own-bike rider, who takes no bike. WAITLIST ROWS COUNT, which is
-- what makes the reopen behave: a spot freed while somebody is waiting is
-- taken by the promotion (_promote_next_waitlist), the count does not drop
-- below capacity, and the session stays full. It re-opens only when a spot
-- frees with nobody waiting for it.
--
-- WHAT IT DOES NOT TOUCH:
--   · Sessions needing approval -- the Saturday ride and the pool sessions.
--     Their spots are an allocation staff hand out, not a first-come capacity,
--     and "full" there would mean something different. Same test the capacity
--     guard uses, so the two agree about which sessions they govern.
--   · A session staff have CLOSED. A manual close outranks the rule: weather,
--     a venue problem, a decision. Nothing re-opens it but a person.
--
-- Open and Fully Booked are the rule's from here on: pressing "Re-open" on a
-- session that is genuinely full will show Open until the next booking write,
-- which will set it back. That is the rule working, not a bug -- but it is a
-- behaviour change for staff who use Re-open as a nudge.
--
-- Rollback:
--   drop trigger if exists queue_entries_fill_status on public.queue_entries;
--   drop function if exists public._session_fill_status();
--   (statuses then stay wherever they were; staff resume setting them by hand)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public._session_fill_status()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare _sid text; _cap int; _live int; _appr boolean; _st text;
begin
  _sid := coalesce(new.session_id, old.session_id);
  if _sid is null then return null; end if;

  select coalesce(s.capacity,12), coalesce(s.needs_approval,false), coalesce(s.status,'')
    into _cap, _appr, _st
    from sessions s where s.id = _sid;

  -- No such session, an approval ride, or one a person deliberately closed.
  if not found or _appr or _st = 'closed' then return null; end if;

  select count(*) into _live
    from queue_entries q
   where q.session_id = _sid
     and coalesce(q.status,'') not in ('cancelled','removed','noshow')
     and coalesce(q.type_preference,'') <> 'Own';

  if _live >= _cap and _st <> 'full' then
    update sessions set status = 'full' where id = _sid;
  elsif _live < _cap and _st <> 'open' then
    update sessions set status = 'open' where id = _sid;
  end if;

  return null;
end $function$;

-- AFTER, and row-level: the row has to have landed before it can be counted.
-- One trigger for all three verbs -- a booking arriving, a status changing, and
-- the rollback path that deletes rows outright all move the same number.
DROP TRIGGER IF EXISTS queue_entries_fill_status ON public.queue_entries;
CREATE TRIGGER queue_entries_fill_status
  AFTER INSERT OR UPDATE OR DELETE ON public.queue_entries
  FOR EACH ROW EXECUTE FUNCTION public._session_fill_status();

-- The rule is only true of sessions written to from now on, so state it once for
-- the ones that already exist. Closed sessions and approval rides are left alone,
-- exactly as the trigger leaves them.
update sessions s set status = 'full'
 where coalesce(s.needs_approval,false) = false
   and coalesce(s.status,'') = 'open'
   and (select count(*) from queue_entries q
         where q.session_id = s.id
           and coalesce(q.status,'') not in ('cancelled','removed','noshow')
           and coalesce(q.type_preference,'') <> 'Own') >= coalesce(s.capacity,12);

update sessions s set status = 'open'
 where coalesce(s.needs_approval,false) = false
   and coalesce(s.status,'') = 'full'
   and (select count(*) from queue_entries q
         where q.session_id = s.id
           and coalesce(q.status,'') not in ('cancelled','removed','noshow')
           and coalesce(q.type_preference,'') <> 'Own') < coalesce(s.capacity,12);
