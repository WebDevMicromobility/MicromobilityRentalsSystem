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
  ('customer_fix_fields',    true,  'reads customers.fix_fields; the table is staff-only'),
  ('customer_fix_save',      true,  'writes the flagged customers columns, clears the flags, records the history'),
  ('staff_flag_customer',    true,  'sets fix_fields and writes customer_flags, which nobody may write directly'),
  ('_customer_asks',         true,  'reads customers and queue_entries to decide the check-up; internal only'),
  ('customer_oauth_login',   true,  'reads customers by email or apple_email'),
  ('_customer_email_alias',  true,  'trigger: reads other customers rows to keep the two email columns apart'),
  ('list_sessions',          true,  'reads sessions incl. gated ones'),
  ('community_member',       true,  'reads customer_tags'),
  ('_staff_ref_broadcast',   true,  'inserts into realtime.messages whoever made the change'),
  -- Invoker on purpose: pure logic, no privileged read.
  ('_name_chars_ok',         false, 'pure regex test, no read'),
  ('_customer_name_ok',      false, 'name-rule trigger; is_staff() does its own privileged read'),
  ('_capacity_guard',        false, 'counts rows already visible in its calling context'),
  ('_comm_no_carbon',        false, 'inspects NEW only'),
  ('_wl_num_assign',         false, 'inspects NEW + same-session rows'),
  ('_ctag_active',           false, 'pure date comparison'),
  ('_cust_pwd_ok',           false, 'pure hash comparison'),
  -- Rider registration (the form at micromobility.sa/petromin)
  ('rider_register',         true,  'writes rider_registrations for anon; reads queue_entries and customers to match'),
  ('rider_edit',             true,  'same, for the rider''s own row'),
  ('rider_party_add',        true,  'inserts companions for staff; the table grants no insert'),
  ('rider_sessions',         true,  'reads sessions for anon'),
  ('_rider_gate',            true,  'writes login_throttle; internal only'),
  ('_rider_session_open',    false, 'pure status check on the row it is handed'),
  ('_session_window',        false, 'pure time arithmetic on the row it is handed'),
  ('_rider_price',           false, 'pure price table'),
  ('_rider_registration_guard', false, 'inspects NEW only; calls _rider_price at return time')
)
select e.fname,
       case when p.oid is null then 'MISSING FROM DATABASE'
            else 'security definer is ' || p.prosecdef || ', expected ' || e.want_definer end as problem,
       e.note
from expected e
left join pg_proc p on p.proname = e.fname
     and p.pronamespace = 'public'::regnamespace
where p.oid is null or p.prosecdef <> e.want_definer;
