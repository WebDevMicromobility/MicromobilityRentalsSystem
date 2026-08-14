-- ============================================================================
-- Approval guard: enforce only for API clients (anon / authenticated).
--
-- The original _approval_guard (20260813190000) checked only is_staff(), which
-- is false for the postgres role too — so even the dashboard SQL editor's data
-- repairs were silently reverted. Admin/service connections (postgres,
-- service_role, or anything that is not a PostgREST API role) must be able to
-- administer data; the guard exists to stop CUSTOMER-side tampering, and API
-- requests always run as anon/authenticated.
--
-- Idempotent: safe to re-run.
-- ============================================================================
create or replace function _approval_guard()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  -- Only PostgREST API requests are gated: they run as anon/authenticated.
  -- postgres (SQL editor), service_role, and other admin connections pass through.
  if current_user not in ('anon','authenticated') then return new; end if;
  if tg_op = 'INSERT' then
    if new.approval is not null and new.approval <> 'pending' and not is_staff() then
      new.approval := 'pending';
    end if;
  else
    if new.approval is distinct from old.approval and not is_staff() then
      new.approval := old.approval;
    end if;
  end if;
  return new;
end $fn$;

-- ── Bookkeeping for the Supabase CLI ─────────────────────────────────────────
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (
  version    text primary key,
  statements text[],
  name       text
);
insert into supabase_migrations.schema_migrations (version, name)
values ('20260814190000', 'approval_guard_admin_exempt')
on conflict (version) do nothing;
