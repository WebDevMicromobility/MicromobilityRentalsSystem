-- ============================================================================
-- Shared option lists for the staff forms (bike brands with their models, groupsets,
-- frame types). They used to live in each device's localStorage, so every till had its
-- own list; now one row per list that every staff device reads and edits.
--
--   key            items (jsonb)
--   bike_brands    [{"name":"Trek","models":["Domane","Emonda"]}, ...]   models hang off brands
--   bike_groupsets ["Shimano 105", ...]
--   bike_frames    ["Steel","Aluminum","Carbon","Titanium", ...]        empty = the app's defaults
--
-- Seeded from the fleet as it stands (retired rows included, so nothing already typed is lost).
-- Rollback: drop table if exists public.staff_options;
-- Idempotent: safe to re-run (the seed only fills a missing row).
-- ============================================================================
create table if not exists public.staff_options (
  key        text primary key,
  items      jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.staff_options enable row level security;
drop policy if exists "staff full" on public.staff_options;
create policy "staff full" on public.staff_options for all using ((select is_staff())) with check ((select is_staff()));
grant select, insert, update, delete on public.staff_options to authenticated;

-- brands, each with the models the fleet has carried under it
insert into public.staff_options (key, items)
select 'bike_brands', coalesce(jsonb_agg(jsonb_build_object('name', b.brand, 'models', b.models) order by b.brand), '[]'::jsonb)
from (
  select trim(brand) as brand,
         coalesce(jsonb_agg(distinct trim(model)) filter (where coalesce(trim(model),'') <> ''), '[]'::jsonb) as models
  from public.bikes where coalesce(trim(brand),'') <> '' group by trim(brand)
) b
on conflict (key) do nothing;

insert into public.staff_options (key, items)
select 'bike_groupsets', coalesce(jsonb_agg(distinct trim(groupset) order by trim(groupset)), '[]'::jsonb)
from public.bikes where coalesce(trim(groupset),'') <> ''
on conflict (key) do nothing;

insert into public.staff_options (key, items) values ('bike_frames', '[]'::jsonb)
on conflict (key) do nothing;

-- Verify (expect 3 rows):
--   select key, jsonb_array_length(items) as n from public.staff_options order by key;
