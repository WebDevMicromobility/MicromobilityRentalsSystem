-- Customer self-write RPCs (run once on the staging project ariyvnxeywozmwxmylhb).
-- Lets a signed-in customer cancel/modify/rate their OWN booking after Section 4
-- locked queue_entries. Safe to re-run (create or replace).

create or replace function customer_booking_update(p_id text, p_token text, p_entry_id text, p_patch jsonb)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
begin
  if not _cust_token_ok(p_id, p_token) then return false; end if;
  if not exists(select 1 from queue_entries where id = p_entry_id and customer_id = p_id) then return false; end if;
  if (p_patch ? 'status') and (p_patch->>'status') not in ('cancelled','waiting','waitlist') then return false; end if;
  update queue_entries q set
    type_preference  = coalesce(p_patch->>'type_preference', q.type_preference),
    price            = coalesce((p_patch->>'price')::numeric, q.price),
    size             = coalesce(p_patch->>'size', q.size),
    height           = coalesce((p_patch->>'height')::int, q.height),
    status           = coalesce(p_patch->>'status', q.status),
    queue_num        = coalesce((p_patch->>'queue_num')::int, q.queue_num),
    promo_code       = coalesce(p_patch->>'promo_code', q.promo_code),
    rating_bike      = case when p_patch ? 'rating_bike' then nullif(p_patch->>'rating_bike','')::int else q.rating_bike end,
    rating_exp       = case when p_patch ? 'rating_exp'  then nullif(p_patch->>'rating_exp','')::int  else q.rating_exp end,
    feedback         = case when p_patch ? 'feedback'    then p_patch->>'feedback'                    else q.feedback end,
    addons           = case when p_patch ? 'addons'      then p_patch->>'addons'                      else q.addons end,
    assigned_bike_id = case when p_patch ? 'assigned_bike_id' then null                              else q.assigned_bike_id end
  where q.id = p_entry_id;
  return true;
end $$;

create or replace function customer_shiftdown(p_id text, p_token text, p_session_id text, p_from_num int)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
begin
  if not _cust_token_ok(p_id, p_token) then return false; end if;
  update queue_entries set queue_num = queue_num - 1
   where session_id = p_session_id and status = 'waiting' and queue_num > p_from_num;
  return true;
end $$;

grant execute on function customer_booking_update(text,text,text,jsonb) to anon, authenticated;
grant execute on function customer_shiftdown(text,text,text,int)        to anon, authenticated;
