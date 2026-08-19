-- ─────────────────────────────────────────────────────────────────────────────
-- Four riders per account, per group ride.
--
-- The Petromin ride takes a party rather than a coach. The client caps its
-- quantity stepper at four, but a cap that lives only in the client is a
-- suggestion: the account could book four, then book four more, or post a
-- crafted request. So the rule is enforced per ROW here, which makes the two
-- readings of "four per account per booking" the same rule — the fifth rider is
-- refused whether they arrive in one booking or in a second one.
--
-- Scope: a community ride that does NOT run on approval — i.e. a seat-based
-- members-only ride, which today means the Petromin ride. Deliberately not keyed
-- on ride_kind: policy should not turn on a brand name. The Saturday ride is
-- untouched (it is one seat per member anyway, and staff pick the riders).
--
-- Staff are exempt, as with every other gate: the desk seats a group on purpose,
-- and the walk-in/add-rider paths are staff-authenticated.
--
-- Cancelled, removed and no-show rows do not count — a party that cancelled has
-- not used its allowance.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public._group_ride_cap()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare _live int;
begin
  if new.customer_id is null or (select is_staff()) then return new; end if;

  if not exists (select 1 from sessions s
                  where s.id = new.session_id
                    and s.event_kind = 'community'
                    and coalesce(s.needs_approval,false) = false) then
    return new;
  end if;

  select count(*) into _live
    from queue_entries q
   where q.session_id = new.session_id
     and q.customer_id = new.customer_id
     and coalesce(q.status,'') not in ('cancelled','removed','noshow')
     and q.id <> new.id;

  if _live >= 4 then
    raise exception 'Up to 4 riders per booking on this ride.';
  end if;

  return new;
end $function$;

-- INSERT covers a fresh booking and a second one; UPDATE covers a rider moved
-- onto the ride from another session, which is how the members gate is scoped too.
drop trigger if exists queue_entries_group_cap on queue_entries;
create trigger queue_entries_group_cap before insert on queue_entries
  for each row execute function _group_ride_cap();

drop trigger if exists queue_entries_group_cap_upd on queue_entries;
create trigger queue_entries_group_cap_upd
  before update on queue_entries
  for each row
  when (new.session_id is distinct from old.session_id)
  execute function _group_ride_cap();
