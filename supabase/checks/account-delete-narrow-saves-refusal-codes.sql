-- ─────────────────────────────────────────────────────────────────────────────
-- Proof that 20260922150000_account_delete_narrow_saves_refusal_codes.sql is live.
-- Read-only: catalogue lookups only. Prints one row per check; every `ok` must be true.
-- Also run supabase/checks/security-attributes.sql afterwards (it expects the new functions).
-- The body md5s are those of the migration's own text: a later migration that rebuilds one of
-- these triggers will turn its row false, which is the moment to update this file.
-- ─────────────────────────────────────────────────────────────────────────────
with fn as (
  select p.proname, pg_get_function_identity_arguments(p.oid) as args, p.prosrc as src, p.prosecdef as definer,
         p.proconfig as config, p.oid
    from pg_proc p where p.pronamespace = 'public'::regnamespace
),
checks(name, ok) as (
  select 'staff_delete_customer(text): definer, search_path set',
         exists (select 1 from fn where proname = 'staff_delete_customer' and args = 'p_id text' and definer and config is not null)
  union all
  select 'staff_delete_customer: authenticated may execute, anon may not',
         coalesce(has_function_privilege('authenticated', to_regprocedure('public.staff_delete_customer(text)'), 'EXECUTE'), false)
         and coalesce(not has_function_privilege('anon', to_regprocedure('public.staff_delete_customer(text)'), 'EXECUTE'), false)
  union all
  select 'staff_delete_customer: admin check, live-booking refusal, unlinks before the delete',
         exists (select 1 from fn where proname = 'staff_delete_customer'
                  and src like '%is_admin()%' and src like '%LIVE_BOOKINGS%'
                  and position('update cashier_sales' in src) > 0
                  and position('update queue_entries' in src) < position('delete from customers' in src))
  union all
  select 'customer_set_height(text,text,integer): definer, token-checked, 100-250',
         exists (select 1 from fn where proname = 'customer_set_height' and args = 'p_id text, p_token text, p_height integer'
                  and definer and config is not null and src like '%_cust_token_ok(p_id, p_token)%' and src like '%between 100 and 250%')
  union all
  select 'customer_set_birth_nat(text,text,text,text): definer, token-checked, _ymd_ok, 80 chars',
         exists (select 1 from fn where proname = 'customer_set_birth_nat' and args = 'p_id text, p_token text, p_birth_date text, p_nationality text'
                  and definer and config is not null and src like '%_cust_token_ok(p_id, p_token)%' and src like '%_ymd_ok(p_birth_date)%'
                  and src like '%left(p_nationality, 80)%')
  union all
  select 'customer_set_height / customer_set_birth_nat: anon and authenticated may execute',
         coalesce(has_function_privilege('anon', to_regprocedure('public.customer_set_height(text,text,integer)'), 'EXECUTE'), false)
         and coalesce(has_function_privilege('authenticated', to_regprocedure('public.customer_set_height(text,text,integer)'), 'EXECUTE'), false)
         and coalesce(has_function_privilege('anon', to_regprocedure('public.customer_set_birth_nat(text,text,text,text)'), 'EXECUTE'), false)
         and coalesce(has_function_privilege('authenticated', to_regprocedure('public.customer_set_birth_nat(text,text,text,text)'), 'EXECUTE'), false)
  union all
  select 'members gate: DETAIL MEMBERS_ONLY, English sentence kept, body as migrated',
         exists (select 1 from fn where proname = '_community_booking_gate' and definer
                  and src like '%''This ride is for community members only.'' using detail = ''MEMBERS_ONLY''%'
                  and md5(src) = 'b81dd581ecaa1a55d01dfb809902682f')
  union all
  select 'solo cap: DETAIL ONE_PER_SESSION, English sentence kept, body as migrated',
         exists (select 1 from fn where proname = '_solo_ride_cap' and definer
                  and src like '%''One place per person on this session.'' using detail = ''ONE_PER_SESSION''%'
                  and md5(src) = 'd6dbc1dc6b6e1cd396c1d80b1b28cb72')
  union all
  select 'group cap: DETAIL GROUP_CAP, English sentence kept, body as migrated',
         exists (select 1 from fn where proname = '_group_ride_cap' and definer
                  and src like '%''Up to 2 riders per booking on this ride.'' using detail = ''GROUP_CAP''%'
                  and md5(src) = '6cfbe9c9a2a8aa75445cffa87bc0bbe0')
  union all
  select 'the three triggers keep their search_path',
         (select count(*) = 3 from fn where
            (proname = '_community_booking_gate' and config = array['search_path=public, extensions'])
         or (proname = '_solo_ride_cap' and config = array['search_path=public'])
         or (proname = '_group_ride_cap' and config = array['search_path=public']))
  union all
  select 'the three triggers stay closed to anon and authenticated',
         not exists (select 1 from fn where proname in ('_community_booking_gate','_solo_ride_cap','_group_ride_cap')
                      and (has_function_privilege('anon', fn.oid, 'EXECUTE') or has_function_privilege('authenticated', fn.oid, 'EXECUTE')))
  union all
  select 'history row recorded',
         exists (select 1 from supabase_migrations.schema_migrations where version = '20260922150000')
)
select name, ok from checks order by ok, name;
