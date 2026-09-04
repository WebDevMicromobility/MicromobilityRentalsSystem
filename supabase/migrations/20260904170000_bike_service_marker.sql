-- ─────────────────────────────────────────────────────────────────────────────
-- One timestamp turns the ride history into a maintenance system.
--
-- The fleet already records everything a service schedule needs -- every ride,
-- its duration, which bike carried it -- and had nowhere to write down the one
-- fact that turns that history into "due or not": when the bike was last
-- serviced. bikes.last_serviced_at is that fact. "Mark serviced" in the bike
-- profile sets it; rides-since-service is counted client-side from the booking
-- history; the profile shows amber past the threshold.
--
-- Null means never recorded (all 55 bikes start there), shown honestly as
-- "not tracked yet" rather than as overdue -- the fleet was maintained before
-- this column existed, just not written down.
--
-- Rollback: alter table public.bikes drop column if exists last_serviced_at;
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.bikes add column if not exists last_serviced_at timestamptz;
comment on column public.bikes.last_serviced_at is
  'When staff last marked this bike serviced (Mark serviced in the bike profile). Null = never recorded; rides-since counts from in_service_date or forever.';
