-- ============================================================================
-- Job applications from micromobility.sa/about ("Join the team") land in the staff page's
-- Messages as a third kind of message, 'jobs'. The topic is the role the applicant picked (made
-- from its English title, e.g. "ride-captain"), or 'general' for any role. Everything else is
-- the same as the business and help messages (20260924170000): no anon access to the table, the
-- per-network meter, the checks, the double-tap guard, the M-0000 reference.
--
--  1. site_messages.kind allows 'jobs'.
--  2. site_message_send accepts kind 'jobs' - the one changed line; SECURITY DEFINER and the
--     search_path are restated as they were.
--
-- Rollback (only once no 'jobs' row is left):
--   alter table public.site_messages drop constraint if exists site_messages_kind_check;
--   alter table public.site_messages add constraint site_messages_kind_check check (kind in ('business','help'));
--   and site_message_send from 20260924170000.
-- Idempotent.
-- ============================================================================

begin;

alter table public.site_messages drop constraint if exists site_messages_kind_check;
alter table public.site_messages add constraint site_messages_kind_check check (kind in ('business','help','jobs'));

create or replace function public.site_message_send(p jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
as $function$
declare
  v_kind    text := coalesce(p->>'kind','');
  v_topic   text := nullif(trim(coalesce(p->>'topic','')), '');
  v_name    text := regexp_replace(trim(coalesce(p->>'name','')), '\s+', ' ', 'g');
  v_company text := nullif(regexp_replace(trim(coalesce(p->>'company','')), '\s+', ' ', 'g'), '');
  v_email   text := nullif(lower(trim(coalesce(p->>'email',''))), '');
  v_phone   text := nullif(trim(coalesce(p->>'phone','')), '');
  v_msg     text := trim(coalesce(p->>'message',''));
  v_lang    text := coalesce(nullif(p->>'lang',''), 'en');
  v_cust    text;
  v_prev    bigint;
  v_id      bigint;
begin
  if not _ip_gate('sitemsg', 5, interval '10 minutes') then
    return jsonb_build_object('ok', false, 'error', 'throttled');
  end if;
  if v_kind not in ('business','help','jobs') then return jsonb_build_object('ok', false, 'error', 'kind'); end if;
  if v_topic is not null and v_topic !~ '^[a-z0-9_-]{1,40}$' then v_topic := null; end if;
  if v_name = '' or length(v_name) > 120 or not _name_chars_ok(v_name) then return jsonb_build_object('ok', false, 'error', 'name'); end if;
  if v_company is not null and length(v_company) > 120 then return jsonb_build_object('ok', false, 'error', 'company'); end if;
  if v_email is not null and (length(v_email) > 254 or v_email !~ '^[a-z0-9._%+''-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$') then
    return jsonb_build_object('ok', false, 'error', 'email'); end if;
  if v_phone is not null and (v_phone !~ '^\+[1-9][0-9]{7,14}$' or (v_phone like '+966%' and v_phone !~ '^\+9665[0-9]{8}$')) then
    return jsonb_build_object('ok', false, 'error', 'phone'); end if;
  if v_email is null and v_phone is null then return jsonb_build_object('ok', false, 'error', 'contact'); end if;
  if v_msg = '' or length(v_msg) > 2000 then return jsonb_build_object('ok', false, 'error', 'message'); end if;
  if v_lang !~ '^[a-z]{2}$' then v_lang := 'en'; end if;
  if coalesce(p->>'customer_id','') <> '' and coalesce(p->>'token','') <> '' and _cust_token_ok(p->>'customer_id', p->>'token') then
    v_cust := p->>'customer_id';
  end if;

  -- A double tap (or a retry after a lost answer) gets the same reference back.
  perform pg_advisory_xact_lock(hashtext('sitemsg:' || coalesce(v_phone, '') || '|' || coalesce(v_email, '')));
  select id into v_prev from site_messages
   where phone is not distinct from v_phone and email is not distinct from v_email and kind = v_kind
     and md5(message) = md5(v_msg) and created_at > now() - interval '10 minutes'
   order by id desc limit 1;
  if v_prev is not null then
    return jsonb_build_object('ok', true, 'id', v_prev, 'ref', 'M-' || lpad(v_prev::text, 4, '0'), 'repeat', true);
  end if;

  insert into site_messages(kind, topic, name, company, email, phone, message, lang, customer_id, updated_by)
  values (v_kind, v_topic, v_name, v_company, v_email, v_phone, v_msg, v_lang, v_cust, 'website')
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id, 'ref', 'M-' || lpad(v_id::text, 4, '0'));
end $function$;
revoke all on function public.site_message_send(jsonb) from public;
grant execute on function public.site_message_send(jsonb) to anon, authenticated;

commit;
