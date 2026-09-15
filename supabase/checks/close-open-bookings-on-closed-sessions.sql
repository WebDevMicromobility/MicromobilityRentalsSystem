-- One-off repair, 2026-09-15: every closed JCC / Petromin night since 14 Jul still carried
-- riders at 'waiting' or 'active' (1,810 rows). The account report, riders' histories, the
-- leaderboard, the profile gate and "SAR due" all read them as live. Free community rides
-- were repaired separately (complete-free-closed-sessions.sql).
--
-- Three rules, applied to bookings on CLOSED sessions dated before today:
--   1. on bike (active)          -> done, checked out at the session date
--   2. waiting and paid          -> done  (paid means they rode; the party pattern of 8 Sep)
--   3. waiting and unpaid        -> noshow (never checked in, never paid)
-- Waitlisted, cancelled, no-show and removed rows are left alone. Safe to re-run.
-- The before-state of every affected row was saved to
-- ~/Downloads/closed-bookings-before-2026-09-15.json (id, status, paid, timestamps).
--
-- Run the PREVIEW, read the counts, then the three UPDATEs, then VERIFY (expect no rows).

-- PREVIEW: what each rule would touch
select case when q.status='active' then '1. on bike -> done'
            when q.paid then '2. waiting paid -> done'
            else '3. waiting unpaid -> noshow' end as rule,
       count(*) as bookings, count(distinct s.id) as sessions, min(s.session_date) as first_date, max(s.session_date) as last_date
from public.queue_entries q
join public.sessions s on s.id = q.session_id
where s.status = 'closed'
  and s.session_date < to_char(now() at time zone 'Asia/Riyadh', 'YYYY-MM-DD')
  and q.status in ('waiting', 'active')
group by 1 order by 1;

-- 1. on bike -> done
update public.queue_entries q
set status = 'done',
    checked_out_at = coalesce(q.checked_out_at, s.session_date || 'T23:59:00Z')
from public.sessions s
where s.id = q.session_id
  and s.status = 'closed'
  and s.session_date < to_char(now() at time zone 'Asia/Riyadh', 'YYYY-MM-DD')
  and q.status = 'active';

-- 2. waiting and paid -> done
update public.queue_entries q
set status = 'done',
    checked_in_at  = coalesce(q.checked_in_at,  s.session_date || 'T00:00:00Z'),
    checked_out_at = coalesce(q.checked_out_at, s.session_date || 'T23:59:00Z')
from public.sessions s
where s.id = q.session_id
  and s.status = 'closed'
  and s.session_date < to_char(now() at time zone 'Asia/Riyadh', 'YYYY-MM-DD')
  and q.status = 'waiting'
  and q.paid = true;

-- 3. waiting and unpaid -> noshow
update public.queue_entries q
set status = 'noshow'
from public.sessions s
where s.id = q.session_id
  and s.status = 'closed'
  and s.session_date < to_char(now() at time zone 'Asia/Riyadh', 'YYYY-MM-DD')
  and q.status = 'waiting'
  and coalesce(q.paid, false) = false;

-- VERIFY: expect no rows
select q.status, count(*) as still_open
from public.queue_entries q
join public.sessions s on s.id = q.session_id
where s.status = 'closed'
  and s.session_date < to_char(now() at time zone 'Asia/Riyadh', 'YYYY-MM-DD')
  and q.status in ('waiting', 'active')
group by 1;
