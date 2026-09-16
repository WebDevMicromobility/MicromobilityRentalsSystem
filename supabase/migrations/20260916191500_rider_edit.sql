-- ============================================================================
-- A rider edits their own registration from the form.
--
--   rider_edit(p_booking_no, p_proof_phone, ...new details..., p_phone)
--     The device that registered holds the booking number and the phone it sent;
--     together they prove the row is the caller's. The row is updated in place,
--     booking number kept, through the same validation, matching and session
--     rules as rider_register(): the session move (and a badge change) is written
--     first and rider_register() then upserts onto that very row. Everything runs
--     in one sub-transaction, so a refused edit leaves the row exactly as it was.
--     Refused: unknown number or wrong phone ('notfound'), already checked in at
--     the desk ('checked_in'), the badge already registered on the target session
--     ('duplicate'), plus rider_register()'s own errors.
--
-- APPLIED TO PRODUCTION 2026-09-16 via the Supabase MCP (version 'rider_edit').
-- If the CLI lists this file as pending: supabase migration repair --status applied 20260916191500
-- Rollback: drop function if exists public.rider_edit(text,text,text,text,integer,text,text,text,text);
-- Idempotent. After running: supabase/checks/security-attributes.sql must print nothing.
-- ============================================================================

create or replace function public.rider_edit(p_booking_no text, p_proof_phone text, p_badge text, p_name text, p_height integer, p_type text, p_session_id text default null, p_company text default null, p_phone text default null)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_row rider_registrations%rowtype;
  v_proof text := right(regexp_replace(coalesce(p_proof_phone,''), '\D', '', 'g'), 9);
  v_newkey text := lower(regexp_replace(trim(coalesce(p_badge,'')), '[^a-zA-Z0-9]', '', 'g'));
  v_sess_id text;
  v_r jsonb;
begin
  if not _rider_gate() then return jsonb_build_object('ok', false, 'error', 'throttled'); end if;

  select * into v_row from rider_registrations where upper(booking_no) = upper(trim(coalesce(p_booking_no,'')));
  if v_row.id is null then return jsonb_build_object('ok', false, 'error', 'notfound'); end if;
  if v_row.phone is null or length(v_proof) < 9 or right(regexp_replace(v_row.phone, '\D', '', 'g'), 9) <> v_proof then
    return jsonb_build_object('ok', false, 'error', 'notfound');
  end if;
  if v_row.checked_in_at is not null then return jsonb_build_object('ok', false, 'error', 'checked_in'); end if;

  v_sess_id := coalesce(p_session_id, v_row.session_id);
  if v_newkey = '' then return jsonb_build_object('ok', false, 'error', 'badge'); end if;
  if exists (select 1 from rider_registrations r
              where r.badge_key = v_newkey and coalesce(r.session_id,'') = coalesce(v_sess_id,'') and r.id <> v_row.id) then
    return jsonb_build_object('ok', false, 'error', 'duplicate');
  end if;

  -- Sub-transaction: move the row under the new badge and session, then let rider_register()
  -- validate and upsert onto it (same badge_key + session_id, so booking_no is kept). A refusal
  -- is raised out of the block so the moves roll back with it.
  begin
    update rider_registrations
       set badge = trim(p_badge), session_id = v_sess_id
     where id = v_row.id;
    v_r := rider_register(p_badge, p_name, p_height, p_type, coalesce(v_row.source, 'petromin'), p_phone, v_sess_id, p_company);
    if not coalesce((v_r->>'ok')::boolean, false) then
      raise exception using errcode = 'MM001', message = v_r::text;
    end if;
  exception when sqlstate 'MM001' then
    return sqlerrm::jsonb;
  end;

  return v_r;
end $function$;
revoke all on function public.rider_edit(text,text,text,text,integer,text,text,text,text) from public;
grant execute on function public.rider_edit(text,text,text,text,integer,text,text,text,text) to anon, authenticated;
