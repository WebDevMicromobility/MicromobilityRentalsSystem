-- Shared "MM Team" roster so team-member names sync across all devices (instead of only
-- living in the device's localStorage). Run once in the Supabase SQL editor.
-- Team names aren't sensitive PII, so the app (anon key) may read and manage them directly.

create table if not exists public.team_members (
  name       text primary key,
  created_at timestamptz not null default now()
);

alter table public.team_members enable row level security;

drop policy if exists team_members_read  on public.team_members;
drop policy if exists team_members_write on public.team_members;
create policy team_members_read  on public.team_members for select using (true);
create policy team_members_write on public.team_members for all    using (true) with check (true);

grant select, insert, update, delete on public.team_members to anon, authenticated;

-- Seed it with any names already used in past sales, so nothing is lost:
insert into public.team_members (name)
select distinct team_name from public.cashier_sales
where team_name is not null and team_name <> ''
on conflict (name) do nothing;
