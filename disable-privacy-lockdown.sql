-- Turn OFF the privacy lockdown so the app (anon key) reads rider names/phones straight from
-- queue_entries again, instead of the no-PII queue_public view. Pair this with SECURE_AUTH=false
-- in the app (already the default). Run once in the Supabase SQL editor.
--
-- This re-opens SELECT on the two tables the security migration restricted to signed-in staff:
--   • queue_entries  (rider name / phone / email)   → so the Bookings tab shows names again
--   • cashier_sales  (walk-up names)                → so Sales/Analytics can read sales
-- Writes were already public, so nothing else changes. Idempotent — safe to re-run.
--
-- To RE-ENABLE the lockdown later: re-run security-migration.sql and set cq_secure_auth='1'.

drop policy if exists "public read" on public.queue_entries;
create policy "public read" on public.queue_entries for select using (true);

drop policy if exists "public read" on public.cashier_sales;
create policy "public read" on public.cashier_sales for select using (true);
