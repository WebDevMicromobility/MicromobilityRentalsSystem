-- ─────────────────────────────────────────────────────────────────────────────
-- The Petromin ride: one account, one extra rider.
--
-- Was four riders per account per session; now two — the member and one guest.
-- The client cap (GROUP_RIDE_MAX) and this are the same rule stated twice, so
-- they move together or a rider meets a limit the form let them exceed.
--
-- Unchanged, and worth knowing:
--   · STAFF ARE EXEMPT (the is_staff() early return). The desk can still seat a
--     larger party; this only binds a customer booking for themselves.
--   · It counts LIVE rows per (customer, session), so booking twice cannot get
--     round it — cancelled, removed and no-show rows do not count.
--   · Only community sessions with needs_approval = false are covered, which is
--     the Petromin ride. The Saturday and pool sessions are one spot each by a
--     different rule; the circuit has no per-account cap at all.
--
-- The UPDATE trigger fires only when a booking MOVES session (see its WHEN
-- clause), so tightening the number does not re-validate rows already taken.
-- Five existing bookings exceed the new cap (one of five riders, two of four,
-- two of three). They are left alone and keep working; what they can no longer
-- do is move to another date, which would be a fresh booking against the cap.
--
-- Rollback: re-apply with 2 changed back to 4 in both the test and the message.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._group_ride_cap()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
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

  if _live >= 2 then
    raise exception 'Up to 2 riders per booking on this ride.';
  end if;

  return new;
end $function$;
