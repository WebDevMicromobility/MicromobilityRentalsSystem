-- ============================================================================
-- Fix duplicate customer accounts. Run in the Supabase SQL editor.
-- STEP 1 is read-only (safe) — run it first and REVIEW the results.
-- STEP 2 merges + deletes — only run it after Step 1 looks right.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- STEP 1 — FIND duplicates (read-only, changes nothing)
-- ─────────────────────────────────────────────────────────────────────────

-- Duplicates by EMAIL (case-insensitive). These are almost always the same person.
select lower(trim(email)) as email,
       count(*) as copies,
       string_agg(id || '  ·  ' || name || '  ·  ' || created_at, E'\n' order by created_at) as records
from customers
where coalesce(trim(email),'') <> ''
group by lower(trim(email))
having count(*) > 1
order by copies desc;

-- Duplicates by PHONE (digits only). REVIEW these by hand — a shared family phone
-- can look like a duplicate but be two different people.
select regexp_replace(phone,'\D','','g') as phone_digits,
       count(*) as copies,
       string_agg(id || '  ·  ' || name || '  ·  ' || coalesce(email,'(no email)'), E'\n' order by created_at) as records
from customers
where length(regexp_replace(coalesce(phone,''),'\D','','g')) >= 9
group by regexp_replace(phone,'\D','','g')
having count(*) > 1
order by copies desc;


-- ─────────────────────────────────────────────────────────────────────────
-- STEP 2 — MERGE the EMAIL duplicates (safe, transactional, data-preserving)
--   • Keeps the OLDEST record per email as the survivor.
--   • Fills any blank fields on the survivor from its duplicates (no data lost).
--   • Re-points every booking + sale to the survivor.
--   • Deletes the leftover duplicate rows.
-- Run this whole block at once. If anything looks wrong it can be rolled back
-- before COMMIT.
-- ─────────────────────────────────────────────────────────────────────────
begin;

create temp table _dupe_map on commit drop as
with grp as (
  select id,
         row_number() over (partition by lower(trim(email)) order by created_at, id) as rn,
         first_value(id) over (partition by lower(trim(email)) order by created_at, id) as keep_id
  from customers
  where coalesce(trim(email),'') <> ''
)
select id as dup_id, keep_id from grp where rn > 1;

-- Backfill blanks on the survivor from any of its duplicates.
update customers k set
  phone           = coalesce(k.phone, d.phone),
  height          = coalesce(k.height, d.height),
  type_preference = coalesce(k.type_preference, d.type_preference),
  gender          = coalesce(k.gender, d.gender),
  birth_date      = coalesce(k.birth_date, d.birth_date),
  country         = coalesce(k.country, d.country),
  city            = coalesce(k.city, d.city),
  photo           = coalesce(k.photo, d.photo)
from customers d
join _dupe_map m on d.id = m.dup_id
where k.id = m.keep_id;

-- Move history to the survivor.
update queue_entries q set customer_id = m.keep_id from _dupe_map m where q.customer_id = m.dup_id;
update cashier_sales s set customer_id = m.keep_id from _dupe_map m where s.customer_id = m.dup_id;

-- How many duplicates are about to be removed:
select count(*) as duplicates_removed from _dupe_map;

-- Remove them.
delete from customers where id in (select dup_id from _dupe_map);

commit;   -- change to ROLLBACK; if the numbers above look wrong

-- After COMMIT, re-run STEP 1 to confirm no email duplicates remain.
