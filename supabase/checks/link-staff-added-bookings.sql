-- One-off repair: bookings staff typed in without an account link, where the phone on the
-- booking belongs to exactly one customer. Before 2026-09-12 the desk linked a rider to an
-- account only when the typed name matched the account name exactly, so these rows never
-- reached the rider's My Bookings. Phones compare on their last nine digits.
--
-- Run the PREVIEW first, read it, then the UPDATE. The update touches only rows whose
-- customer_id is null and whose phone matches ONE customer.

-- PREVIEW
select q.id, q.session_date, q.queue_num, q.name as booking_name, q.phone, c.id as customer_id, c.name as account_name
from public.queue_entries q
join public.customers c
  on right(regexp_replace(coalesce(c.phone,''), '\D', '', 'g'), 9) = right(regexp_replace(coalesce(q.phone,''), '\D', '', 'g'), 9)
where q.customer_id is null
  and length(regexp_replace(coalesce(q.phone,''), '\D', '', 'g')) >= 9
  and (select count(*) from public.customers c2
        where right(regexp_replace(coalesce(c2.phone,''), '\D', '', 'g'), 9) = right(regexp_replace(coalesce(q.phone,''), '\D', '', 'g'), 9)) = 1
order by q.session_date desc, q.queue_num;

-- UPDATE (same rows as the preview)
-- update public.queue_entries q
--    set customer_id = c.id, walk_in = false
--   from public.customers c
--  where q.customer_id is null
--    and length(regexp_replace(coalesce(q.phone,''), '\D', '', 'g')) >= 9
--    and right(regexp_replace(coalesce(c.phone,''), '\D', '', 'g'), 9) = right(regexp_replace(coalesce(q.phone,''), '\D', '', 'g'), 9)
--    and (select count(*) from public.customers c2
--          where right(regexp_replace(coalesce(c2.phone,''), '\D', '', 'g'), 9) = right(regexp_replace(coalesce(q.phone,''), '\D', '', 'g'), 9)) = 1;
