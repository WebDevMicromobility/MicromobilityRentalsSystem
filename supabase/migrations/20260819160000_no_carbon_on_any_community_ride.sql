-- ─────────────────────────────────────────────────────────────────────────────
-- Road Carbon is off EVERY community ride, not just the complimentary one.
--
-- 20260819120000 narrowed `_comm_no_carbon` to unpaid rides, on the reasoning that
-- a ride which charges list price may as well rent the whole fleet. That was a
-- guess about the business, and it was wrong: carbon bikes do not go out on a
-- community ride at all. The client hides the option on both rides again, and
-- this restores the database's half of that — the coercion is what caught a stale
-- cached client booking a carbon bike onto the social ride (booking #58,
-- 2026-08-12), and a paid ride needs the same backstop.
--
-- Silent coercion, not rejection, exactly as before: an old client that still
-- offers the option gets a Road bike rather than an error it cannot explain.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public._comm_no_carbon()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if new.type_preference = 'Road Carbon' and exists(
    select 1 from sessions s
     where s.id = new.session_id
       and s.event_kind = 'community') then
    new.type_preference := 'Road';
  end if;
  return new;
end$function$;
