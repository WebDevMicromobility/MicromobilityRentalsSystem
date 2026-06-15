-- MicroMobility Corniche Circuit — Supabase Schema
-- Run this entire file in your Supabase project → SQL Editor → New query

-- ── TABLES ────────────────────────────────────────────────────────────────────

create table if not exists customers (
  id            text primary key,
  name          text not null,
  email         text,
  phone         text,
  password_hash text not null,
  created_at    text not null,
  height        integer,         -- rider height in cm (100-250), used for automatic bike size selection
  gender        text,            -- 'male' | 'female', collected at signup
  birth_date    text,            -- optional 'YYYY-MM-DD'
  country       text,            -- optional
  city          text,            -- optional (depends on country)
  photo         text             -- optional profile photo as a data URL (or Google avatar URL)
);

-- Migration for existing databases (skip if creating fresh):
-- alter table customers add column if not exists height integer;
-- alter table customers add column if not exists gender text;
-- alter table customers add column if not exists birth_date text;
-- alter table customers add column if not exists country text;
-- alter table customers add column if not exists city text;
-- alter table customers add column if not exists photo text;

create table if not exists bikes (
  id          text primary key,
  name        text not null,
  size        text not null,
  type        text not null,
  colors      jsonb not null default '[]',
  status      text not null default 'available',
  location    text,            -- e.g. 'JCC'; order in the list sets the location number
  frame_type  text,            -- 'Steel' | 'Aluminum' | 'Carbon' | 'Titanium'
  bike_number integer,         -- globally unique across the whole fleet; padded to 4 digits in the auto name
  in_service_date text,        -- 'YYYY-MM-DD' date the bike started being used
  retired_date    text         -- 'YYYY-MM-DD' date the bike was retired (null while active)
);

-- Migration for existing databases (skip if creating fresh):
-- alter table bikes add column if not exists location text;
-- alter table bikes add column if not exists frame_type text;
-- alter table bikes add column if not exists bike_number integer;
-- alter table bikes add column if not exists in_service_date text;
-- alter table bikes add column if not exists retired_date text;

-- Enforce globally-unique bike numbers at the database level (prevents two staff colliding).
-- Partial index so multiple NULLs are still allowed.
create unique index if not exists bikes_bike_number_uniq
  on bikes (bike_number) where bike_number is not null;

create table if not exists sessions (
  id           text primary key,
  day          text not null,
  session_date text not null,
  capacity     integer not null default 12,
  status       text not null default 'closed',
  created_at   bigint not null,
  bike_slots   text             -- JSON: {"Road":{"XS":0,"S":0,"M":2,"L":1},"Hybrid":{...},"Mountain":{...}}
);

-- Migration for existing databases:
-- alter table sessions add column if not exists bike_slots text;

create table if not exists queue_entries (
  id               text primary key,
  name             text not null,
  email            text,
  phone            text,
  size             text not null,
  type_preference  text not null,
  paid             boolean not null default false,
  price            numeric not null default 30,
  assigned_bike_id text references bikes(id),
  session_id       text not null,
  session_day      text not null,
  session_date     text not null,
  queue_num        integer not null,
  status           text not null default 'waiting',
  registered_at    text not null,
  walk_in          boolean not null default false,
  customer_id      text references customers(id)
);

-- Inventory: helmets, accessories and spare-part stock (Inventory tab)
create table if not exists inventory (
  id            text primary key,
  name          text not null,
  category      text not null default 'Other',  -- Helmet | Accessory | SparePart | Apparel | Other
  qty           integer not null default 0,
  low_threshold integer not null default 0,      -- "low stock" warning fires when qty <= this
  updated_at    text
);

-- ── ROW LEVEL SECURITY ────────────────────────────────────────────────────────
-- SECURITY WARNING -------------------------------------------------------------
-- The policies below grant the public anon key full read/write on every table.
-- Because the anon key ships in the browser, ANYONE can currently read all
-- customer rows (names, emails, phones) and all queue entries. Passwords are now
-- stored as salted SHA-256 (see makePwdHash in index.html), but the PII is still
-- world-readable under these policies. This is acceptable only for a demo.
--
-- RECOMMENDED FREE HARDENING (Supabase free tier, no extra cost) -- do this when
-- you are ready to migrate auth; it changes how the client talks to the DB:
--   1. Move customer auth to Supabase Auth (auth.users) instead of the custom
--      customers.password_hash flow, OR keep custom auth but route login/signup
--      through a SECURITY DEFINER RPC (example below) so the table itself can be
--      locked down.
--   2. Replace the customers "public access" policy with:
--        - INSERT: allow (signup), but
--        - SELECT/UPDATE/DELETE: restrict to the row's own auth.uid()
--      so a visitor can never dump every customer.
--   3. Denormalized PII in queue_entries (name/email/phone) should be readable
--      only by staff; gate it behind a staff role / service-side function.
--
-- Example SECURITY DEFINER login RPC (lets you lock down SELECT on customers):
--   create or replace function customer_login(p_filter text, p_hash text)
--   returns table(id text, name text, email text, phone text)
--   language sql security definer set search_path = public as $$
--     select id, name, email, phone from customers
--     where (email = p_filter or phone = p_filter) and password_hash = p_hash
--     limit 1;
--   $$;
-- -----------------------------------------------------------------------------
-- Current (demo) policies: the anon key can read and write all tables.

alter table customers    enable row level security;
alter table bikes        enable row level security;
alter table sessions     enable row level security;
alter table queue_entries enable row level security;
alter table inventory    enable row level security;

create policy "public access" on customers     for all using (true) with check (true);
create policy "public access" on bikes         for all using (true) with check (true);
create policy "public access" on sessions      for all using (true) with check (true);
create policy "public access" on queue_entries for all using (true) with check (true);
create policy "public access" on inventory     for all using (true) with check (true);
