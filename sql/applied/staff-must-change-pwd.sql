-- Force new staff to set their own password on first sign-in.
-- Run once in the Supabase SQL editor. Safe to re-run.
--
-- The app fetches must_change_pwd on staff login; if true, it blocks the panel behind a
-- mandatory "set your password" modal until the staffer changes it (which calls
-- staff_mark_pwd_changed to clear the flag). Until this runs, the feature is dormant.

-- 1. Track whether a staffer still needs to set their own password.
--    New staff rows default to TRUE (must change); existing staff are set to FALSE so
--    people who already picked their password aren't forced to change it.
alter table staff add column if not exists must_change_pwd boolean not null default true;
update staff set must_change_pwd = false;

-- 2. Let a signed-in staffer clear ONLY their own flag (can't touch role or anyone else).
create or replace function staff_mark_pwd_changed()
returns void language sql security definer set search_path = public, extensions as $$
  update staff set must_change_pwd = false where user_id = auth.uid();
$$;
grant execute on function staff_mark_pwd_changed() to authenticated;

-- ✅ CHECKPOINT: new staff (inserted after this) will be prompted to set a password on
--    first login. To force an EXISTING staffer to reset on next login:
--      update staff set must_change_pwd = true
--       where user_id = (select id from auth.users where email = 'their@email.com');
