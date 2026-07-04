-- ============================================================================
-- MicroMobility — Security hardening (PII lockdown)
-- RUN THIS ON A STAGING SUPABASE PROJECT FIRST. Never paste an untested
-- RLS change straight into production: a wrong policy locks out every login.
--
-- Run the SECTIONS in order. After each section, test the app before moving on.
-- ============================================================================


-- ============================================================================
-- SECTION 1 — Read-only login/lookup functions (SAFE: adds functions, changes nothing else)
-- These run with elevated rights (SECURITY DEFINER) so the customers table can
-- later be locked down while login still works.
-- ============================================================================

create extension if not exists pgcrypto;

-- Verifies the salted SHA-256 password server-side and returns ONLY the matching row.
create or replace function customer_login(p_identifier text, p_pwd text)
returns table(
  id text, name text, email text, phone text, height int,
  type_preference text, created_at text, birth_date text,
  country text, city text, photo text
)
language plpgsql security definer set search_path = public as $$
declare r customers%rowtype; parts text[];
begin
  select * into r from customers
   where lower(email) = lower(p_identifier) or phone = p_identifier
   limit 1;
  if not found then return; end if;

  -- Stored format from makePwdHash(): 'sha256:<salt>:<hex>'
  if left(r.password_hash, 7) = 'sha256:' then
    parts := string_to_array(r.password_hash, ':');
    if encode(digest(parts[2] || ':' || p_pwd, 'sha256'), 'hex') <> parts[3] then
      return;  -- wrong password
    end if;
  else
    return;  -- legacy/oauth accounts: use password reset or Google sign-in instead
  end if;

  return query select r.id, r.name, r.email, r.phone, r.height,
    r.type_preference, r.created_at, r.birth_date, r.country, r.city, r.photo;
end $$;

-- Signup duplicate check: returns a boolean only, never any PII.
create or replace function customer_exists(p_email text, p_phone text)
returns boolean
language sql security definer set search_path = public as $$
  select exists(
    select 1 from customers
    where (coalesce(p_email,'') <> '' and lower(email) = lower(p_email))
       or (coalesce(p_phone,'') <> '' and phone = p_phone));
$$;

-- Password-reset lookup: returns just id + name for the matching email.
create or replace function customer_for_reset(p_email text)
returns table(id text, name text)
language sql security definer set search_path = public as $$
  select id, name from customers where lower(email) = lower(p_email) limit 1;
$$;

-- Allow the public (anon) role to call these functions.
grant execute on function customer_login(text, text)  to anon;
grant execute on function customer_exists(text, text)  to anon;
grant execute on function customer_for_reset(text)     to anon;


-- ============================================================================
-- SECTION 2 — Lock the customers table (run ONLY after the app is calling the
-- functions above and you've verified login/signup work against staging).
-- After this, the table can no longer be read directly with the anon key.
-- ============================================================================

-- drop policy if exists "public access" on customers;
-- create policy "anon signup" on customers for insert with check (true);
-- -- No SELECT/UPDATE/DELETE policy for anon => the table is unreadable directly.
-- -- Reads now happen only through the SECURITY DEFINER functions in Section 1.


-- ============================================================================
-- SECTION 3 — Known gaps that need Supabase Auth (do NOT run Section 2 in prod
-- until these are handled, or profile editing will break):
--   * Self profile updates (saveAccount, photo) use update().eq('id',...).
--     With Section 2 applied and no UPDATE policy, they fail. Real fix = Supabase
--     Auth so a policy can scope `using (auth.uid()::text = id)`.
--   * queue_entries still stores name/email/phone readable by anyone. Split into
--     a public (no-PII) view for customers + full table for staff behind a role.
-- ============================================================================


-- ============================================================================
-- ROLLBACK (re-open everything if anything breaks)
-- ============================================================================
-- drop policy if exists "anon signup" on customers;
-- create policy "public access" on customers for all using (true) with check (true);
