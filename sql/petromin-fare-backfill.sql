-- Bring open Petromin bookings down to the Petromin fare.
--
-- ride-prices-57-5.sql only moved bookings UP from 50, because that was the case in front of
-- us. It never brought bookings DOWN to a kind's own fare, so seven Petromin employees booked
-- for the 21st and the 23rd were left at 57.5 when their fare is 50. The trigger prices a row
-- as it is written; rows already sitting in the queue keep whatever they had.
--
-- Written against ride_prices_by_kind rather than the word "petromin", so it also corrects
-- whatever kind is given its own fare next.
--
-- Untouched, deliberately: anything paid, anything already holding a bike, and anything that
-- is not still waiting. A fare that has been taken is not rewritten.

begin;

update public.queue_entries q
   set price = k.price
  from public.sessions s
  join public.ride_prices_by_kind k
    on k.ride_kind = s.ride_kind
 where s.id = q.session_id
   and k.type = q.type_preference
   and q.price is distinct from k.price
   and coalesce(q.paid, false) = false
   and q.assigned_bike_id is null
   and q.status in ('waiting', 'waitlist');

commit;

-- Expect no rows: every open booking now agrees with its ride kind's fare.
select s.ride_kind, q.type_preference, q.price as now_at, k.price as should_be, count(*) as n
  from queue_entries q
  join sessions s on s.id = q.session_id
  join ride_prices_by_kind k on k.ride_kind = s.ride_kind and k.type = q.type_preference
 where q.price is distinct from k.price
   and coalesce(q.paid, false) = false
   and q.assigned_bike_id is null
   and q.status in ('waiting', 'waitlist')
 group by 1, 2, 3, 4;
