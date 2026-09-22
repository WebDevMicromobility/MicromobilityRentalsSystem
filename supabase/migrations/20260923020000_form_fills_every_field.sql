-- The Petromin form fills every field (asked for 2026-09-22).
--
-- The page has always asked for all of them; the server did not insist, so a registration could
-- still arrive without a phone or a company — four rows on 21 Sept did. A registration that does
-- not come from the desk (is_staff() is false: the public form, its edit flow included) must now
-- carry both. The desk keeps its leniency: a walk-up is taken down with whatever is known.
--
-- rider_register is rebuilt from its LIVE definition with only this check added, so SECURITY
-- DEFINER, the search_path and the grants stay as they are. It must match exactly once or the
-- migration stops; running it again changes nothing.

create or replace function pg_temp._once(src text, old text, new text) returns text language plpgsql as $f$
begin
  if position(new in src) > 0 and position(old in src) = 0 then return src; end if;  -- already done
  if (length(src) - length(replace(src, old, ''))) / length(old) <> 1 then
    raise exception 'expected exactly one match of: %', left(old, 90);
  end if;
  return replace(src, old, new);
end $f$;

do $mig$
declare d text;
begin
  d := pg_get_functiondef('public.rider_register(text,text,integer,text,text,text,text,text,jsonb)'::regprocedure);
  d := pg_temp._once(d,
$o$  if v_company is not null and v_company not in ('Petromin','Petrolube') then return jsonb_build_object('ok', false, 'error', 'company'); end if;$o$,
$n$  if v_company is not null and v_company not in ('Petromin','Petrolube') then return jsonb_build_object('ok', false, 'error', 'company'); end if;
  -- The form asks for every field, so a registration that is not the desk's carries every field:
  -- the rider's company and their phone. The desk still takes a walk-up with what is known.
  if not v_staff then
    if v_company is null then return jsonb_build_object('ok', false, 'error', 'company'); end if;
    if v_digits = '' then return jsonb_build_object('ok', false, 'error', 'phone'); end if;
  end if;$n$);
  execute d;
end $mig$;
