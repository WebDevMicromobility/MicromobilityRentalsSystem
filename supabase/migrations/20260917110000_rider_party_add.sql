-- ============================================================================
-- Staff add companions to an existing Petromin registration.
--
--   rider_party_add(p_id, p_riders)   staff only (is_staff()). Inserts one row per companion
--                                     under the party of the row given: same badge, phone,
--                                     session, company and booking number, party_no continuing
--                                     from the highest in the party. Same field rules as
--                                     rider_register(); at most five riders in a party.
--
-- The table grants staff select, update and delete but deliberately no insert (the public
-- writes through rider_register() only), so the Edit button's "add rider" needs this door.
-- Existing companions are edited and removed through the ordinary grants.
--
-- APPLIED TO PRODUCTION 2026-09-17 via the Supabase MCP (version 'rider_party_add').
-- If the CLI lists this file as pending: supabase migration repair --status applied 20260917110000
-- Rollback: drop function if exists public.rider_party_add(bigint, jsonb);
-- Idempotent. After running: supabase/checks/security-attributes.sql must print nothing.
-- ============================================================================

create or replace function public.rider_party_add(p_id bigint, p_riders jsonb)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_row rider_registrations%rowtype;
  v_n int; v_next int; v_i int; v_c jsonb; v_name text; v_h int; v_type text; v_id bigint;
  v_ids bigint[] := '{}';
begin
  if not is_staff() then raise exception 'staff only' using errcode = '42501'; end if;
  select * into v_row from rider_registrations where id = p_id;
  if v_row.id is null or v_row.booking_no is null then return jsonb_build_object('ok', false, 'error', 'notfound'); end if;
  -- the employee's row anchors the party
  select * into v_row from rider_registrations where booking_no = v_row.booking_no and party_no = 1;
  if v_row.id is null then return jsonb_build_object('ok', false, 'error', 'notfound'); end if;
  if p_riders is null or jsonb_typeof(p_riders) <> 'array' then return jsonb_build_object('ok', false, 'error', 'riders'); end if;
  perform pg_advisory_xact_lock(hashtext('rider-party:' || v_row.booking_no));
  select count(*), coalesce(max(party_no), 1) into v_n, v_next from rider_registrations where booking_no = v_row.booking_no;
  if v_n + jsonb_array_length(p_riders) > 5 then return jsonb_build_object('ok', false, 'error', 'riders'); end if;
  for v_i in 0 .. jsonb_array_length(p_riders) - 1 loop
    v_c := p_riders -> v_i;
    v_name := regexp_replace(trim(coalesce(v_c->>'name','')), '\s+', ' ', 'g');
    v_h := nullif(regexp_replace(coalesce(v_c->>'height',''), '\D', '', 'g'), '')::int;
    v_type := coalesce(v_c->>'type','');
    if v_name = '' or length(v_name) > 120 then return jsonb_build_object('ok', false, 'error', 'rider_name', 'rider', v_next + 1); end if;
    if v_h is null or v_h < 100 or v_h > 250 then return jsonb_build_object('ok', false, 'error', 'rider_height', 'rider', v_next + 1); end if;
    if v_type not in ('Road','Hybrid','Mountain') then return jsonb_build_object('ok', false, 'error', 'rider_type', 'rider', v_next + 1); end if;
    v_next := v_next + 1;
    insert into rider_registrations (badge, name, phone, height, type_preference, matched_entry_id, matched_customer_id, match_kind, source, session_id, company, booking_no, party_no)
    values (v_row.badge, v_name, v_row.phone, v_h, v_type, null, null, 'none', v_row.source, v_row.session_id, v_row.company, v_row.booking_no, v_next)
    returning id into v_id;
    v_ids := v_ids || v_id;
  end loop;
  return jsonb_build_object('ok', true, 'ids', to_jsonb(v_ids), 'riders', v_next);
end $function$;
revoke all on function public.rider_party_add(bigint, jsonb) from public, anon;
grant execute on function public.rider_party_add(bigint, jsonb) to authenticated;
