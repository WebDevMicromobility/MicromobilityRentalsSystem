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

-- Payment while waiting (same Pending / Cash / Card / Split / On-the-house states as the
-- queue). Carried onto the real booking when the rider is checked in.
alter table desk_waitlist add column if not exists paid        boolean not null default false;
alter table desk_waitlist add column if not exists price       numeric;
alter table desk_waitlist add column if not exists pay_method  text;
alter table desk_waitlist add column if not exists card_amount numeric;

alter table desk_waitlist enable row level security;

-- Staff-only, same lockdown as customer_notes: authed staff get full access.
drop policy if exists "staff full access" on desk_waitlist;
create policy "staff full access" on desk_waitlist
  for all using (is_staff()) with check (is_staff());

-- Staff Managed Waitlist: a second, hand-ordered list on the same page.
-- kind 'walkup' (default) = first-come walk-up list; 'managed' = staff-curated,
-- ordered by sort_order (renumbered 1..n on every drag / arrow move).
alter table desk_waitlist add column if not exists kind text not null default 'walkup';
alter table desk_waitlist add column if not exists sort_order int;

-- A managed-list entry can reference an existing waitlisted BOOKING (added from the
-- Waitlist page): it then shows the booking number and its action is Promote, not Check In.
alter table desk_waitlist add column if not exists booking_id text;
