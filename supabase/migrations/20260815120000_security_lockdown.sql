-- Security lockdown, 2026-08-15.
-- Closes findings from the full audit. Each block states the hole it closes and why the
-- chosen fix cannot break a live flow.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. CRITICAL — customer_reset let anyone take over an account with only an email.
-- The ownership guard was `phone NOT LIKE '%' || <given>`. An empty (or 1-digit) phone
-- collapses the pattern to '%', which matches everything, so the guard never fired.
-- Verified on prod: '0501234567' NOT LIKE '%'||'' => false (i.e. did not block).
-- Fix: demand a real phone (>=7 digits) and compare normalised digits both ways, which
-- is what the client already does (_phoneMatches: equality or either-side suffix).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.customer_reset(p_email text, p_phone text, p_new_pwd text)
returns table(id text, name text, email text, phone text, height integer, type_preference text,
              created_at text, birth_date text, country text, city text, photo text, session_token text)
language plpgsql security definer set search_path to 'public','extensions'
as $function$
declare r customers%rowtype; tok text; s_digits text; p_digits text;
begin
  select * into r from customers where lower(customers.email)=lower(p_email) limit 1;
  if not found then return; end if;
  if r.password_hash = 'oauth:google' then return; end if;

  s_digits := regexp_replace(coalesce(r.phone,''), '\D', '', 'g');
  p_digits := regexp_replace(coalesce(p_phone,''), '\D', '', 'g');
  -- a short or empty phone is never proof of ownership
  if length(p_digits) < 7 or length(s_digits) < 7 then return; end if;
  if not (s_digits = p_digits
          or s_digits like '%' || p_digits
          or p_digits like '%' || s_digits) then return; end if;

  if length(coalesce(p_new_pwd,'')) < 8 then return; end if;
  tok := encode(gen_random_bytes(24),'hex');
  update customers set password_hash=crypt(p_new_pwd, gen_salt('bf')), session_token=tok
   where customers.id=r.id;
  return query select r.id, r.name, r.email, r.phone, r.height, r.type_preference,
    r.created_at, r.birth_date, r.country, r.city, r.photo, tok;
end $function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. CRITICAL — queue_entries was world read/write via the public anon key.
-- Policies were `using(true)` for SELECT/UPDATE/DELETE, so the key shipped in the
-- client bundle could dump 1,993 rows of name/email/phone, rewrite any booking's
-- price/paid flag, or delete the table's contents.
--
-- Safe because: customers never read this table in secure mode — they read the no-PII
-- queue_public view plus their own rows through my_bookings(); their own edits go
-- through customer_booking_update(). Staff read it directly, so they need a policy of
-- their own (previously they were riding the world-open one).
-- INSERT stays open: the public booking form inserts directly and price/approval are
-- already enforced by triggers. Locking it needs a booking RPC — tracked separately.
-- ─────────────────────────────────────────────────────────────────────────────
drop policy if exists "staff read" on public.queue_entries;
create policy "staff read" on public.queue_entries for select using ((select is_staff()));

