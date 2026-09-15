-- One-off repair: free community sessions (Saturday Social Ride, T100 Triathlon Prep -
-- event_kind 'community', paid_ride false) that are already CLOSED but whose riders were
-- never marked completed. Their approved bookings still read 'waiting' or 'active', so the
-- account report, the rider's history and the 14/30-day activity all miss those rides.
--
-- Marks them done. Every waiting / active booking counts except a rejected one: on these
-- rides staff never used Approve, so the riders who rode are still 'pending' (12 rows across
-- five sessions when this ran on 2026-09-15, via `supabase db query --linked`). Cancelled,
-- no-show, removed and waitlisted rows are left alone. Timestamps are filled with the
-- session's date at midnight (UTC) when missing, so nothing downstream sees a done row
-- without a check-out.
--
-- Run the PREVIEW first, read it, then the UPDATE. Safe to re-run: a second run finds no rows.

-- PREVIEW: how many bookings per closed free session would change, by their current status
select s.id as session_id, s.session_date, s.title, s.ride_kind,
       q.status, q.approval, count(*) as bookings
from public.queue_entries q
join public.sessions s on s.id = q.session_id
where s.status = 'closed'
  and s.event_kind = 'community'
  and coalesce(s.paid_ride, false) = false
  and q.status in ('waiting', 'active')
  and coalesce(q.approval,'pending') <> 'rejected'
group by s.id, s.session_date, s.title, s.ride_kind, q.status, q.approval
order by s.session_date desc, q.status;

-- UPDATE (same rows as the preview)
update public.queue_entries q
set status = 'done',
    checked_in_at  = coalesce(q.checked_in_at,  s.session_date || 'T00:00:00Z'),
    checked_out_at = coalesce(q.checked_out_at, s.session_date || 'T00:00:00Z')
from public.sessions s
where s.id = q.session_id
  and s.status = 'closed'
  and s.event_kind = 'community'
  and coalesce(s.paid_ride, false) = false
  and q.status in ('waiting', 'active')
  and coalesce(q.approval,'pending') <> 'rejected';

-- VERIFY: expect 0 rows
select count(*) as still_open
from public.queue_entries q
join public.sessions s on s.id = q.session_id
where s.status = 'closed' and s.event_kind = 'community' and coalesce(s.paid_ride, false) = false
  and q.status in ('waiting', 'active') and coalesce(q.approval,'pending') <> 'rejected';
