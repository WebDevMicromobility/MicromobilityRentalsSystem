-- PRODUCTION lockdown: Section 4. Run this LAST, only after the app is deployed
-- with SECURE_AUTH on and verified working. After this the anon key can no longer
-- read customer PII. Rollback = the commented ROLLBACK block at the file's end.

-- SECTION 4 — LOCK THE TABLES   (⚠️ the irreversible-feeling step; rollback below)
-- Run ONLY after Sections 1–3 verified AND the app has SECURE_AUTH=true with
-- staff signing in via Supabase Auth. After this, the public anon key can no
-- longer read customer PII or other riders' bookings.
-- ============================================================================

-- ---- customers -----------------------------------------------------------
drop policy if exists "public access" on customers;
-- No anon SELECT/UPDATE/DELETE/INSERT: all customer access is via the SECTION 1
-- SECURITY DEFINER functions (which bypass RLS). Staff get full direct access.
create policy "staff full"    on customers for all using (is_staff()) with check (is_staff());

-- ---- queue_entries -------------------------------------------------------
drop policy if exists "public access" on queue_entries;
-- SELECT is the PII leak, so SELECT is what gets locked: availability reads go
-- through queue_public (no PII) and a customer's own rows through my_bookings().
-- INSERT stays public (booking). UPDATE/DELETE stay public because the app's
-- booking machinery legitimately writes from the customer side (cancel + queue
-- renumbering, modify, post-ride ratings, insert-failure rollback): every such
-- write targets rows by their random uid() primary key, which can no longer be
-- enumerated once SELECT is locked. Tightening writes to token-checked RPCs is
-- the Section 5 follow-up.
create policy "public insert booking" on queue_entries for insert with check (true);
create policy "public update by id"   on queue_entries for update using (true) with check (true);
create policy "public delete by id"   on queue_entries for delete using (true);
create policy "staff full"            on queue_entries for all using (is_staff()) with check (is_staff());

-- ---- the rest stay public (no PII): bikes, sessions, inventory, promo_codes
-- They already have "public access"; leave them. (Tighten writes later if desired.)

-- ✅ CHECKPOINT 4: with NO session (incognito, not logged in) try in the app /
--    SQL: select * from customers;  → must return 0 rows / permission denied.
--    Then log in as a customer (RPC) and confirm profile + My Rides still work,
--    and as staff (Auth) confirm the customers/queue tabs load.


-- ============================================================================
