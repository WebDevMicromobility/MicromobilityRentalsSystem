-- Names may hold periods (user rule, 2026-09-25): "Md. Rahman", "Mohd. Ali", "Sara Khan Jr.".
-- A period comes right after a letter: one that starts a name or a word, or follows another
-- period, is still refused. Every other sign stays refused as before, dashes included, so each
-- form that checks a name (sign-up, My Account, the correction pop-up, the Petromin and community
-- forms, the website's forms) takes the same rule through _name_chars_ok.
-- The pattern keeps its \u escapes so this file stays pure ASCII: a pasted U+2000 turning into a
-- space would start the refused range at ' ' and refuse every name. \u0021-\u002d plus \u002f
-- is the old '!-/' range without the period (U+002E) that sat between them.
create or replace function public._name_chars_ok(v text)
 returns boolean
 language sql
 immutable
 set search_path to 'public', 'pg_temp'
as $function$
  select v !~ '[0-9\u0660-\u0669\u06f0-\u06f9\u0966-\u096f\u09e6-\u09ef\u0021-\u002d\u002f:-@[-`{-~\u060c\u061b\u061f\u00ab\u00bb\u2000-\u2bff\ufe0f\U0001F000-\U0001FAFF]'
     and v !~ '(^|[\s.])\.'
$function$;

-- A period ends a word as a space does, so "A. Rahman" and "J.R. Smith" are still initials
-- ('name_short'), while "Md. Rahman" has two letters and passes.
create or replace function public._name_parts_ok(v text)
 returns boolean
 language sql
 immutable
 set search_path to 'public', 'pg_temp'
as $function$
  select not exists (
    select 1 from regexp_split_to_table(btrim(coalesce(v, '')), '[\s.]+') w
     where w <> '' and char_length(w) < 2)
$function$;

-- Rebuilt from the live definition (2026-09-25) with the hint naming periods; invoker, as before
-- (is_staff() does its own privileged read). The trigger customers_name_rule is unchanged.
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
        hint = 'A name may contain letters, spaces and periods only.';
    end if;
    if not _name_parts_ok(new.name) then
      raise exception 'name_short' using errcode = '22023',
        hint = 'Every part of a name needs at least two letters.';
    end if;
  end if;
  return new;
end $function$;
