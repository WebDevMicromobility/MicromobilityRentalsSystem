-- Clean up phone numbers mangled by the old "cc + phone" bug (doubled country code,
-- e.g. +966966562989838). The app is fixed going forward; this fixes existing rows.
--
-- IMPORTANT: there is no SAFE universal auto-fix across all countries — national number
-- formats differ (e.g. a real Kazakhstan number +7 7XX… looks like a "doubled 7"). So we
-- auto-fix the ONE format we can reconstruct with certainty — Saudi (+966) mobiles — and
-- just LIST anything non-Saudi for you to fix by hand (there are usually very few).

-- ─────────────────────────────────────────────────────────────────────────
-- STEP 1 — AUTO-FIX Saudi (+966) mobiles.  Safe & reconstructable: a Saudi mobile is
-- always +966 followed by 9 digits starting with 5, so we rebuild from the last 9 digits.
-- Handles every mangled form: +966966…, +96600966…, +9660…. Only touches rows whose last
-- 9 digits are a valid Saudi mobile AND aren't already correct.
-- ─────────────────────────────────────────────────────────────────────────
update customers
set phone = '+966' || right(regexp_replace(phone, '\D', '', 'g'), 9)
where phone is not null
  and right(regexp_replace(phone, '\D', '', 'g'), 9) ~ '^5[0-9]{8}$'
  and phone <> '+966' || right(regexp_replace(phone, '\D', '', 'g'), 9);

-- ─────────────────────────────────────────────────────────────────────────
-- STEP 2 — REVIEW the rest (read-only). Lists numbers that are NOT a clean Saudi mobile,
-- so you can eyeball non-Saudi / odd ones and fix them individually. Most lists will be
-- empty or tiny.
-- ─────────────────────────────────────────────────────────────────────────
select id, name, phone
from customers
where coalesce(phone,'') <> ''
  and phone !~ '^\+9665[0-9]{8}$'        -- anything not already a clean Saudi mobile
order by phone;

-- To fix one by hand once you've identified the correct number:
--   update customers set phone = '+971501234567' where id = 'the_id_here';
