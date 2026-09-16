-- ============================================================================
-- Rider registration gains a mobile number (the Claude Design form added the field).
-- Stored as E.164 (+9665XXXXXXXX), the same shape as customers.phone / queue_entries.phone.
-- Matching now tries the phone first (last 9 digits, so +966 5.., 05.., 5.. all agree)
-- and falls back to the name match. The 5-argument rider_register is replaced by the
-- 6-argument one so PostgREST has a single overload to resolve.
--
-- APPLIED TO PRODUCTION 2026-09-16 via the Supabase MCP (version 'rider_registrations_phone').
-- If the CLI lists this file as pending: supabase migration repair --status applied 20260916150000
-- Rollback: drop function public.rider_register(text,text,integer,text,text,text);
--           alter table public.rider_registrations drop column phone;
--           then re-run 20260916120000 to restore the 5-argument function.
-- ============================================================================

alter table public.rider_registrations add column if not exists phone text;
create index if not exists rider_registrations_phone on public.rider_registrations(phone);

drop function if exists public.rider_register(text,text,integer,text,text);

create or replace function public.rider_register(p_badge text, p_name text, p_height integer, p_type text, p_source text default null, p_phone text default null)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_badge text := trim(coalesce(p_badge,''));
  v_name  text := regexp_replace(trim(coalesce(p_name,'')), '\s+', ' ', 'g');
  v_type  text := coalesce(p_type,'');
  v_src   text := nullif(left(lower(regexp_replace(coalesce(p_source,''), '[^a-zA-Z0-9_-]', '', 'g')), 40), '');
  v_digits text := regexp_replace(coalesce(p_phone,''), '\D', '', 'g');
  v_phone text;
  v_last9 text;
  v_today text := to_char(now() at time zone 'Asia/Riyadh', 'YYYY-MM-DD');
  v_entry queue_entries%rowtype;
  v_cust_id text;
  v_kind text := 'none';
  v_id bigint;
  v_n int;
begin
  if not _rider_gate() then
    return jsonb_build_object('ok', false, 'error', 'throttled');
  end if;
  if v_badge = '' or length(v_badge) > 40 then return jsonb_build_object('ok', false, 'error', 'badge'); end if;
  if v_name = '' or length(v_name) > 120 or v_name !~ '\s' then return jsonb_build_object('ok', false, 'error', 'name'); end if;
  if p_height is null or p_height < 100 or p_height > 250 then return jsonb_build_object('ok', false, 'error', 'height'); end if;
  if v_type not in ('Road','Hybrid','Mountain') then return jsonb_build_object('ok', false, 'error', 'type'); end if;

  -- Phone: optional at the RPC level (the form requires it). Accept 05XXXXXXXX, 5XXXXXXXX,
  -- 9665XXXXXXXX, 009665XXXXXXXX; anything else that is non-empty is rejected.
  if v_digits <> '' then
    if v_digits ~ '^009665\d{8}$' then v_digits := substr(v_digits, 3); end if;
    if v_digits ~ '^05\d{8}$' then v_phone := '+966' || substr(v_digits, 2);
    elsif v_digits ~ '^5\d{8}$' then v_phone := '+966' || v_digits;
    elsif v_digits ~ '^9665\d{8}$' then v_phone := '+' || v_digits;
    else return jsonb_build_object('ok', false, 'error', 'phone');
    end if;
    v_last9 := right(v_phone, 9);
  end if;

  -- 1. Open booking by phone (strongest signal), then by name.
  if v_last9 is not null then
    select * into v_entry from queue_entries
     where right(regexp_replace(coalesce(phone,''), '\D', '', 'g'), 9) = v_last9
       and status in ('waiting','waitlist','active')
       and session_date >= v_today
     order by session_date, queue_num
     limit 1;
  end if;
  if v_entry.id is null then
    select * into v_entry from queue_entries
     where lower(regexp_replace(trim(name), '\s+', ' ', 'g')) = lower(v_name)
       and status in ('waiting','waitlist','active')
       and session_date >= v_today
     order by session_date, queue_num
     limit 1;
  end if;
  if v_entry.id is not null then
    v_kind := 'booking';
    v_cust_id := v_entry.customer_id;
  else
    -- 2. Known customer by phone, then by name.
    if v_last9 is not null then
      select id into v_cust_id from customers
       where right(regexp_replace(coalesce(phone,''), '\D', '', 'g'), 9) = v_last9
       order by created_at desc limit 1;
    end if;
    if v_cust_id is null then
      select id into v_cust_id from customers
       where lower(regexp_replace(trim(name), '\s+', ' ', 'g')) = lower(v_name)
       order by created_at desc limit 1;
    end if;
    if v_cust_id is not null then v_kind := 'customer'; end if;
  end if;

  insert into rider_registrations (badge, name, phone, height, type_preference, matched_entry_id, matched_customer_id, match_kind, source)
  values (v_badge, v_name, v_phone, p_height, v_type, v_entry.id, v_cust_id, v_kind, v_src)
  on conflict (badge_key) do update
    set name = excluded.name, phone = coalesce(excluded.phone, rider_registrations.phone),
        height = excluded.height, type_preference = excluded.type_preference,
        matched_entry_id = excluded.matched_entry_id, matched_customer_id = excluded.matched_customer_id,
        match_kind = excluded.match_kind, source = coalesce(excluded.source, rider_registrations.source),
        submissions = rider_registrations.submissions + 1, updated_at = now()
  returning id, submissions into v_id, v_n;

  return jsonb_build_object(
    'ok', true, 'id', v_id, 'match', v_kind, 'resubmitted', v_n > 1,
    'booking', case when v_kind = 'booking' then jsonb_build_object(
        'queue_num', v_entry.queue_num, 'session_date', v_entry.session_date,
        'size', v_entry.size, 'type', v_entry.type_preference) end);
end $function$;
revoke all on function public.rider_register(text,text,integer,text,text,text) from public;
grant execute on function public.rider_register(text,text,integer,text,text,text) to anon, authenticated;
