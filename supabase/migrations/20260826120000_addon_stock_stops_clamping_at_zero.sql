-- ─────────────────────────────────────────────────────────────────────────────
-- Add-on stock: the customer path stops clamping at zero.
--
-- Stock is allowed to go negative on purpose. A booking can be taken for an
-- add-on that is already sold out (a backorder the booth owes the rider), and
-- the client has always allowed it — the comment on the staff path says so in
-- as many words: clamping while a refund adds the full quantity back is what
-- mints phantom stock.
--
--   qty 0 → oversell 2 → clamped to 0 → the two riders cancel → +2 → qty 2.
--   Two units that never existed are now on the shelf, and nothing says so
--   until stock-take.
--
-- The staff path never clamped. This makes the customer RPC agree with it, so
-- the two sides of the same invariant stop contradicting each other.
--
-- Everything else about the function is unchanged: the token check, the ±20
-- per-item bound, and the relative (atomic) update.
--
-- Rollback: re-apply with `greatest(coalesce(qty,0) + d, 0)`.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.customer_addon_stock(p_id text, p_token text, p_items jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare it jsonb; d int;
begin
  if not _cust_token_ok(p_id, p_token) then return false; end if;
  for it in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    d := coalesce((it->>'delta')::int, 0);
    if d < -20 or d > 20 then continue; end if;
    update inventory
       set qty = coalesce(qty,0) + d,   -- may go negative: a backorder owed to a booking
           updated_at = to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS"Z"')
     where id = it->>'id';
  end loop;
  return true;
end $function$;
