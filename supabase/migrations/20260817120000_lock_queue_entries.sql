-- Close the last hole: queue_entries stops being world read/write. 2026-08-17.
--
-- ⚠️  RUN THIS ONLY AFTER the client calling customer_create_booking is deployed AND you
--     have seen real bookings succeed. Dropping "public read" is what caused the outage on
--     2026-08-16: the old booking form does `.insert(...).select()`, and RETURNING applies
--     SELECT policies to the new row. Any browser still running the pre-RPC bundle — the
--     service worker serves the shell cache-first, so that can lag a day — will fail to book
--     the moment this runs. Give the deploy time to roll out.
--
-- Rollback, if bookings start failing:
--     create policy "public read" on public.queue_entries for select using (true);
--     create policy "public insert booking" on public.queue_entries for insert with check (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. SELECT. ~2k rows of name / email / phone were readable by anyone holding the
-- anon key, which ships in the client bundle. Staff keep their own policy; the
-- public keeps the PII-free queue_public view; a customer's own rows come back
-- from my_bookings() and customer_create_booking(), both token-checked.
-- ─────────────────────────────────────────────────────────────────────────────
drop policy if exists "public read" on public.queue_entries;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. INSERT. With bookings going through the RPC, nothing customer-side writes
-- this table directly. Staff inserts (walk-ins, group add, community add) run
-- under the existing "staff insert" policy, so they are unaffected.
--
-- This also closes the free-ride hole for good: a direct insert could set
-- paid=true, and no trigger checks `paid`. The RPC derives it from the customer's
-- own default_pay instead.
-- ─────────────────────────────────────────────────────────────────────────────
drop policy if exists "public insert booking" on public.queue_entries;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Prove the intended paths still work. Each raises if it does not.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare n int;
begin
  select count(*) into n from pg_policy where polrelid='public.queue_entries'::regclass;
  if exists (select 1 from pg_policy where polrelid='public.queue_entries'::regclass
              and polname in ('public read','public insert booking')) then
    raise exception 'a public policy survived the drop';
  end if;

  if not exists (select 1 from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace
                  where ns.nspname='public' and p.proname='customer_create_booking') then
    raise exception 'customer_create_booking is missing - do NOT run this migration yet';
  end if;

  if not has_function_privilege('anon','public.customer_create_booking(text,text,jsonb)','execute') then
    raise exception 'anon cannot execute customer_create_booking - booking would break';
  end if;

  raise notice 'queue_entries locked: % policies remain, booking RPC present and callable', n;
end $$;
