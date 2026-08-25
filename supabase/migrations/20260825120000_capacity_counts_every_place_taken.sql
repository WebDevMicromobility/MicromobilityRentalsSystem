-- ─────────────────────────────────────────────────────────────────────────────
-- A session's capacity means what staff typed: a place is held right through the
-- ride, and given back only when the booking ends without a bike going out.
--
-- The guard counted `status in ('waiting','active')`, so a place quietly reappeared
-- the moment a rider FINISHED — and again if they were marked no-show. On a busy
-- evening that is a steady drip of phantom vacancies: riders keep being accepted as
-- 'waiting' well past the number of bikes staff put out, the waitlist "starts late",
-- and the session ends up serving more people than it has bikes for.
--
-- The honest count is every booking that still holds its place: everything except
-- cancelled, removed and no-show. Checking in does not release a place and neither
-- does finishing — that is the leak. A no-show does release it: the rider never took
-- a bike out, and should not hold one hostage while somebody at the desk wants it.
-- That is the rule the client applies too (_holdsSpot), and the two must agree or the
-- form and the server disagree about who is next.
--
-- Own-bike riders stay outside the count, unchanged: a place allocates a
-- Micromobility bike and someone riding their own takes none.
--
-- needs_approval rides are still exempt, unchanged: staff pick those riders by hand,
-- so the capacity number means nothing there.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public._capacity_guard()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare cap int; live int;
begin
  if new.status='waiting' and coalesce(new.type_preference,'')<>'Own' and not is_staff() then
    select coalesce(s.capacity,12) into cap from sessions s
      where s.id=new.session_id and coalesce(s.needs_approval,false)=false;
    if cap is not null then
      perform pg_advisory_xact_lock(hashtext('cap:'||new.session_id));
      select count(*) into live from queue_entries q
        where q.session_id=new.session_id
          and coalesce(q.status,'') not in ('cancelled','removed','noshow')
          and coalesce(q.type_preference,'')<>'Own';
      if live>=cap then new.status:='waitlist'; end if;
    end if;
  end if;
  return new;
end$function$;
