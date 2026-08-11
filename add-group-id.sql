-- Staff "Add group": riders added together share a group_id so the roster shows them
-- as one group even when they have different customer accounts (or none at all).
-- The app only sends group_id when set, so running the app before this migration is safe
-- (same pattern as the approval column). Run in the Supabase SQL editor.
alter table queue_entries add column if not exists group_id text;

-- JCC "Add group": one display name for the whole party (e.g. "Tamer Group"), shown on the
-- roster group block; unnamed riders fall back to "<group name> 1/2/3…".
alter table queue_entries add column if not exists group_name text;

-- Who the group's main phone number belongs to (shown next to the phone on the roster).
alter table queue_entries add column if not exists group_contact text;

-- The responsible person's own number (kept even when every rider has their own phone).
alter table queue_entries add column if not exists group_phone text;

-- Staff-only waitlist serial: per-session, assigned when a booking enters the waitlist,
-- monotonic (kept after promotion so numbers are never reused). Never shown to customers.
alter table queue_entries add column if not exists waitlist_num int;

-- Waitlist numbers are assigned client-side as a hint, but a stale device can offer a
-- number that's already taken (or none at all). This trigger makes the DB the authority:
-- on INSERT of a waitlist row, and on a row TRANSITIONING into waitlist, a missing or
-- already-taken number is replaced with session max+1. Reorder updates (status stays
-- 'waitlist') are untouched so staff drag-renumbering works. Advisory lock serializes
-- concurrent assignments within a session.
create or replace function _wl_num_assign() returns trigger language plpgsql as $$
begin
  if new.status='waitlist' then
    perform pg_advisory_xact_lock(hashtext('wlnum:'||new.session_id));
    if new.waitlist_num is null or exists(
      select 1 from queue_entries q
      where q.session_id=new.session_id and q.status='waitlist'
        and q.waitlist_num=new.waitlist_num and q.id is distinct from new.id) then
      select coalesce(max(waitlist_num),0)+1 into new.waitlist_num
      from queue_entries where session_id=new.session_id;
    end if;
  end if;
  return new;
end$$;

drop trigger if exists wl_num_assign_ins on queue_entries;
create trigger wl_num_assign_ins before insert on queue_entries
  for each row execute function _wl_num_assign();

drop trigger if exists wl_num_assign_upd on queue_entries;
create trigger wl_num_assign_upd before update on queue_entries
  for each row when (new.status='waitlist' and old.status is distinct from new.status)
  execute function _wl_num_assign();
