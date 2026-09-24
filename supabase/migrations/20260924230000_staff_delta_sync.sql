-- Staff devices keep their own copy of the bookings, the riders and the rider tags, and ask
-- only for what changed since they last looked.
--
-- Measured on 2026-09-24 (edge logs, 24 hours): staff devices read 484,000 booking rows
-- (~440 MB of JSON), 216,000 rider rows and 241,000 tag rows. Every time a booth phone or the
-- desk Mac opened the app it read the 60-day window and then the whole year (~5,300 rows,
-- ~4.7 MB), the year again every half hour while it stayed open, and the whole rider list and
-- tag list on every open. That was about three quarters of the project's egress.
--
--   updated_at       stamped by a trigger on every insert and update, whatever wrote the row
--                    (the app, an RPC, another trigger, the dashboard). Named zz_ so it runs
--                    after every other BEFORE trigger: the guards compare the columns they own
--                    and never see this one move. A row copied from another cannot keep the
--                    old stamp, because an insert is stamped too.
--   sync_deletions   what a delete leaves behind (table, key, when), so a device drops the rows
--                    it still holds. Kept 45 days; a copy older than that is read again whole.
--   staff_sync()     one call, one snapshot: the rows changed after p_since (all of them when
--                    p_since is null), the keys deleted after it, and the server's clock for
--                    the next ask. STABLE, so every read inside it sees the same snapshot.
--                    Invoker rights: the tables' own staff policies decide what it returns, and
--                    it refuses anyone who is not staff outright.
--
-- The client falls back to the old reads while this function does not exist, so the app can
-- ship before or after this migration.

begin;

-- 1. The stamp ───────────────────────────────────────────────────────────────
alter table public.queue_entries add column if not exists updated_at timestamptz not null default now();
alter table public.customers     add column if not exists updated_at timestamptz not null default now();
alter table public.customer_tags add column if not exists updated_at timestamptz not null default now();

create index if not exists queue_entries_updated_at_idx on public.queue_entries (updated_at);
create index if not exists customers_updated_at_idx     on public.customers (updated_at);
create index if not exists customer_tags_updated_at_idx on public.customer_tags (updated_at);

create or replace function public._sync_touch()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $fn$
begin
  new.updated_at := now();
  return new;
end
$fn$;

drop trigger if exists zz_sync_touch on public.queue_entries;
create trigger zz_sync_touch before insert or update on public.queue_entries
  for each row execute function public._sync_touch();
drop trigger if exists zz_sync_touch on public.customers;
create trigger zz_sync_touch before insert or update on public.customers
  for each row execute function public._sync_touch();
drop trigger if exists zz_sync_touch on public.customer_tags;
create trigger zz_sync_touch before insert or update on public.customer_tags
  for each row execute function public._sync_touch();

-- 2. What a delete leaves behind ─────────────────────────────────────────────
create table if not exists public.sync_deletions (
  tbl        text        not null,
  row_id     text        not null,
  deleted_at timestamptz not null default now()
);
create index if not exists sync_deletions_deleted_at_idx on public.sync_deletions (deleted_at);
alter table public.sync_deletions enable row level security;
revoke all on public.sync_deletions from anon, authenticated;
grant select on public.sync_deletions to authenticated;
drop policy if exists "staff read" on public.sync_deletions;
create policy "staff read" on public.sync_deletions for select to authenticated
  using ((select is_staff()));

-- The key columns come as trigger arguments; a composite key is joined with '|', which no
-- customer or tag id contains. Definer: the deleting role has no right to write this table.
create or replace function public._sync_tombstone()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  o jsonb := to_jsonb(old);
  k text;
  parts text[] := '{}';
begin
  foreach k in array tg_argv loop
    parts := parts || coalesce(o ->> k, '');
  end loop;
  insert into sync_deletions (tbl, row_id) values (tg_table_name, array_to_string(parts, '|'));
  delete from sync_deletions where deleted_at < now() - interval '45 days';
  return old;
end
$fn$;
revoke all on function public._sync_tombstone() from public, anon, authenticated;

drop trigger if exists zz_sync_tombstone on public.queue_entries;
create trigger zz_sync_tombstone after delete on public.queue_entries
  for each row execute function public._sync_tombstone('id');
drop trigger if exists zz_sync_tombstone on public.customers;
create trigger zz_sync_tombstone after delete on public.customers
  for each row execute function public._sync_tombstone('id');
drop trigger if exists zz_sync_tombstone on public.customer_tags;
create trigger zz_sync_tombstone after delete on public.customer_tags
  for each row execute function public._sync_tombstone('customer_id', 'tag_id');

-- 3. The read ────────────────────────────────────────────────────────────────
create or replace function public.staff_sync(p_table text, p_since timestamptz default null, p_cut text default null)
returns jsonb
language plpgsql
stable
set search_path = public, pg_temp
as $fn$
declare
  v_rows jsonb;
  v_del  jsonb := '[]'::jsonb;
  -- The rider columns the desk reads: CUST_REF_COLS and _CUST_OPT_COLS in the app, and the
  -- stamp. Never password_hash, session_token or photo. Add a column here when the app adds one.
  cust_cols constant text[] := array['id','name','email','phone','height','type_preference','gender',
    'birth_date','country','city','nationality','socials','created_at','default_pay','hidden_types',
    'fix_fields','apple_email','ride_news_at','ride_news','deletion_requested_at','updated_at'];
begin
  if not is_staff() then
    raise exception 'STAFF_ONLY' using errcode = '42501';
  end if;

  if p_table = 'queue_entries' then
    select coalesce(jsonb_agg(to_jsonb(q) order by q.session_id, q.queue_num, q.id), '[]'::jsonb)
      into v_rows
      from queue_entries q
     where (p_since is null or q.updated_at > p_since)
       and (p_cut is null or q.session_date >= p_cut);
  elsif p_table = 'customers' then
    select coalesce(jsonb_agg(
             (select jsonb_object_agg(e.key, e.value) from jsonb_each(to_jsonb(c)) e where e.key = any(cust_cols))
             order by c.created_at, c.id), '[]'::jsonb)
      into v_rows
      from customers c
     where p_since is null or c.updated_at > p_since;
  elsif p_table = 'customer_tags' then
    select coalesce(jsonb_agg(to_jsonb(t) order by t.customer_id, t.tag_id), '[]'::jsonb)
      into v_rows
      from customer_tags t
     where p_since is null or t.updated_at > p_since;
  else
    raise exception 'staff_sync: unknown table %', p_table using errcode = '22023';
  end if;

  if p_since is not null then
    select coalesce(jsonb_agg(jsonb_build_object('id', d.row_id, 'at', d.deleted_at) order by d.deleted_at), '[]'::jsonb)
      into v_del
      from sync_deletions d
     where d.tbl = p_table and d.deleted_at > p_since;
  end if;

  return jsonb_build_object('now', now(), 'rows', v_rows, 'deleted', v_del);
end
$fn$;
revoke all on function public.staff_sync(text, timestamptz, text) from public, anon;
grant execute on function public.staff_sync(text, timestamptz, text) to authenticated;

commit;
