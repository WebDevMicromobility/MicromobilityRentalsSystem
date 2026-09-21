-- ============================================================================
-- Flag history, and the rule for what a customer's name may contain.
--
-- A flag ("please correct your details") used to live only in customers.fix_fields, and
-- customer_fix_save cleared each field as the rider answered it - so once a rider replied,
-- nothing said they had ever been asked, or what they changed. Staff now have a Flagged list
-- (Community > Flagged) that needs exactly that, so each request is kept:
--
--  1. customer_flags: one row per request. fields = everything asked; status 'pending' until
--     every staff-asked field is answered, then 'answered'; 'withdrawn' if staff clear it
--     first. changes = {field: {before, after, at}} as each answer lands. At most one pending
--     row per customer (a partial unique index): asking again while one is open amends it.
--     Staff read it; nobody writes it directly - only the two functions below.
--  2. staff_flag_customer(p_customer_id, p_fields, p_by): the one way staff flag, clear or
--     re-flag an account. It sets customers.fix_fields and keeps the history row in step in a
--     single transaction, and records who asked (the desk's operator name - the staff table
--     holds no names). Staff-only (is_staff()).
--  3. customer_fix_save: rebuilt from its LIVE definition (the Apple check-up migrations had
--     already changed it from the 20260921140000 file) with two additions only - a name answer
--     must pass the name rule below, and each staff-asked answer is written into the pending
--     row with its before and after. The Apple check-up's computed asks are not staff requests
--     and are not recorded, and a password is never recorded anywhere but its hash.
--  4. The name rule. A customer may not set a name containing digits (Western, Arabic-Indic,
--     Extended Arabic-Indic, Devanagari or Bengali), ASCII symbols other than the hyphen,
--     Arabic punctuation, the general-punctuation / symbol / emoji blocks, or variation
--     selectors. Letters and combining marks of every script pass - Hindi, Nepali and Bengali
--     names are built from vowel signs that are not letters, and Arabic names may carry
--     harakat. Enforced by a BEFORE INSERT OR UPDATE OF name trigger, only when the name is
--     actually set or changed and only for non-staff callers: the 39 existing names that break
--     it are not locked out of saving the rest of their profile, and staff labels (walk-ins
--     named "Tamer 2") are untouched. The app enforces the same rule as the rider types; this
--     is the backstop for anything that reaches the table another way.
--  5. The 13 accounts flagged before this existed are seeded as pending requests (who asked,
--     and when exactly, were never stored).
--
-- Rollback:
--   drop trigger if exists customers_name_rule on public.customers;
--   drop function if exists public._customer_name_ok();
--   drop function if exists public.staff_flag_customer(text,text[],text);
--   drop table if exists public.customer_flags;
--   -- and re-apply customer_fix_save from its previous definition
-- Idempotent: safe to re-run.
-- ============================================================================

create table if not exists public.customer_flags (
  id           uuid primary key default gen_random_uuid(),
  customer_id  text not null references public.customers(id) on delete cascade,
  fields       text[] not null,
  status       text not null default 'pending',
  flagged_by   text,
  flagged_at   timestamptz not null default now(),
  answered_at  timestamptz,
  changes      jsonb not null default '{}'::jsonb,
  constraint customer_flags_status_known check (status in ('pending','answered','withdrawn')),
  constraint customer_flags_fields_known check (
    cardinality(fields) > 0 and fields <@ array[
      'name','email','phone','birth_date','gender','nationality','country','city','height','photo'
    ]::text[])
);
create index if not exists customer_flags_by_customer on public.customer_flags (customer_id, flagged_at desc);
create unique index if not exists customer_flags_one_pending on public.customer_flags (customer_id) where status = 'pending';

alter table public.customer_flags enable row level security;
drop policy if exists "staff read flags" on public.customer_flags;
create policy "staff read flags" on public.customer_flags for select to authenticated using (is_staff());
revoke all on public.customer_flags from anon, public;
grant select on public.customer_flags to authenticated;

-- ── 2. staff flag / clear / re-flag ─────────────────────────────────────────
create or replace function public.staff_flag_customer(p_customer_id text, p_fields text[], p_by text)
returns public.customer_flags language plpgsql security definer set search_path = public, extensions as $$
declare
  f text[];
  r public.customer_flags;
begin
  if not is_staff() then raise exception 'not_staff' using errcode = '42501'; end if;
  f := array(select x from unnest(coalesce(p_fields,'{}'::text[])) with ordinality u(x,o)
             where x = any(array['name','email','phone','birth_date','gender','nationality','country','city','height','photo'])
             group by x order by min(o));
  update customers set fix_fields = case when cardinality(f) = 0 then null else f end where id = p_customer_id;
  if not found then raise exception 'no_customer' using errcode = 'P0002'; end if;

  if cardinality(f) = 0 then
    update customer_flags set status = 'withdrawn', answered_at = now()
      where customer_id = p_customer_id and status = 'pending' returning * into r;
    return r;
  end if;

  -- An open request is amended in place; what was already answered stays part of what was asked.
  update customer_flags cf set
      fields = array(select distinct x from unnest(f || array(select jsonb_object_keys(cf.changes))) x),
      flagged_by = coalesce(nullif(btrim(p_by),''), cf.flagged_by)
    where cf.customer_id = p_customer_id and cf.status = 'pending' returning * into r;
  if not found then
    insert into customer_flags (customer_id, fields, flagged_by)
      values (p_customer_id, f, nullif(btrim(p_by),'')) returning * into r;
  end if;
  return r;
