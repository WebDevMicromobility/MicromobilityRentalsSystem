-- Staff notes on customers (Notes tab). Run this in the Supabase SQL editor.
create table if not exists customer_notes (
  id            text primary key,
  customer_id   text,             -- links to customers.id when known (walk-ins may have none)
  customer_name text not null,
  phone         text,
  note          text not null,
  author        text,             -- staff operator name (client-side attribution)
  booking_id    text,             -- optional: the queue_entries booking this note was written on
  created_at    timestamptz not null default now()
);

-- If you already created the table without it:
alter table customer_notes add column if not exists booking_id text;

alter table customer_notes enable row level security;

-- Staff-only, matching the bikes/sessions/inventory lockdown: authed staff get full access.
drop policy if exists "staff full access" on customer_notes;
create policy "staff full access" on customer_notes
  for all using (is_staff()) with check (is_staff());
