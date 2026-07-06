-- Section 6: lock writes on bikes/sessions/promo_codes/inventory to staff,
-- cashier_sales to staff-only, staff_actions/error_log reads to staff. Adds the
-- customer_addon_stock RPC. Run AFTER Sections 1-4. Safe to re-run.

-- SECTION 6 — Lock writes on the reference / ops tables to staff
-- (run after Sections 1-4). The booking screen still READS bikes/sessions/
-- inventory/promo_codes, so reads stay public; only staff may write. cashier_sales
-- carries walk-up customer names, so it becomes staff-only for read AND write.
-- ============================================================================

-- bikes, sessions, promo_codes, inventory: public read, staff-only write.
do $$ declare t text; begin
  foreach t in array array['bikes','sessions','promo_codes','inventory'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "public access" on %I', t);
    execute format('drop policy if exists "public read"   on %I', t);
    execute format('drop policy if exists "staff write"   on %I', t);
    execute format('create policy "public read" on %I for select using (true)', t);
    execute format('create policy "staff write" on %I for all using (is_staff()) with check (is_staff())', t);
  end loop;
end $$;

-- Customers still adjust add-on stock when they book / cancel add-ons; that write
-- now goes through a token-checked RPC instead of a direct inventory update.
create or replace function customer_addon_stock(p_id text, p_token text, p_items jsonb)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
declare it jsonb;
begin
  if not _cust_token_ok(p_id, p_token) then return false; end if;
  for it in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    update inventory set qty = coalesce(qty,0) + coalesce((it->>'delta')::int, 0),
                         updated_at = to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS"Z"')
     where id = it->>'id';
  end loop;
  return true;
end $$;
grant execute on function customer_addon_stock(text,text,jsonb) to anon, authenticated;

-- cashier_sales: walk-up customer names -> staff only, read and write.
alter table cashier_sales enable row level security;
drop policy if exists "public access" on cashier_sales;
drop policy if exists "staff all"     on cashier_sales;
create policy "staff all" on cashier_sales for all using (is_staff()) with check (is_staff());

-- staff_actions audit trail: any device may append (incl. offline sync); staff read.
alter table staff_actions enable row level security;
drop policy if exists "audit insert" on staff_actions;
drop policy if exists "audit read"   on staff_actions;
create policy "audit insert" on staff_actions for insert with check (true);
create policy "audit read"   on staff_actions for select using (is_staff());

-- error_log: any browser (incl. customers) may append a JS error; only staff read.
alter table error_log enable row level security;
drop policy if exists "error insert" on error_log;
drop policy if exists "error read"   on error_log;
create policy "error insert" on error_log for insert with check (true);
create policy "error read"   on error_log for select using (is_staff());
-- ============================================================================


