-- Per-customer default payment (staff-set in the customer editor).
-- 'house' = this rider always rides on the house: any NEW booking created for them
-- (self-booking, walk-in, group, waitlist check-in) starts paid with price 0.
-- NULL/empty = normal payment. Run in the Supabase SQL editor.
alter table customers add column if not exists default_pay text;
