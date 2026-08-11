-- Desk waitlist (staff Waitlist tab): walk-ups waiting for a bike to free up.
-- Staff record name + phone + preferred type and hand out bikes as they come back.
-- Run in the Supabase SQL editor.
create table if not exists desk_waitlist (
  id          text primary key,
  name        text not null,
  phone       text,
  bike_type   text,             -- preferred type: Any / Road / Hybrid / Mountain / Road Carbon
  status      text not null default 'waiting',  -- waiting / done (bike given) / removed
  author      text,             -- staff operator name (client-side attribution)
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);

alter table desk_waitlist enable row level security;

-- Staff-only, same lockdown as customer_notes: authed staff get full access.
drop policy if exists "staff full access" on desk_waitlist;
create policy "staff full access" on desk_waitlist
  for all using (is_staff()) with check (is_staff());