end $$;
revoke execute on function public.staff_flag_customer(text,text[],text) from public, anon;
grant  execute on function public.staff_flag_customer(text,text[],text) to authenticated;

-- ── 4. the name rule (defined before customer_fix_save, which checks it too) ──
create or replace function public._name_chars_ok(v text) returns boolean
language sql immutable as $$
  select v !~ '[0-9٠-٩۰-۹०-९০-৯!-,./:-@[-`{-~،؛؟«» -⯿️\U0001F000-\U0001FAFF]'
$$;

create or replace function public._customer_name_ok() returns trigger
language plpgsql as $$
begin
  if (tg_op = 'INSERT' or new.name is distinct from old.name)
     and new.name is not null and not is_staff() and not _name_chars_ok(new.name) then
    raise exception 'name_chars' using errcode = '22023',
      hint = 'A name may contain letters, spaces and a hyphen only.';
  end if;
  return new;
end $$;
drop trigger if exists customers_name_rule on public.customers;
create trigger customers_name_rule before insert or update of name on public.customers
  for each row execute function public._customer_name_ok();

-- ── 3. customer_fix_save: the live definition + the name rule + the history ─
create or replace function public.customer_fix_save(p_id text, p_token text, p_values jsonb)
returns text[] language plpgsql security definer set search_path = public, extensions as $$
declare
  c      customers%rowtype;
  n      customers%rowtype;
  stored text[];
  flags  text[];
  done   text[] := '{}';
  k text;
  v text;
begin
  if not _cust_token_ok(p_id,p_token) then return null; end if;
  select * into c from customers where customers.id = p_id for update;
  if not found then return null; end if;
  stored := coalesce(c.fix_fields,'{}'::text[]);
  flags := _customer_asks(p_id);
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
    if k = 'password' then
      v := p_values->>'password';                                -- a password is taken as typed, never trimmed
      if char_length(coalesce(v,'')) < 8 then continue; end if;
      update customers set password_hash = crypt(v, gen_salt('bf')) where id = p_id;
      done := done || k;
      continue;
    end if;
    v := nullif(btrim(coalesce(p_values->>k,'')),'');
    if v is null then continue; end if;                       -- an empty answer fixes nothing
    case k
      when 'name' then
        if char_length(v) < 2 then continue; end if;
        if not _name_chars_ok(v) then continue; end if;         -- leaves the flag up rather than failing the save
        update customers set name = left(v,120) where id = p_id;
      when 'email' then
        v := lower(v);
        if v !~ '^[^[:space:]@<>"''()]+@[^[:space:]@<>"''()]+\.[^[:space:]@<>"''()]+$' then continue; end if;
        if v like '%@privaterelay.appleid.com' then continue; end if;   -- the main email is a real one
        if exists(select 1 from customers o where o.id <> p_id
                    and (lower(btrim(o.email)) = v or lower(btrim(o.apple_email)) = v)) then
          raise exception 'email_taken' using errcode = '23505';
        end if;
        update customers set email = v where id = p_id;        -- the trigger keeps the relay address
      when 'phone' then
        if v !~ '^\+?[0-9]{8,15}$' then continue; end if;
        if exists(select 1 from customers o where o.phone = v and o.id <> p_id) then
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

  -- Only staff flags are stored; the two computed asks disappear once they are answered.
  stored := array(select f from unnest(stored) f where f <> all(done));
  update customers set fix_fields = case when cardinality(stored) = 0 then null else stored end where id = p_id;

  -- The request's history: each staff-asked field that was answered, before and after. The
  -- country/city pair is recorded together. Computed asks and the password are not.
  if cardinality(done) > 0 then
    select * into n from customers where customers.id = p_id;
    update customer_flags cf set
        changes = cf.changes || coalesce((
          select jsonb_object_agg(k2, jsonb_build_object('before', to_jsonb(c)->k2, 'after', to_jsonb(n)->k2, 'at', now()))
          from unnest(done) k2
          where k2 <> 'password'
            and (k2 = any(cf.fields) or (k2 in ('country','city') and cf.fields && array['country','city']))), '{}'::jsonb),
        status      = case when cardinality(stored) = 0 then 'answered' else 'pending' end,
        answered_at = case when cardinality(stored) = 0 then now() else null end
      where cf.customer_id = p_id and cf.status = 'pending';
  end if;

  return array(select f from unnest(flags) f where f <> all(done));
end $$;
revoke execute on function public.customer_fix_save(text,text,jsonb) from public;
grant  execute on function public.customer_fix_save(text,text,jsonb) to anon, authenticated;

-- ── 5. the flags that were already standing ─────────────────────────────────
insert into public.customer_flags (customer_id, fields, flagged_by, flagged_at)
select c.id, c.fix_fields, null, now()
from public.customers c
where c.fix_fields is not null and cardinality(c.fix_fields) > 0
  and not exists (select 1 from public.customer_flags f where f.customer_id = c.id and f.status = 'pending');

-- Verify:
--   select status, count(*) from customer_flags group by 1;                 -- pending = 13
--   select proname, prosecdef from pg_proc where proname in
--     ('staff_flag_customer','customer_fix_save');                           -- both true
--   select tgname from pg_trigger where tgname = 'customers_name_rule';      -- 1 row
-- Then run supabase/checks/security-attributes.sql (expect no rows).
