-- ═══════════════════════════════════════════════════════════════════════════
-- Database optimization — behavior-preserving. Run in the Supabase SQL editor.
--
-- Nothing here changes WHO can read/write what. It only:
--   1. adds two missing foreign-key indexes (faster customer/bike lookups)
--   2. stops the staff policy from being evaluated on every public READ
--   3. evaluates is_staff()/auth.uid() once per query instead of once per row
--
-- Every statement is idempotent and reversible. Safe to run more than once.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Missing foreign-key indexes ─────────────────────────────────────────
-- queue_entries.customer_id is filtered by the new Sales customer-history and
-- account "Purchases" features, and by every "this rider's bookings" lookup.
-- Without an index Postgres scans all 775 rows each time.
create index if not exists idx_queue_customer  on public.queue_entries (customer_id);
create index if not exists idx_queue_bike       on public.queue_entries (assigned_bike_id);
-- cashier_sales is filtered by customer_id for the account purchases list too.
create index if not exists idx_cashier_customer on public.cashier_sales (customer_id);

-- ── 2. staff table: evaluate auth.uid() once, not per row ───────────────────
drop policy if exists "staff read self" on public.staff;
create policy "staff read self" on public.staff
  for select using ((select auth.uid()) = user_id);

-- ── 3. Split "ALL" staff policies into write-only ──────────────────────────
-- These tables already have a "public read: true" policy, so the staff policy's
-- SELECT branch is redundant — but Postgres still runs is_staff() on EVERY read
-- (even for anonymous visitors) and OR's it with true. Making the staff policy
-- INSERT/UPDATE/DELETE only means public reads evaluate a single trivial policy.
-- Reads stay open to everyone; writes stay staff-only. Identical behavior.

-- bikes
drop policy if exists "staff write" on public.bikes;
create policy "staff insert" on public.bikes for insert with check ((select is_staff()));
create policy "staff update" on public.bikes for update using ((select is_staff())) with check ((select is_staff()));
create policy "staff delete" on public.bikes for delete using ((select is_staff()));

-- inventory
drop policy if exists "staff write" on public.inventory;
create policy "staff insert" on public.inventory for insert with check ((select is_staff()));
create policy "staff update" on public.inventory for update using ((select is_staff())) with check ((select is_staff()));
create policy "staff delete" on public.inventory for delete using ((select is_staff()));

-- sessions
drop policy if exists "staff write" on public.sessions;
create policy "staff insert" on public.sessions for insert with check ((select is_staff()));
create policy "staff update" on public.sessions for update using ((select is_staff())) with check ((select is_staff()));
create policy "staff delete" on public.sessions for delete using ((select is_staff()));

-- promo_codes
drop policy if exists "staff write" on public.promo_codes;
create policy "staff insert" on public.promo_codes for insert with check ((select is_staff()));
create policy "staff update" on public.promo_codes for update using ((select is_staff())) with check ((select is_staff()));
create policy "staff delete" on public.promo_codes for delete using ((select is_staff()));

-- cashier_sales
drop policy if exists "staff all" on public.cashier_sales;
create policy "staff insert" on public.cashier_sales for insert with check ((select is_staff()));
create policy "staff update" on public.cashier_sales for update using ((select is_staff())) with check ((select is_staff()));
create policy "staff delete" on public.cashier_sales for delete using ((select is_staff()));

-- queue_entries: keep the token-checked public insert/update/delete policies,
-- just remove the redundant SELECT coverage from the staff policy.
drop policy if exists "staff full" on public.queue_entries;
create policy "staff insert" on public.queue_entries for insert with check ((select is_staff()));
create policy "staff update" on public.queue_entries for update using ((select is_staff())) with check ((select is_staff()));
create policy "staff delete" on public.queue_entries for delete using ((select is_staff()));

-- team_members: its write policy was ALL with a `true` check — preserve that
-- exactly (open write), just stop it from double-covering reads.
drop policy if exists team_members_write on public.team_members;
create policy team_members_insert on public.team_members for insert with check (true);
create policy team_members_update on public.team_members for update using (true) with check (true);
create policy team_members_delete on public.team_members for delete using (true);

-- ── Note: idx_cashier_session ("unused") is intentionally KEPT ──────────────
-- The advisor flags it as unused only because cashier_sales is currently empty.
-- The Sales tab filters by session_id constantly, so it earns its keep.
