-- MicroMobility Corniche Circuit — Supabase Schema
-- Run this entire file in your Supabase project → SQL Editor → New query
--
-- ⚠️ Supabase projects created after the 2025 platform change no longer grant
--    the anon/authenticated roles access to the public schema by default, so
--    this file alone yields 42501 "permission denied for schema public" for
--    the app. For a new project use new-project-setup.sql instead (full column
--    set + the required GRANTs, idempotent).

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
-- alter table queue_entries add column if not exists pay_method text;  -- 'card' | 'cash' | 'split' for a paid rental (close-out card/cash split)
-- alter table queue_entries add column if not exists card_amount numeric;  -- SAR paid by card on a split rental; the rest is cash
-- alter table queue_entries add column if not exists checked_in_at text;   -- exact check-in timestamp (ISO; set when staff taps Check In)
-- alter table queue_entries add column if not exists checked_out_at text;  -- exact check-out timestamp (ISO; set when staff taps Return Bike)

-- Optional but RECOMMENDED: stop two devices from issuing the same queue number in a session.
-- The client retries on conflict, so this is the hard guarantee. Partial so cancelled/removed rows don't collide.
-- If the index errors with 23505 (duplicate key), dedupe FIRST with the renumber query below, then create it.
--
-- Dedupe (renumbers only the duplicate copies, pushing them above each session's max - earliest row keeps its number):
--   with ranked as (
--     select id, session_id, queue_num,
--            row_number() over (partition by session_id, queue_num order by registered_at, id) as rn
--     from queue_entries where status not in ('cancelled','removed','noshow')),
--   maxes as (
--     select session_id, max(queue_num) as maxq from queue_entries
--     where status not in ('cancelled','removed','noshow') group by session_id),
--   to_fix as (
--     select r.id, m.maxq + row_number() over (partition by r.session_id order by r.queue_num, r.id) as new_num
--     from ranked r join maxes m on m.session_id = r.session_id where r.rn > 1)
--   update queue_entries q set queue_num = f.new_num from to_fix f where q.id = f.id;
--
-- create unique index if not exists queue_entries_session_qnum_uniq
--   on queue_entries (session_id, queue_num)
--   where status not in ('cancelled','removed','noshow');

-- Optional: JS error capture (the app inserts here tolerantly; safe to skip)
-- create table if not exists error_log (id bigint generated always as identity primary key, at text, msg text, src text, ua text);
-- alter table error_log enable row level security;
-- create policy "error insert" on error_log for insert with check (true);

-- Optional but RECOMMENDED: cross-device staff audit trail (the app inserts here tolerantly; safe to skip).
-- 'who' is the operator name set in the Logs tab; 'device' is a stable per-browser id.
-- create table if not exists staff_actions (
--   id      bigint generated always as identity primary key,
--   at      text,
--   action  text,
--   who     text,
--   device  text,
--   view    text
-- );
-- alter table staff_actions enable row level security;
-- create policy "audit insert" on staff_actions for insert with check (true);
-- create policy "audit read"   on staff_actions for select using (true);

-- Optional: link cashier sales to a customer account (Sales tab account picker; the app tolerates its absence)
-- alter table cashier_sales add column if not exists customer_id text;

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
-- alter table inventory add column if not exists flavour text;     -- supplements/beverages flavour (saved tolerantly; safe to skip)
-- alter table inventory add column if not exists volume_ml integer; -- drink/beverage volume in ml (saved tolerantly; safe to skip)
-- alter table inventory add column if not exists nutrition text;    -- JSON blob of nutrition facts (calories/protein/etc; saved tolerantly; safe to skip)
-- alter table bikes     add column if not exists photo text;  -- bike photo (data URL)

-- ── ROW LEVEL SECURITY ────────────────────────────────────────────────────────
-- These are the INITIAL open policies used while a project is first set up. The
-- production security model is the hardened one applied by security-migration.sql:
--   • customer PII (customers, queue_entries) is not readable by the public anon
--     key — all customer access goes through SECURITY DEFINER RPCs and a no-PII
--     availability view; staff read via authenticated Supabase Auth sessions
--   • writes to bikes/sessions/inventory/promo_codes are restricted to staff
--   • passwords are bcrypt; customer login is rate-limited
-- Run this file to create the tables, then run security-migration.sql to apply the
-- production access-control model. Do not leave the open policies below in place.

alter table customers    enable row level security;
alter table bikes        enable row level security;
alter table sessions     enable row level security;
alter table queue_entries enable row level security;
alter table inventory    enable row level security;
alter table promo_codes  enable row level security;

-- Initial open policies (replaced by security-migration.sql in production).
create policy "public access" on customers     for all using (true) with check (true);
create policy "public access" on bikes         for all using (true) with check (true);
create policy "public access" on sessions      for all using (true) with check (true);
create policy "public access" on queue_entries for all using (true) with check (true);
create policy "public access" on inventory     for all using (true) with check (true);
create policy "public access" on promo_codes   for all using (true) with check (true);
