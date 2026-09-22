-- ============================================================================
-- A customer's name holds letters and spaces only: no hyphen.
--
-- APPLIED AND VERIFIED 2026-09-22 (SQL editor, history row recorded): a hyphen is refused, spaces
-- and Arabic are not; the 18 stored names with a dash were turned to spaces the same day.
--
-- _name_chars_ok (20260922180500) allowed letters, marks, spaces and the hyphen. The hyphen
-- goes: "Al-Harbi" is written "Al Harbi". En and em dashes and the minus were already refused
-- by the general-punctuation range. The class's first range grows by one character,
-- '!-,' to '!-/', which takes in the hyphen ('-', 0x2D); '.' and '/' were already listed.
--
-- The app turns a typed or pasted dash into a space, so a rider rarely meets this refusal.
-- Names already stored are not re-judged: the trigger checks a name only when it changes, and
-- staff are exempt as before. Used by _customer_name_ok, customer_fix_save and community_apply,
-- which all follow. _customer_name_ok's hint is reworded; both functions are otherwise as
-- they were (IMMUTABLE sql, and an invoker trigger, as security-attributes.sql expects).
--
-- Every non-ASCII character in the pattern is written as a \u escape, so the script stays
-- plain ASCII: pasted through a chat window, an invisible U+2000 could turn into a space and
-- start the refused range at the space character, refusing every name.
--
-- Rollback: re-run both functions from 20260922180500_customer_flags_and_name_rule.sql.
-- ============================================================================

begin;

create or replace function public._name_chars_ok(v text)
 returns boolean
 language sql
 immutable
as $function$
  select v !~ '[0-9\u0660-\u0669\u06f0-\u06f9\u0966-\u096f\u09e6-\u09ef!-/:-@[-`{-~\u060c\u061b\u061f\u00ab\u00bb\u2000-\u2bff\ufe0f\U0001F000-\U0001FAFF]'
$function$;

create or replace function public._customer_name_ok()
 returns trigger
 language plpgsql
as $function$
begin
  if (tg_op = 'INSERT' or new.name is distinct from old.name)
     and new.name is not null and not is_staff() and not _name_chars_ok(new.name) then
    raise exception 'name_chars' using errcode = '22023',
      hint = 'A name may contain letters and spaces only.';
  end if;
  return new;
end $function$;

commit;
