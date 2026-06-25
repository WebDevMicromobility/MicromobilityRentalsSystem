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
  type_preference text,          -- preferred bike type (Road | Hybrid | Mountain | Gravel | Any), set at signup
  gender        text,            -- 'male' | 'female', collected at signup
  birth_date    text,            -- optional 'YYYY-MM-DD'
  country       text,            -- optional
  city          text,            -- optional (depends on country)
  photo         text             -- optional profile photo as a data URL (or Google avatar URL)
);

-- Migration for existing databases (skip if creating fresh):
-- alter table customers add column if not exists height integer;
-- alter table customers add column if not exists type_preference text;
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
  color_names jsonb not null default '[]',  -- per-color display names, parallel to colors
  status      text not null default 'available',
  brand       text,            -- optional manufacturer (e.g. 'Trek')
  model       text,            -- optional model name
  groupset    text,            -- optional drivetrain groupset
  speeds      integer,         -- optional number of gears
  rental_price numeric,        -- optional per-ride override price (falls back to type price)
  location    text,            -- e.g. 'JCC'; order in the list sets the location number
  frame_type  text,            -- 'Steel' | 'Aluminum' | 'Carbon' | 'Titanium'
  bike_number integer,         -- globally unique across the whole fleet; padded to 4 digits in the auto name
  in_service_date text,        -- 'YYYY-MM-DD' date the bike started being used
  retired_date    text,        -- 'YYYY-MM-DD' date the bike was retired (null while active)
  photo           text         -- optional bike photo as a data URL
);

-- Migration for existing databases (skip if creating fresh):
-- alter table bikes add column if not exists color_names jsonb not null default '[]';
-- alter table bikes add column if not exists brand text;
-- alter table bikes add column if not exists model text;
-- alter table bikes add column if not exists groupset text;
-- alter table bikes add column if not exists speeds integer;
-- alter table bikes add column if not exists rental_price numeric;
-- alter table bikes add column if not exists location text;
-- alter table bikes add column if not exists frame_type text;
-- alter table bikes add column if not exists bike_number integer;
-- alter table bikes add column if not exists in_service_date text;   -- REQUIRED: live DB is missing this; Add/Edit/Retire bike fails without it
-- alter table bikes add column if not exists retired_date text;      -- REQUIRED: live DB is missing this; Retire/Restore bike fails without it

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
  bike_slots   text,            -- JSON: {"Road":{"XS":0,"S":0,"M":2,"L":1},"Hybrid":{...},"Mountain":{...}}
  location     text,            -- branch this session runs at (e.g. 'JCC', 'Sharafeyah Branch')
  addons       text             -- JSON array of inventory item ids offered as add-ons for this session
);

-- Migration for existing databases:
-- alter table sessions add column if not exists bike_slots text;
-- alter table sessions add column if not exists location text;
-- alter table sessions add column if not exists addons text;
-- alter table queue_entries add column if not exists addons text;  -- selected add-on item ids per booking

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
  customer_id      text references customers(id),
  height           integer,         -- rider height in cm captured at booking (drives size)
  ride_duration    integer,         -- minutes the ride lasted (set on return), null until completed
  rating_bike      integer,         -- post-ride bike rating 1-10
  rating_exp       integer,         -- post-ride experience rating 1-10
  feedback         text             -- optional post-ride comment
);

-- Migration for existing databases (skip if creating fresh):
-- alter table queue_entries add column if not exists height integer;
-- alter table queue_entries add column if not exists ride_duration integer;
-- alter table queue_entries add column if not exists rating_bike integer;
-- alter table queue_entries add column if not exists rating_exp integer;
-- alter table queue_entries add column if not exists feedback text;
-- alter table queue_entries add column if not exists addons text;     -- selected add-on item ids per booking
-- alter table queue_entries add column if not exists promo_code text; -- promo code applied to the booking
-- alter table queue_entries add column if not exists purchases text;  -- JSON array of cashier purchases sold with the rental (cashier system)

-- Standalone cashier / point-of-sale transactions (the Cashier staff tab). Walk-up or counter sales.
create table if not exists cashier_sales (
  id            text primary key,
  session_id    text,
  customer_name text,            -- optional label (walk-up name); null = walk-up
  item_id       text,            -- inventory item id if sold from stock (drives stock decrement), else null
  receipt_id    text,            -- groups multiple line items sold together as one receipt
  name          text not null,
  category      text,            -- inventory category key (Helmet, ProteinGummies, ...)
  qty           integer not null default 1,
  price         numeric not null default 0,   -- unit price
  pay           text not null default 'paid', -- paid | pending | house | team
  team_name     text,            -- MM Team member name when pay = team
  created_at    text
);
-- alter table cashier_sales enable row level security;
-- create policy "public access" on cashier_sales for all using (true) with check (true);

-- Promo codes (staff-defined discounts applied at checkout)
create table if not exists promo_codes (
  id         text primary key,
  code       text not null,
  kind       text not null default 'percent',  -- 'percent' | 'flat'
  value      numeric not null default 0,
  active     boolean not null default true,
  created_at text
);

-- Inventory: helmets, accessories and spare-part stock (Inventory tab)
create table if not exists inventory (
  id            text primary key,
  name          text not null,
  brand         text,                            -- optional brand
  category      text not null default 'Other',  -- Helmet | Accessory | ProteinGummies | ElectrolyteSachets | EnergyGels | custom
  qty           integer not null default 0,
  low_threshold integer not null default 0,      -- "low stock" warning fires when qty <= this
  price         numeric,         -- optional per-unit price (SAR); used for add-on sales reporting
  updated_at    text,
  photo         text             -- optional item photo as a data URL
);
-- Migration for existing inventory tables:
-- alter table inventory add column if not exists brand text;
-- alter table inventory add column if not exists photo text;
-- alter table inventory add column if not exists price numeric;   -- add-on unit price (SAR), used for sales reporting
-- alter table bikes     add column if not exists photo text;  -- bike photo (data URL)

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
alter table promo_codes  enable row level security;

create policy "public access" on customers     for all using (true) with check (true);
create policy "public access" on bikes         for all using (true) with check (true);
create policy "public access" on sessions      for all using (true) with check (true);
create policy "public access" on queue_entries for all using (true) with check (true);
create policy "public access" on inventory     for all using (true) with check (true);
create policy "public access" on promo_codes   for all using (true) with check (true);
