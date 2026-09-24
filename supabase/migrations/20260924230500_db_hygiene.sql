-- The advisor findings worth acting on (2026-09-24), all without changing who may do what.
--
-- 1. Six foreign keys had no index on their referencing column, so deleting a rider or a
--    booking scanned the tables that point at it (advisor 0001).
-- 2. Three functions ran with the caller's search_path (advisor 0011). ALTER FUNCTION ... SET
--    changes that one attribute and keeps every other (SECURITY DEFINER included), unlike a
--    CREATE OR REPLACE rebuilt from prosrc.
-- 3. Eight policies called is_staff() bare, which Postgres evaluates once per ROW: reading the
--    3,000 rider tags ran it 3,000 times (~49 ms a read). is_staff() takes no argument, so in a
--    sub-select it becomes an initPlan and runs once per statement. Same rule, same roles; the
--    other staff policies were already written this way.
-- 4. sessions had two permissive SELECT policies, both evaluated on every row (advisor 0006).
--    One policy with the two conditions OR-ed is the same rule.
--
-- Left alone on purpose: the unused-index findings (the tables are too small for them to
-- matter, and several back features days old), the queue_public security-definer view (it is
-- how the public ride list hides riders' names), and the SECURITY DEFINER functions anon may
-- execute (they are the customer sign-in and booking RPCs).

begin;

-- 1 ──────────────────────────────────────────────────────────────────────────
create index if not exists ambassadors_customer_id_idx                 on public.ambassadors (customer_id);
create index if not exists bike_assignments_assigned_by_idx            on public.bike_assignments (assigned_by);
create index if not exists bike_assignments_returned_by_idx            on public.bike_assignments (returned_by);
create index if not exists community_applications_customer_id_idx      on public.community_applications (customer_id);
create index if not exists rider_registrations_matched_customer_id_idx on public.rider_registrations (matched_customer_id);
create index if not exists rider_registrations_matched_entry_id_idx    on public.rider_registrations (matched_entry_id);

-- 2 ──────────────────────────────────────────────────────────────────────────
alter function public._name_chars_ok(text)        set search_path = public, pg_temp;
alter function public._customer_name_ok()         set search_path = public, pg_temp;
alter function public._session_status_by_hand()   set search_path = public, pg_temp;

-- 3 ──────────────────────────────────────────────────────────────────────────
alter policy "staff full"        on public.customer_tags   using ((select is_staff())) with check ((select is_staff()));
alter policy "staff full"        on public.tags            using ((select is_staff())) with check ((select is_staff()));
alter policy "staff full"        on public.breakfast_spots using ((select is_staff())) with check ((select is_staff()));
alter policy "staff full access" on public.customer_notes  using ((select is_staff())) with check ((select is_staff()));
alter policy "staff full access" on public.desk_waitlist   using ((select is_staff())) with check ((select is_staff()));
alter policy "staff read flags"  on public.customer_flags  using ((select is_staff()));
alter policy "error read"        on public.error_log       using ((select is_staff()));
alter policy "audit read"        on public.staff_actions   using ((select is_staff()));

-- 4 ──────────────────────────────────────────────────────────────────────────
drop policy if exists "public read ungated" on public.sessions;
drop policy if exists "staff read"          on public.sessions;
drop policy if exists "read ungated or staff" on public.sessions;
create policy "read ungated or staff" on public.sessions for select
  using (required_tag_id is null or (select is_staff()));

commit;
