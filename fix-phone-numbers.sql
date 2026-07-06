-- One-time cleanup of phone numbers mangled by the old "cc + phone" bug, where a
-- customer who typed their country code got it doubled (e.g. +966966562989838,
-- +96600966562989838, +9660562989838). Rebuilds each Saudi number as +966 + the real
-- 9-digit mobile (its last 9 digits, which are 5XXXXXXXX). Safe to re-run.
-- Only touches numbers whose last 9 digits are a valid Saudi mobile AND aren't already
-- correct — anything else is left untouched. Run in the Supabase SQL editor.

update customers
set phone = '+966' || right(regexp_replace(phone, '\D', '', 'g'), 9)
where phone is not null
  and right(regexp_replace(phone, '\D', '', 'g'), 9) ~ '^5[0-9]{8}$'
  and phone <> '+966' || right(regexp_replace(phone, '\D', '', 'g'), 9);

-- Check the result:
-- select phone, count(*) from customers group by phone order by count(*) desc limit 20;
