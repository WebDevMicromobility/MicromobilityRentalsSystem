-- Community applications: Instagram and LinkedIn may be left empty.
-- The form no longer asks for them (it still shows both fields exactly as before); a blank one is
-- stored as '' on the application, and approval copies only the handles that were given, so an
-- account never gets an empty socials entry (customers_socials_ok would refuse it).
--
-- Each function is rebuilt from its own live definition (pg_get_functiondef keeps SECURITY DEFINER,
-- search_path and grants) with only the named lines swapped. A swap that finds nothing raises, so a
-- database whose function has drifted fails loudly instead of half-applying.
do $mig$
declare
  d text; n text;
  procedure_swaps constant text[][] := array[
    -- community_apply: check a handle only when one was given
    ['public.community_apply(jsonb)',
     $a$  if v_ig !~ '^[A-Za-z0-9._]{1,30}$' then$a$,
     $b$  if v_ig <> '' and v_ig !~ '^[A-Za-z0-9._]{1,30}$' then$b$],
    ['public.community_apply(jsonb)',
     $a$  if v_li !~ '^[A-Za-z0-9._%-]{3,100}$' then$a$,
     $b$  if v_li <> '' and v_li !~ '^[A-Za-z0-9._%-]{3,100}$' then$b$],
    -- staff_community_approve: an existing account gains only the handles that were given
    ['public.staff_community_approve(uuid,text)',
     $a$if not (v_socials ? 'instagram') then$a$,
     $b$if a.instagram <> '' and not (v_socials ? 'instagram') then$b$],
    ['public.staff_community_approve(uuid,text)',
     $a$if not (v_socials ? 'linkedin')  then$a$,
     $b$if a.linkedin <> '' and not (v_socials ? 'linkedin')  then$b$],
    -- ...and a new account gets no socials at all when both were left empty
    ['public.staff_community_approve(uuid,text)',
     $a$jsonb_build_object('instagram', a.instagram, 'linkedin', a.linkedin), a.profession,$a$,
     $b$nullif(jsonb_strip_nulls(jsonb_build_object('instagram', nullif(a.instagram, ''), 'linkedin', nullif(a.linkedin, ''))), '{}'::jsonb), a.profession,$b$]
  ];
  fns constant text[] := array['public.community_apply(jsonb)', 'public.staff_community_approve(uuid,text)'];
  f text; i int;
begin
  foreach f in array fns loop
    d := pg_get_functiondef(f::regprocedure);
    for i in 1 .. array_length(procedure_swaps, 1) loop
      continue when procedure_swaps[i][1] <> f;
      n := replace(d, procedure_swaps[i][2], procedure_swaps[i][3]);
      if n = d then raise exception 'community_socials_optional: % no longer contains: %', f, procedure_swaps[i][2]; end if;
      d := n;
    end loop;
    execute d;
  end loop;
  if not (select prosecdef from pg_proc where oid = 'public.community_apply(jsonb)'::regprocedure)
     or not (select prosecdef from pg_proc where oid = 'public.staff_community_approve(uuid,text)'::regprocedure) then
    raise exception 'community_socials_optional: SECURITY DEFINER was lost';
  end if;
end $mig$;
