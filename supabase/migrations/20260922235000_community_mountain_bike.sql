-- The community application form offers Mountain beside Road and Hybrid.
-- community_apply is rebuilt from its LIVE definition with only the bike-type list changed, so
-- SECURITY DEFINER, the search_path and the grants stay exactly as they are.

alter table public.community_applications drop constraint if exists community_applications_bike_type_check;
alter table public.community_applications add constraint community_applications_bike_type_check
  check (bike_type in ('Road','Hybrid','Mountain'));

do $mig$
declare
  d   text := pg_get_functiondef('public.community_apply(jsonb)'::regprocedure);
  old text := $q$if v_type not in ('Road','Hybrid') then$q$;
  new text := $q$if v_type not in ('Road','Hybrid','Mountain') then$q$;
begin
  if position(new in d) > 0 then return; end if;  -- already done
  if position(old in d) = 0 then raise exception 'community_apply no longer has the Road/Hybrid check'; end if;
  execute replace(d, old, new);
end $mig$;
