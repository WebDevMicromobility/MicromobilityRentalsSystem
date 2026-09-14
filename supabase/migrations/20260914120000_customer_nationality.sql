-- ============================================================================
-- Nationality on the account: an optional profile field, never asked at signup.
--
--  1. customers.nationality (text, nullable). Values are the country names the app
--     already uses for `country` (COUNTRY_LIST), so the Arabic labels come for free.
--  2. customer_update_profile gets an 11-parameter overload that also takes
--     p_nationality. The 10-parameter one stays, so a client from before this ships
--     keeps saving; PostgREST picks the overload by the named parameters it receives.
--  3. customer_profile(p_id, p_token): the row's own safe profile, token-checked. The
--     login / reset RPCs return a fixed column list without the new field; the app
--     asks this once per session to fill it in rather than rewriting the throttled
--     login functions. Staff read the column straight off the table (their policies
--     already cover every column).
--
-- Rollback:
--   drop function if exists public.customer_profile(text,text);
--   drop function if exists public.customer_update_profile(text,text,text,text,text,int,text,text,text,text,text);
--   alter table public.customers drop column if exists nationality;
-- Idempotent: safe to re-run.
-- ============================================================================

alter table public.customers add column if not exists nationality text;

create or replace function public.customer_update_profile(
  p_id text, p_token text, p_name text, p_email text, p_phone text,
  p_height int, p_type_preference text, p_birth_date text, p_country text, p_city text,
  p_nationality text
) returns boolean language plpgsql security definer set search_path = public, extensions as $$
begin
  if not _cust_token_ok(p_id,p_token) then return false; end if;
  update customers set
    name=p_name, email=p_email, phone=p_phone, height=p_height,
    type_preference=p_type_preference, birth_date=p_birth_date,
    country=p_country, city=p_city, nationality=p_nationality
  where id=p_id;
  return true;
end $$;
revoke execute on function public.customer_update_profile(text,text,text,text,text,int,text,text,text,text,text) from public;
grant  execute on function public.customer_update_profile(text,text,text,text,text,int,text,text,text,text,text) to anon, authenticated;

create or replace function public.customer_profile(p_id text, p_token text)
returns table(
  id text, name text, email text, phone text, height int, type_preference text,
  created_at text, birth_date text, country text, city text, photo text,
  gender text, nationality text
) language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if not _cust_token_ok(p_id,p_token) then return; end if;
  return query select c.id, c.name, c.email, c.phone, c.height, c.type_preference,
    c.created_at, c.birth_date, c.country, c.city, c.photo, c.gender, c.nationality
  from customers c where c.id = p_id;
end $$;
revoke execute on function public.customer_profile(text,text) from public;
grant  execute on function public.customer_profile(text,text) to anon, authenticated;

-- Verify (expect: 1 column row, both functions security definer):
--   select column_name from information_schema.columns where table_name='customers' and column_name='nationality';
--   select proname, prosecdef, pronargs from pg_proc where proname in ('customer_profile','customer_update_profile');
