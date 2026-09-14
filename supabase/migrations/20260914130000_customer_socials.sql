-- ============================================================================
-- Social accounts on the profile: Instagram, X, TikTok, LinkedIn. Optional, never asked
-- at signup, seen by staff only.
--
--  1. customers.socials jsonb — {"instagram":"handle","x":"handle","tiktok":"handle",
--     "linkedin":"slug"}; bare handles, never URLs. Null when none.
--  2. customer_set_socials(p_id, p_token, p_socials): token-checked; keeps only the four
--     known keys, trims stray @ / slashes / spaces, caps each value at 100 chars, and
--     stores null when nothing is left. Adding a network later is a client change plus one
--     more key here.
--  3. customer_profile returns the column (return type changes, so drop + create).
--     Staff read and write the column straight off the table under their policies.
--
-- Rollback:
--   drop function if exists public.customer_set_socials(text,text,jsonb);
--   -- customer_profile: re-run 20260914120000's definition (without socials)
--   alter table public.customers drop column if exists socials;
-- Idempotent: safe to re-run.
-- ============================================================================

alter table public.customers add column if not exists socials jsonb;

create or replace function public.customer_set_socials(p_id text, p_token text, p_socials jsonb)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
declare clean jsonb := '{}'::jsonb; k text; v text;
begin
  if not _cust_token_ok(p_id,p_token) then return false; end if;
  if p_socials is not null and jsonb_typeof(p_socials) = 'object' then
    for k in select jsonb_object_keys(p_socials) loop
      if k in ('instagram','x','tiktok','linkedin') then
        v := left(regexp_replace(coalesce(p_socials->>k,''), '^[[:space:]@/]+|[[:space:]/]+$', '', 'g'), 100);
        if v <> '' then clean := clean || jsonb_build_object(k, v); end if;
      end if;
    end loop;
  end if;
  update customers set socials = case when clean = '{}'::jsonb then null else clean end where id = p_id;
  return true;
end $$;
revoke execute on function public.customer_set_socials(text,text,jsonb) from public;
grant  execute on function public.customer_set_socials(text,text,jsonb) to anon, authenticated;

drop function if exists public.customer_profile(text,text);
create function public.customer_profile(p_id text, p_token text)
returns table(
  id text, name text, email text, phone text, height int, type_preference text,
  created_at text, birth_date text, country text, city text, photo text,
  gender text, nationality text, socials jsonb
) language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if not _cust_token_ok(p_id,p_token) then return; end if;
  return query select c.id, c.name, c.email, c.phone, c.height, c.type_preference,
    c.created_at, c.birth_date, c.country, c.city, c.photo, c.gender, c.nationality, c.socials
  from customers c where c.id = p_id;
end $$;
revoke execute on function public.customer_profile(text,text) from public;
grant  execute on function public.customer_profile(text,text) to anon, authenticated;

-- Verify (expect: 1 row; both functions prosecdef = true):
--   select column_name from information_schema.columns where table_name='customers' and column_name='socials';
--   select proname, prosecdef from pg_proc where proname in ('customer_set_socials','customer_profile');
