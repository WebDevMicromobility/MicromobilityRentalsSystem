-- ============================================================================
-- MicroMobility Rentals — database fixes (SAFE TO RUN ANY TIME, including live)
-- Paste the whole file into the Supabase SQL editor and run once. Idempotent.
--
-- These accompany the app-code bug-fix batch (service worker mmcq-v186). None of
-- them tighten access or change reads, so they cannot break live bookings:
--   A. Queue-number triggers  — put the already-live triggers into version control
--   B. Multi-bike FK drop      — lets a check-in store several bikes on one booking
--   C. Orphan cleanup          — removes dead rows pointing at deleted sessions
-- The RLS/security lockdown is a SEPARATE file (security-lockdown.sql) — do NOT
-- run that one mid-event; it is staging-first.
-- ============================================================================

-- ── A. Queue-number assignment triggers ────────────────────────────────────
-- These already exist in production (added by hand during an incident). Kept here
-- so a rebuild from SQL recreates them. create-or-replace = safe to re-run.
alter table sessions add column if not exists last_qnum integer;

create or replace function assign_queue_num()
returns trigger language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  -- Per-session monotonic counter under the session row lock: two concurrent inserts
  -- serialise and each gets a unique number. Never reused (counter only climbs), so
  -- cancelled numbers leave permanent gaps — which is the intended behaviour.
  update sessions
     set last_qnum = greatest(coalesce(last_qnum, 0),
                              coalesce((select max(queue_num) from queue_entries
                                         where session_id = new.session_id), 0)) + 1
   where id = new.session_id
   returning last_qnum into n;
  if n is not null then new.queue_num := n; end if;  -- unknown session: keep client value
  return new;
end $$;

drop trigger if exists queue_entries_assign_qnum on queue_entries;
create trigger queue_entries_assign_qnum
  before insert on queue_entries
  for each row execute function assign_queue_num();

create or replace function queue_num_update_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  -- If an UPDATE moves a booking onto a number a LIVE row already holds (e.g. a stale
  -- cached device), hand it the next safe number instead of raising a unique-violation.
  if new.queue_num is distinct from old.queue_num then
    if exists (select 1 from queue_entries
                where session_id = new.session_id
                  and queue_num  = new.queue_num
                  and id <> new.id
                  and status not in ('cancelled','removed','noshow')) then
      update sessions
         set last_qnum = greatest(coalesce(last_qnum, 0),
                                  coalesce((select max(queue_num) from queue_entries
                                             where session_id = new.session_id), 0)) + 1
       where id = new.session_id
       returning last_qnum into n;
      if n is not null then new.queue_num := n; end if;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists queue_entries_qnum_update_guard on queue_entries;
create trigger queue_entries_qnum_update_guard
  before update on queue_entries
  for each row execute function queue_num_update_guard();

-- ── B. Multi-bike: allow several bikes on one booking ──────────────────────
-- assigned_bike_id has a scalar foreign key, which rejected the JSON-array write a
-- multi-bike check-in produces (so extra bikes were silently lost on reload). The app
-- parses a JSON array here (getAssignedBikeIds), so drop the scalar FK. Single-bike
-- check-ins keep writing a plain id; the app validates the ids itself.
alter table queue_entries drop constraint if exists queue_entries_assigned_bike_id_fkey;

-- ── C. Remove orphan bookings pointing at deleted sessions ─────────────────
-- 23 dead rows (all on sessions that were deleted via the old re-id/nuke paths). They
-- are unreachable in the UI (no session to show them under). All are cancelled/removed
-- or a lone leftover on a long-past deleted session.
delete from queue_entries q
 where not exists (select 1 from sessions s where s.id = q.session_id);

-- ── Verify ──────────────────────────────────────────────────────────────────
select
  (select count(*) from pg_trigger where tgname in ('queue_entries_assign_qnum','queue_entries_qnum_update_guard')) as triggers_present,   -- expect 2
  (select count(*) from pg_constraint where conname = 'queue_entries_assigned_bike_id_fkey') as bike_fk_remaining,                          -- expect 0
  (select count(*) from queue_entries q where not exists (select 1 from sessions s where s.id = q.session_id)) as orphans_remaining;         -- expect 0
