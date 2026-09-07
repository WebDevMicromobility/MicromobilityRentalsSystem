-- ─────────────────────────────────────────────────────────────────────────────
-- Drift check: run this in the SQL editor after ANY migration that touches a
-- function. It prints one row per surprise and nothing when all is well.
--
-- Why it exists: CREATE OR REPLACE FUNCTION replaces the whole definition,
-- attributes included, and pg_proc.prosrc gives you only the BODY. Reproducing
-- a function from prosrc therefore silently drops `security definer`, demoting
-- it to invoker rights. That is how staff lost the ability to add riders on
-- 2026-09-04 (_enforce_booking_price could no longer call the deliberately
-- locked-down _promo_valid), fixed in 20260907120000.
--
-- The expectations below are the INTENT. If a row appears, either the function
-- regressed or the intent changed — decide which, then fix the code or this file.
-- ─────────────────────────────────────────────────────────────────────────────
with expected(fname, want_definer, note) as (values
  -- Definer: reaches past the caller's RLS, or calls a locked-down helper.
  ('_enforce_booking_price', true,  'calls _promo_valid, which anon+authenticated cannot execute'),
  ('_group_ride_cap',        true,  'counts queue_entries rows the caller may not be able to see'),
  ('_solo_ride_cap',         true,  'same: one place per account on an approval session'),
  ('_approval_guard',        true,  'reads sessions/staff beyond the caller'),
  ('_community_booking_gate',true,  'reads customer_tags, staff-only'),
  ('_promo_count',           true,  'writes promo_codes.uses'),
  ('_promo_valid',           true,  'reads promo_codes; revoked from anon+authenticated on purpose'),
  ('_session_fill_status',   true,  'writes sessions.status from a queue_entries trigger'),
  ('_promote_next_waitlist', true,  'promotes across RLS; revoked from anon+authenticated'),
  ('assign_queue_num',       true,  'reads the whole session to pick a number'),
  ('queue_num_update_guard', true,  'same'),
  ('is_staff',               true,  'reads the staff table'),
  ('is_admin',               true,  'reads the staff table'),
  ('_cust_token_ok',         true,  'reads customers.session_token; internal only'),
  ('_oracle_gate',           true,  'writes login_throttle; internal only'),
  ('customer_create_booking',true,  'the whole point: booking without table rights'),
  ('customer_booking_update',true,  'ditto'),
  ('customer_addon_stock',   true,  'ditto'),
  ('customer_login',         true,  'reads customers'),
  ('customer_signup',        true,  'writes customers'),
  ('customer_reset',         true,  'reads+writes customers'),
  ('customer_exists',        true,  'reads customers, metered'),
  ('staff_email_for_phone',  true,  'reads staff_phones, metered'),
  ('staff_mark_pwd_changed', true,  'writes staff.must_change_pwd'),
  ('my_bookings',            true,  'reads the caller''s own rows past RLS'),
  ('list_sessions',          true,  'reads sessions incl. gated ones'),
  ('community_member',       true,  'reads customer_tags'),
  -- Invoker on purpose: pure logic, no privileged read.
  ('_capacity_guard',        false, 'counts rows already visible in its calling context'),
  ('_comm_no_carbon',        false, 'inspects NEW only'),
  ('_wl_num_assign',         false, 'inspects NEW + same-session rows'),
  ('_ctag_active',           false, 'pure date comparison'),
  ('_cust_pwd_ok',           false, 'pure hash comparison')
)
select e.fname,
       case when p.oid is null then 'MISSING FROM DATABASE'
            else 'security definer is ' || p.prosecdef || ', expected ' || e.want_definer end as problem,
       e.note
from expected e
left join pg_proc p on p.proname = e.fname
     and p.pronamespace = 'public'::regnamespace
where p.oid is null or p.prosecdef <> e.want_definer;
