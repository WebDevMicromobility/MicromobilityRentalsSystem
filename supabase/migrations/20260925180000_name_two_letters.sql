-- Every word of a customer's name has at least two letters (user rule, 2026-09-25): "A Khan" or
-- "Sara M" is refused as 'name_short', beside the existing 'name_chars'. The app says the same
-- on every form that sets an account name (_namePartsOk); this is the rule behind it.
-- Judged only when a customer sets a name (a new row, or a changed name), so other updates to
-- an account whose stored name predates the rule still go through. Staff are exempt, as for
-- name_chars. A letter and its vowel sign count as two characters, as in the app.
create or replace function public._name_parts_ok(v text)
 returns boolean
 language sql
 immutable
 set search_path to 'public', 'pg_temp'
as $function$
  select not exists (
    select 1 from regexp_split_to_table(btrim(coalesce(v, '')), '\s+') w
     where w <> '' and char_length(w) < 2)
$function$;

-- Rebuilt from the live definition (2026-09-25); invoker, as before (is_staff() does its own
-- privileged read). The trigger customers_name_rule (BEFORE INSERT OR UPDATE OF name) is unchanged.
create or replace function public._customer_name_ok()
 returns trigger
 language plpgsql
 set search_path to 'public', 'pg_temp'
as $function$
begin
  if (tg_op = 'INSERT' or new.name is distinct from old.name)
     and new.name is not null and not is_staff() then
    if not _name_chars_ok(new.name) then
      raise exception 'name_chars' using errcode = '22023',
        hint = 'A name may contain letters and spaces only.';
    end if;
    if not _name_parts_ok(new.name) then
      raise exception 'name_short' using errcode = '22023',
        hint = 'Every part of a name needs at least two letters.';
    end if;
  end if;
  return new;
end $function$;
