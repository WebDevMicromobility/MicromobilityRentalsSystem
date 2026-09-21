-- Rider changes reach every staff device the moment they happen.
--
-- The desk holds the whole customer list (~2,700 riders), their tags and the tag list. Until
-- now another device's change reached it only when the list was refetched, every five minutes,
-- on every staff device: over a megabyte each time, and a large share of the egress that took
-- the project over its free allowance.
--
-- customers is deliberately NOT added to the supabase_realtime publication. postgres_changes
-- delivers the whole row, and this one carries password_hash and a session_token that
-- customer_login rewrites on every sign-in. Instead a trigger broadcasts only the columns the
-- desk reads, on the private topic 'staff-ref', and the policy below lets staff, and only
-- staff, join it. customer_tags and tags ride the same topic: both are staff-only tables with
-- nothing secret in them.
--
-- An UPDATE that moves none of the broadcast columns (a sign-in, a password change, a new
-- photo) sends nothing. realtime.send swallows its own errors, so a broadcast that fails can
-- never fail the write that caused it.
--
-- Client: setupRefRealtime / _rtRefMerge in app.src.html. It tolerates this migration being
-- absent (the join is refused and the five-minute refetch stays), so deploy order is free.

create or replace function public._staff_ref_broadcast()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  -- CUST_REF_COLS in the client, plus fix_fields (the correction requests the desk flags).
  cust_cols constant text[] := array['id','name','email','phone','height','type_preference',
    'gender','birth_date','country','city','nationality','socials','created_at','default_pay',
    'hidden_types','fix_fields'];
  n jsonb;
  o jsonb;
begin
  if TG_OP <> 'DELETE' then n := to_jsonb(NEW); end if;
  if TG_OP <> 'INSERT' then o := to_jsonb(OLD); end if;

  if TG_TABLE_NAME = 'customers' then
    if n is not null then
      n := (select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) from jsonb_each(n) where key = any(cust_cols));
    end if;
    if o is not null then
      o := (select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) from jsonb_each(o) where key = any(cust_cols));
    end if;
  end if;

  if TG_OP = 'UPDATE' and n = o then
    return null;
  end if;

  perform realtime.send(
    jsonb_build_object(
      'op',  TG_OP,
      'id',  coalesce(n->>'id', o->>'id'),
      'row', n,
      -- a deleted rider needs only the id; a tag link needs both halves of its key
      'old', case when TG_TABLE_NAME = 'customers' then null else o end
    ),
    TG_TABLE_NAME,   -- the event: customers | customer_tags | tags
    'staff-ref',
    true             -- private: only a join that passes the policy below receives it
  );
  return null;
end;
$$;

revoke all on function public._staff_ref_broadcast() from public, anon, authenticated;

drop trigger if exists staff_ref_broadcast on public.customers;
create trigger staff_ref_broadcast
  after insert or update or delete on public.customers
  for each row execute function public._staff_ref_broadcast();

drop trigger if exists staff_ref_broadcast on public.customer_tags;
create trigger staff_ref_broadcast
  after insert or update or delete on public.customer_tags
  for each row execute function public._staff_ref_broadcast();

drop trigger if exists staff_ref_broadcast on public.tags;
create trigger staff_ref_broadcast
  after insert or update or delete on public.tags
  for each row execute function public._staff_ref_broadcast();

-- Who may join the private topic. realtime.messages had no policies before this, so every
-- private join was refused; this opens exactly one topic, to staff.
drop policy if exists "staff hear staff-ref" on realtime.messages;
create policy "staff hear staff-ref" on realtime.messages
  for select to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and (select realtime.topic()) = 'staff-ref'
    and (select public.is_staff())
  );