drop policy if exists "public read" on public.queue_entries;
drop policy if exists "public update by id" on public.queue_entries;
drop policy if exists "public delete by id" on public.queue_entries;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. HIGH — queue_public is a SECURITY DEFINER view over the table just locked, and
-- it is simple enough to be auto-updatable. Without this it becomes a write bypass
-- that silently undoes block 2. It stays SECURITY DEFINER on purpose: that is what
-- lets anon read the PII-free projection while the base table is closed.
-- ─────────────────────────────────────────────────────────────────────────────
revoke insert, update, delete on public.queue_public from anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. HIGH — team_members (the staff roster) was readable and writable by anyone.
-- ─────────────────────────────────────────────────────────────────────────────
drop policy if exists team_members_read   on public.team_members;
drop policy if exists team_members_insert on public.team_members;
drop policy if exists team_members_update on public.team_members;
drop policy if exists team_members_delete on public.team_members;
create policy team_members_read   on public.team_members for select using ((select is_staff()));
create policy team_members_insert on public.team_members for insert with check ((select is_staff()));
create policy team_members_update on public.team_members for update using ((select is_staff())) with check ((select is_staff()));
create policy team_members_delete on public.team_members for delete using ((select is_staff()));

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. MEDIUM — cashier_sales (full sales/revenue history) was world-readable.
-- Writes were already staff-only. Customers never read it.
-- ─────────────────────────────────────────────────────────────────────────────
drop policy if exists "public read" on public.cashier_sales;
drop policy if exists "staff read"  on public.cashier_sales;
create policy "staff read" on public.cashier_sales for select using ((select is_staff()));

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. MEDIUM — a customer could set their own booking price to anything, because
-- customer_booking_update copies p_patch->>'price' straight in and the price trigger
-- only fired BEFORE INSERT. Fire it on UPDATE too, but exempt staff so the price-edit
-- modal and check-in repricing keep working. The existing body already leaves paid /
-- bike-assigned rows alone, so only genuinely open bookings are re-derived.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public._enforce_booking_price()
returns trigger language plpgsql security definer set search_path to 'public'
as $function$
declare canonical numeric; _kind text;
begin
  -- staff set prices deliberately (edit-price modal, check-in repricing)
  if tg_op = 'UPDATE' and (select is_staff()) then return new; end if;

  select coalesce(s.event_kind,'') into _kind from sessions s where s.id = new.session_id;
  if _kind = 'community' then
    new.price := 0;
    return new;
  end if;

  if new.assigned_bike_id is null
     and coalesce(new.paid, false) = false
     and coalesce(new.status, 'waiting') in ('waiting', 'waitlist') then
    select price into canonical from ride_prices where type = new.type_preference;
    if canonical is not null then
      if new.promo_code is not null and new.promo_code <> ''
         and exists (select 1 from promo_codes
                     where lower(code) = lower(new.promo_code) and active = true) then
        new.price := least(greatest(coalesce(new.price, canonical), 0), canonical);
      else
        new.price := canonical;
      end if;
    else
      new.price := least(greatest(coalesce(new.price, 0), 0), 1000);
    end if;
  end if;

  new.price := least(greatest(coalesce(new.price, 0), 0), 1000);
  return new;
end $function$;

drop trigger if exists trg_enforce_booking_price_upd on public.queue_entries;
create trigger trg_enforce_booking_price_upd
  before update on public.queue_entries
  for each row execute function public._enforce_booking_price();

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. MEDIUM — customer_addon_stock applied any delta to any item, unbounded and with
-- no floor, so a signed-in rider could corrupt stock. Clamp the step and the result.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.customer_addon_stock(p_id text, p_token text, p_items jsonb)
returns boolean language plpgsql security definer set search_path to 'public','extensions'
as $function$
declare it jsonb; d int;
begin
  if not _cust_token_ok(p_id, p_token) then return false; end if;
  for it in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    d := coalesce((it->>'delta')::int, 0);
    if d < -20 or d > 20 then continue; end if;      -- a booking consumes a handful, not a warehouse
    update inventory
       set qty = greatest(coalesce(qty,0) + d, 0),   -- never below zero
           updated_at = to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS"Z"')
     where id = it->>'id';
  end loop;
  return true;
end $function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Internal trigger helpers were callable as RPCs by anon. Most error outside a
-- trigger, but _cust_token_ok / customer_token_ok are token oracles. None of these is
-- called by the client; the customer-facing RPCs keep their grants.
-- ─────────────────────────────────────────────────────────────────────────────
-- Trigger guards are deliberately NOT revoked: PostgreSQL checks EXECUTE on a trigger
-- function at CREATE TRIGGER time, but the behaviour is subtle enough that revoking it
-- risks breaking every booking insert for no real gain — called as an RPC they just error
-- outside trigger context. The token oracles below are the actual exposure.
revoke execute on function public._cust_token_ok(text,text)    from anon, authenticated;
revoke execute on function public.customer_token_ok(text,text) from anon, authenticated;
revoke execute on function public.staff_set_customer_password(text,text) from anon;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. Pin search_path on the remaining flagged functions (advisor: 0011). A mutable
-- search_path in a SECURITY DEFINER context is a privilege-escalation vector.
-- ─────────────────────────────────────────────────────────────────────────────
alter function public._capacity_guard()  set search_path = 'public';
alter function public._titlecase_keep()  set search_path = 'public';
alter function public._ctag_active()     set search_path = 'public';
alter function public._wl_num_assign()   set search_path = 'public';
alter function public._comm_no_carbon()  set search_path = 'public';
