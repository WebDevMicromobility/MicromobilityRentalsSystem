-- Riders may be five or older (was six), on every site that asks for a birth date.
-- community_apply is the only server check on age; it is rebuilt from its LIVE definition with
-- only the age line changed, so SECURITY DEFINER, the search_path and the grants stay exactly
-- as they are. Running it again changes nothing.

do $mig$
declare
  d   text := pg_get_functiondef('public.community_apply(jsonb)'::regprocedure);
  old text := $q$or v_bd > (v_today - interval '6 years')::date$q$;
  new text := $q$or v_bd > (v_today - interval '5 years')::date$q$;
begin
  if position(new in d) > 0 then return; end if;  -- already done
  if position(old in d) = 0 then raise exception 'community_apply no longer has the six-year check'; end if;
  execute replace(d, old, new);
end $mig$;
