-- Server-side capacity: a NON-STAFF booking inserted as 'waiting' into a full JCC session
-- is coerced to 'waitlist' (never rejected, so stale clients keep working; staff overbook
-- deliberately and stay exempt; community sessions are approval-gated instead).
-- Runs BEFORE wl_num_assign_ins (name order), so a coerced row still gets its W-number.
-- Run in the Supabase SQL editor. Idempotent.
create or replace function _capacity_guard() returns trigger language plpgsql as $$
declare cap int; live int;
begin
  if new.status='waiting' and not is_staff() then
    select coalesce(s.capacity,12) into cap from sessions s
      where s.id=new.session_id and coalesce(s.event_kind,'')<>'community';
    if cap is not null then
      perform pg_advisory_xact_lock(hashtext('cap:'||new.session_id));
      select count(*) into live from queue_entries q
        where q.session_id=new.session_id and q.status in ('waiting','active');
      if live>=cap then new.status:='waitlist'; end if;
    end if;
  end if;
  return new;
end$$;

drop trigger if exists queue_entries_capacity on queue_entries;
create trigger queue_entries_capacity before insert on queue_entries
  for each row execute function _capacity_guard();
