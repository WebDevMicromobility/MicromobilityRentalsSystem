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
  height        integer          -- rider height in cm (100–250), used for automatic bike size selection
);

-- Migration for existing databases (skip if creating fresh):
-- alter table customers add column if not exists height integer;

create table if not exists bikes (
  id     text primary key,
  name   text not null,
  size   text not null,
  type   text not null,
  colors jsonb not null default '[]',
  status text not null default 'available'
);

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

-- ── ROW LEVEL SECURITY ────────────────────────────────────────────────────────
-- The app handles its own auth (custom password hash).
-- These policies let the anon key read and write all tables.

alter table customers    enable row level security;
alter table bikes        enable row level security;
alter table sessions     enable row level security;
alter table queue_entries enable row level security;

create policy "public access" on customers     for all using (true) with check (true);
create policy "public access" on bikes         for all using (true) with check (true);
create policy "public access" on sessions      for all using (true) with check (true);
create policy "public access" on queue_entries for all using (true) with check (true);
