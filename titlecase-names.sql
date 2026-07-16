-- Title-case existing customer/rider names (first letter of each word capitalized).
-- Run once in the Supabase SQL editor. Postgres initcap() does exactly this: uppercases
-- the first letter after any non-alphanumeric boundary, lowercases the rest. Arabic names
-- are caseless so they pass through unchanged. Idempotent (safe to re-run).

-- Customer accounts (the source of truth)
update customers
  set name = initcap(name)
  where name is not null and name is distinct from initcap(name);

-- Denormalized rider names on bookings (kept in sync so history/queue match)
update queue_entries
  set name = initcap(name)
  where name is not null and name is distinct from initcap(name);

-- Names captured on staff notes and sales
update customer_notes
  set customer_name = initcap(customer_name)
  where customer_name is not null and customer_name is distinct from initcap(customer_name);

update cashier_sales
  set customer_name = initcap(customer_name)
  where customer_name is not null and customer_name is distinct from initcap(customer_name);
