-- ─────────────────────────────────────────────────────────────────────────────
-- Close the last PII hole: queue_entries stops being world-readable.
--
-- `public read using(true)` has been open since the August lockdown, and it is the
-- one remaining place where the anon key shipped in the bundle reads roughly two
-- thousand riders' names, emails and phone numbers. It was not left open by
-- oversight: dropping it broke booking live, because the form did
-- `.insert(...).select()` and RETURNING applies SELECT policies to the new row.
--
-- That reason is gone. customer_create_booking() returns the created rows without
-- the caller needing SELECT, both client call sites use it, and non-staff reads go
-- through the PII-free queue_public view.
--
-- ⚠️ DO NOT APPLY BLIND. Run the checks below first; each one takes a minute, and
-- between them they cover every way this has bitten before.
--
--   1. Bookings are actually flowing through the RPC, not the direct insert:
--        select count(*) from queue_entries
--         where registered_at::timestamptz > now() - interval '48 hours';
--      then confirm the same window appears in the Postgres logs as
--      customer_create_booking calls rather than INSERTs on the table.
--
--   2. The view really is what customers read, and carries no PII:
--        select * from queue_public limit 1;
--
--   3. Every device has had time to pick up the client that calls the RPC. The
--      service worker serves navigations stale-while-revalidate, so a device that
--      has not been opened since the deploy still runs the old code. Wait a day
--      after a deploy, not an hour.
--
--   4. Have the rollback ready in another tab (bottom of this file). If booking
--      breaks, restoring takes seconds — the outage in August lasted as long as it
--      took to find the SQL.
--
-- Then apply, and immediately make one real booking as a signed-out visitor.
-- ─────────────────────────────────────────────────────────────────────────────

-- Customers no longer read the table: queue_public (no PII) and the RPCs cover them.
drop policy if exists "public read" on public.queue_entries;

-- Customers no longer insert into it either: customer_create_booking() is SECURITY
-- DEFINER and derives customer_id, paid and price server-side, which is strictly
-- safer than trusting a client insert. Staff insert under their own is_staff() policy.
drop policy if exists "public insert booking" on public.queue_entries;

-- ── Rollback, if booking breaks ──────────────────────────────────────────────
-- create policy "public read" on public.queue_entries for select using (true);
-- create policy "public insert booking" on public.queue_entries for insert with check (true);
