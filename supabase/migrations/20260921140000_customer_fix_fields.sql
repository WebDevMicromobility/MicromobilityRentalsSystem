-- ============================================================================
-- Staff ask a rider to correct their account. On the account editor staff tick the fields
-- that may be wrong; the next time the rider picks an event they meet one message listing
-- those fields, and cannot book until every one of them is answered.
--
--  1. customers.fix_fields text[] — the flagged fields, by column name. Null when nothing
--     is asked. Staff write it straight off the table (their update policy already covers
--     every column, and anon/authenticated hold table-level grants). A check constraint
--     keeps it to the fields the app knows how to ask for.
--  2. customer_fix_fields(p_id, p_token): the caller's own flags, token-checked. Null for a
--     bad token, an empty array when nothing is asked.
--  3. customer_fix_save(p_id, p_token, p_values jsonb): writes the answers and clears the
--     flags they answer, in one transaction. Only a FLAGGED field can be written through
--     here, so it is not a second way to edit the whole profile. An answer that is empty or
--     malformed writes nothing and leaves its flag up. Country and city are answered as a
--     pair (a flag on either takes both). Returns the flags still standing.
--     An email or phone already on another account raises email_taken / phone_taken
--     (errcode 23505) and writes nothing at all.
--     Gender has no customer-side setter anywhere else; this is the only way a rider can
--     change it, and only when staff asked.
--
-- Rollback:
--   drop function if exists public.customer_fix_save(text,text,jsonb);
--   drop function if exists public.customer_fix_fields(text,text);
--   alter table public.customers drop constraint if exists customers_fix_fields_known;
--   alter table public.customers drop column if exists fix_fields;
-- Idempotent: safe to re-run.
-- ============================================================================

alter table public.customers add column if not exists fix_fields text[];

alter table public.customers drop constraint if exists customers_fix_fields_known;
alter table public.customers add constraint customers_fix_fields_known check (
  fix_fields is null or fix_fields <@ array[
    'name','email','phone','birth_date','gender','nationality','country','city','height','photo'
  ]::text[]
);

create or replace function public.customer_fix_fields(p_id text, p_token text)
returns text[] language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if not _cust_token_ok(p_id,p_token) then return null; end if;
  return (select coalesce(c.fix_fields,'{}'::text[]) from customers c where c.id = p_id);
end $$;
revoke execute on function public.customer_fix_fields(text,text) from public;
grant  execute on function public.customer_fix_fields(text,text) to anon, authenticated;

create or replace function public.customer_fix_save(p_id text, p_token text, p_values jsonb)
returns text[] language plpgsql security definer set search_path = public, extensions as $$
declare
  flags text[];
  done  text[] := '{}';
  k text;
  v text;
begin
  if not _cust_token_ok(p_id,p_token) then return null; end if;
  select coalesce(c.fix_fields,'{}'::text[]) into flags from customers c where c.id = p_id for update;
  if flags is null then return null; end if;
  if p_values is null or jsonb_typeof(p_values) <> 'object' then return flags; end if;

  -- Country and city are answered together: a city belongs to its country, so a flag on
  -- either takes both answers and a new country never keeps the old one's city. The city
  -- may be empty for a country the app has no city list for.
  if 'country' = any(flags) or 'city' = any(flags) then
    v := nullif(btrim(coalesce(p_values->>'country','')),'');
    if v is not null then
      update customers set country = left(v,80),
        city = left(nullif(btrim(coalesce(p_values->>'city','')),''),120)
      where id = p_id;
      done := done || array['country','city'];
    end if;
  end if;

  foreach k in array flags loop
    if not (p_values ? k) then continue; end if;
    v := nullif(btrim(coalesce(p_values->>k,'')),'');
    if v is null then continue; end if;                       -- an empty answer fixes nothing
    case k
      when 'name' then
        if char_length(v) < 2 then continue; end if;
        update customers set name = left(v,120) where id = p_id;
      when 'email' then
        v := lower(v);
        if v !~ '^[^[:space:]@<>"''()]+@[^[:space:]@<>"''()]+\.[^[:space:]@<>"''()]+$' then continue; end if;
        if exists(select 1 from customers c where lower(btrim(c.email)) = v and c.id <> p_id) then
          raise exception 'email_taken' using errcode = '23505';
        end if;
        update customers set email = v where id = p_id;
      when 'phone' then
        if v !~ '^\+?[0-9]{8,15}$' then continue; end if;
        if exists(select 1 from customers c where c.phone = v and c.id <> p_id) then
          raise exception 'phone_taken' using errcode = '23505';
        end if;
        update customers set phone = v where id = p_id;
      when 'birth_date' then
        if v !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then continue; end if;
        update customers set birth_date = v where id = p_id;
      when 'gender' then
        if v not in ('male','female') then continue; end if;
        update customers set gender = v where id = p_id;
      when 'nationality' then update customers set nationality = left(v,80) where id = p_id;
      when 'country', 'city' then continue;                      -- answered above, as a pair
      when 'height' then
        if v !~ '^[0-9]{3}$' or v::int not between 100 and 250 then continue; end if;
        update customers set height = v::int where id = p_id;
      when 'photo' then
        if v !~ '^https://' then continue; end if;                -- Storage URLs only, never a data URL
        update customers set photo = v where id = p_id;
      else continue;
    end case;
    done := done || k;
  end loop;

  flags := array(select f from unnest(flags) f where f <> all(done));
  update customers set fix_fields = case when cardinality(flags) = 0 then null else flags end where id = p_id;
  return flags;
end $$;
revoke execute on function public.customer_fix_save(text,text,jsonb) from public;
grant  execute on function public.customer_fix_save(text,text,jsonb) to anon, authenticated;

-- Verify (expect: 1 column row; both functions prosecdef = true; the constraint present):
--   select column_name, data_type from information_schema.columns where table_name='customers' and column_name='fix_fields';
--   select proname, prosecdef from pg_proc where proname in ('customer_fix_fields','customer_fix_save');
--   select conname from pg_constraint where conname='customers_fix_fields_known';
-- Then run supabase/checks/security-attributes.sql (expect no rows).
