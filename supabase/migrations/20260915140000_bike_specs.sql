-- ============================================================================
-- Bike specs on the form: wheel size and brakes (columns that existed but were kept off the
-- public column list), and a new weight. None of the three is sensitive, so they join the
-- columns the app reads with the fleet.
--
-- Rollback:
--   revoke select (wheel_size, brake_type, weight_kg) on public.bikes from anon, authenticated;
--   alter table public.bikes drop column if exists weight_kg;
-- Idempotent: safe to re-run.
-- ============================================================================
alter table public.bikes add column if not exists weight_kg numeric;
grant select (wheel_size, brake_type, weight_kg) on public.bikes to anon, authenticated;

-- the two lists the form offers, editable from the ✎ beside each field
insert into public.staff_options (key, items) values
  ('bike_wheels', '["20\"","24\"","26\"","27.5\"","29\"","700c"]'::jsonb),
  ('bike_brakes', '["Rim","Disc — mechanical","Disc — hydraulic"]'::jsonb)
on conflict (key) do nothing;

-- Verify (expect weight_kg present; anon can read the three columns):
--   select column_name from information_schema.columns where table_name='bikes' and column_name in ('wheel_size','brake_type','weight_kg');
