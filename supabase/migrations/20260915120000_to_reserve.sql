-- ============================================================================
-- "To be reserved": a mark staff put on a waiting booking that should get a bike held for
-- it, before any bike is chosen. Reserving a bike (assigned_bike_id) clears it. Staff-only:
-- read and written straight off the table under the staff policies; customers never see it
-- (queue_public and my_bookings are not widened).
--
-- Rollback: alter table public.queue_entries drop column if exists to_reserve;
-- Idempotent: safe to re-run.
-- ============================================================================
alter table public.queue_entries add column if not exists to_reserve boolean not null default false;
comment on column public.queue_entries.to_reserve is 'staff mark: hold a bike for this booking (cleared when one is reserved)';

-- Verify (expect 1 row):
--   select column_name, column_default from information_schema.columns where table_name='queue_entries' and column_name='to_reserve';
