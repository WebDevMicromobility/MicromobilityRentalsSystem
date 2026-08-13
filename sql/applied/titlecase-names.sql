-- Title-case existing customer/rider names: uppercase the first letter of each word,
-- LEAVE THE REST AS TYPED (so "McDonald" and "MOHAMMED" are preserved). Matches the app's
-- _titleCaseName helper exactly. Run once in the Supabase SQL editor. Idempotent.
--
-- Postgres has no case-transform in regex replacement and initcap() lowercases the rest,
-- so we use a tiny helper that uppercases the first letter after each word boundary
-- (start of string, space, hyphen, straight or curly apostrophe). Arabic is caseless, so
-- upper() is a no-op on it and Arabic names pass through unchanged.

create or replace function _titlecase_keep(s text) returns text
language plpgsql immutable as $$
declare r text := ''; ch text; prev text := ' '; i int;
begin
  if s is null then return null; end if;
  s := regexp_replace(btrim(s), '\s+', ' ', 'g');   -- collapse whitespace like the app does
  for i in 1..length(s) loop
    ch := substr(s, i, 1);
    if prev in (' ', '-', '''', '’') then r := r || upper(ch); else r := r || ch; end if;
    prev := ch;
  end loop;
  return r;
end;
$$;

update customers
  set name = _titlecase_keep(name)
  where name is not null and name is distinct from _titlecase_keep(name);

update queue_entries
  set name = _titlecase_keep(name)
  where name is not null and name is distinct from _titlecase_keep(name);

update customer_notes
  set customer_name = _titlecase_keep(customer_name)
  where customer_name is not null and customer_name is distinct from _titlecase_keep(customer_name);

update cashier_sales
  set customer_name = _titlecase_keep(customer_name)
  where customer_name is not null and customer_name is distinct from _titlecase_keep(customer_name);

-- The helper is left in place (harmless, immutable). Drop it if you prefer:
-- drop function _titlecase_keep(text);
