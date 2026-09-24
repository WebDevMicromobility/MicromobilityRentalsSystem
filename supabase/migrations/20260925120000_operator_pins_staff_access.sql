-- ============================================================================
-- Operator PINs and per-person staff access (Claude Design #7, #8, #9), 2026-09-25.
--
-- #7  A 4-digit PIN per name on the team list (team_members). The hash is never readable
--     from the app: column grants leave only name and created_at visible, and the PIN is
--     checked here, 5 tries then a 60-second lock (login_throttle, key 'op:<name>').
--     Only an admin sets or clears a PIN.
-- #8  Each sign-in account (staff row) may be limited to some sections (modules_view) and
--     allowed to change only some of them (modules_edit). NULL means everything the role
--     allows. Only an admin changes a row, and never their own. The role itself (admin or
--     frontdesk) is what is_admin() reads, so the database keeps enforcing it.
-- #9  Read-only is the staff page's: a section an account can open but not change refuses
--     its writes there. Section rights are not enforced by RLS.
-- ============================================================================

-- #7 ─────────────────────────────────────────────────────────────────────────
alter table public.team_members add column if not exists pin_hash text;

-- The app reads and writes names only. A 4-digit PIN's bcrypt hash falls to a laptop in
-- seconds, so it must not be selectable at all.
revoke select, insert, update on public.team_members from anon, authenticated;
grant select (name, created_at) on public.team_members to anon, authenticated;
grant insert (name, created_at) on public.team_members to anon, authenticated;
grant update (name) on public.team_members to anon, authenticated;

-- Which names ask for a PIN at the operator gate.
create or replace function public.staff_operator_list()
returns table(name text, has_pin boolean)
language sql stable security definer set search_path to 'public'
as $$
  select tm.name, tm.pin_hash is not null from team_members tm where is_staff() order by tm.name
$$;

-- Set (4 digits) or clear (null) a name's PIN. Admins only.
create or replace function public.staff_set_operator_pin(p_name text, p_pin text)
returns boolean
language plpgsql security definer set search_path to 'public', 'extensions'
as $$
begin
  if not is_admin() then raise exception 'ADMIN_ONLY' using errcode = '42501'; end if;
  if p_pin is not null and p_pin !~ '^[0-9]{4}$' then raise exception 'PIN_FORMAT' using errcode = '22023'; end if;
  update team_members set pin_hash = case when p_pin is null then null else crypt(p_pin, gen_salt('bf', 8)) end
   where name = p_name;
  if not found then raise exception 'NO_SUCH_NAME' using errcode = 'P0002'; end if;
  delete from login_throttle where identifier = 'op:' || lower(p_name);
  return true;
end $$;

-- Check a name's PIN. {ok:true} | {ok:false, reason:'wrong', left:n} | {ok:false, reason:'locked',
-- seconds:n} | {ok:false, reason:'no_pin'}. Five wrong tries lock the name for 60 seconds.
create or replace function public.staff_check_operator_pin(p_name text, p_pin text)
returns jsonb
language plpgsql security definer set search_path to 'public', 'extensions'
as $$
declare
  h text;
  k text := 'op:' || lower(coalesce(p_name, ''));
  lt login_throttle%rowtype;
begin
  if not is_staff() then raise exception 'STAFF_ONLY' using errcode = '42501'; end if;
  select pin_hash into h from team_members where name = p_name;
  if h is null then return jsonb_build_object('ok', false, 'reason', 'no_pin'); end if;
  select * into lt from login_throttle where identifier = k for update;
  if found and lt.locked_until is not null and lt.locked_until > now() then
    return jsonb_build_object('ok', false, 'reason', 'locked', 'seconds', ceil(extract(epoch from lt.locked_until - now()))::int);
  end if;
  if coalesce(p_pin, '') ~ '^[0-9]{4}$' and crypt(p_pin, h) = h then
    delete from login_throttle where identifier = k;
    return jsonb_build_object('ok', true);
  end if;
  insert into login_throttle as l (identifier, fails, locked_until, updated_at) values (k, 1, null, now())
  on conflict (identifier) do update
    set fails = case when l.locked_until is not null and l.locked_until <= now() then 1 else l.fails + 1 end,
        locked_until = null, updated_at = now()
  returning * into lt;
  if lt.fails >= 5 then
    update login_throttle set fails = 0, locked_until = now() + interval '60 seconds' where identifier = k;
    return jsonb_build_object('ok', false, 'reason', 'locked', 'seconds', 60);
  end if;
  return jsonb_build_object('ok', false, 'reason', 'wrong', 'left', 5 - lt.fails);
end $$;

-- #8 ─────────────────────────────────────────────────────────────────────────
alter table public.staff add column if not exists modules_view text[];
alter table public.staff add column if not exists modules_edit text[];

-- Every sign-in account with its role and sections, for the admin's Team page.
create or replace function public.staff_team_list()
returns table(user_id uuid, email text, role text, modules_view text[], modules_edit text[], is_me boolean)
language plpgsql stable security definer set search_path to 'public', 'auth'
as $$
begin
  if not is_admin() then raise exception 'ADMIN_ONLY' using errcode = '42501'; end if;
  return query
    select s.user_id, u.email::text, s.role, s.modules_view, s.modules_edit, s.user_id = auth.uid()
      from staff s left join auth.users u on u.id = s.user_id
     order by s.role, u.email;
end $$;

-- An admin sets another account's role and sections. Null lists mean "everything the role
-- allows"; what an account may change is always inside what it may open.
create or replace function public.staff_set_access(p_user uuid, p_role text, p_view text[], p_edit text[])
returns boolean
language plpgsql security definer set search_path to 'public'
as $$
declare
  allowed text[] := array['queue','cashier','inventory','workshop','community','ambassadors','website','messages','analytics','history','team'];
begin
  if not is_admin() then raise exception 'ADMIN_ONLY' using errcode = '42501'; end if;
  if p_user = auth.uid() then raise exception 'NOT_YOURSELF' using errcode = '42501'; end if;
  if p_role is null or p_role not in ('admin', 'frontdesk') then raise exception 'ROLE' using errcode = '22023'; end if;
  if p_view is not null and not (p_view <@ allowed) then raise exception 'SECTION' using errcode = '22023'; end if;
  if p_edit is not null and not (p_edit <@ coalesce(p_view, allowed)) then raise exception 'EDIT_NOT_VIEW' using errcode = '22023'; end if;
  update staff set role = p_role, modules_view = p_view, modules_edit = p_edit where user_id = p_user;
  if not found then raise exception 'NO_SUCH_STAFF' using errcode = 'P0002'; end if;
  return true;
end $$;

-- Staff call these; nobody signed out does.
revoke execute on function public.staff_operator_list() from public, anon;
revoke execute on function public.staff_set_operator_pin(text, text) from public, anon;
revoke execute on function public.staff_check_operator_pin(text, text) from public, anon;
revoke execute on function public.staff_team_list() from public, anon;
revoke execute on function public.staff_set_access(uuid, text, text[], text[]) from public, anon;
grant execute on function public.staff_operator_list() to authenticated;
grant execute on function public.staff_set_operator_pin(text, text) to authenticated;
grant execute on function public.staff_check_operator_pin(text, text) to authenticated;
grant execute on function public.staff_team_list() to authenticated;
grant execute on function public.staff_set_access(uuid, text, text[], text[]) to authenticated;
