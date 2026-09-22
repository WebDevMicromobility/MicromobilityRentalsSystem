-- ─────────────────────────────────────────────────────────────────────────────
-- Proof that the five 2026-09-22 review migrations are live (20260922120100 … 124000).
-- Read-only: catalogue lookups and one count. Prints one row per check (44); every `ok` must be
-- true. Run after applying, and again after any later migration that touches these objects.
-- Also run supabase/checks/security-attributes.sql (it expects the new helpers too).
-- ─────────────────────────────────────────────────────────────────────────────
with fn as (
  select p.proname, pg_get_function_identity_arguments(p.oid) as args, p.prosrc as src, p.prosecdef as definer, p.oid
    from pg_proc p where p.pronamespace = 'public'::regnamespace
),
body(name, fname, must, must_not) as (values
  ('signup refuses malformed input',          'customer_signup',         'BAD_INPUT',                       null),
  ('oauth signup refuses malformed input',    'customer_oauth_signup',   'BAD_INPUT',                       null),
  ('meters key on cf-connecting-ip',          '_client_ip',              'cf-connecting-ip',                null),
  ('oracle meter uses _ip_gate',              '_oracle_gate',            '_ip_gate(''oracle''',             'x-forwarded-for'),
  ('rider meter uses _ip_gate',               '_rider_gate',             '_ip_gate(''rider''',              'x-forwarded-for'),
  ('login meters the account',                'customer_login',          '''acct:''',                       null),
  ('login matches phones by digits only',     'customer_login',          'length(digits) >= 6',             null),
  ('reset has its throttle back',             'customer_reset',          '''reset:''',                      null),
  ('reset spends the network budget',         'customer_reset',          '_oracle_gate()',                  null),
  ('photo shape checked',                     'customer_set_photo',      'data:image/',                     null),
  ('social handles checked',                  'customer_set_socials',    'rule',                            null),
  ('push rows move only with their keys',     'customer_push_subscribe', 'push_subscriptions.auth = excluded.auth', null),
  ('price trigger computes the discount',     '_enforce_booking_price',  'mm.promo_base',                   'coalesce(new.price, canonical)'),
  ('use count follows the code',              '_promo_count',            '_o is not distinct from _n',      null),
  ('booking RPC checks the tag gate',         'customer_create_booking', 'required_tag_id',                 null),
  ('booking RPC ignores the client price',    'customer_create_booking', '_enforce_booking_price decides', 'nullif(it->>''price'''),
  ('update RPC ignores price and queue_num',  'customer_booking_update', '_session_has_room',               'p_patch->>''price'''),
  ('update RPC keeps the cancel reason',      'customer_booking_update', 'cancel_reason',                   null),
  ('promotion checks for a free place',       '_promote_next_waitlist',  '_held >= coalesce(_s.capacity',   null),
  ('fill rule recounts the night left',       '_session_fill_status',    '_session_fill_recount(old.session_id)', null),
  ('approval guard reads the request role',   '_approval_guard',         'auth.role()',                     'current_user not in'),
  ('add-on stock follows the bookings',       'customer_addon_stock',    'addons_held',                     null),
  ('rider form needs the phone to overwrite', 'rider_register',          'mm.rider_proved',                 null),
  ('rider form hides booking details',        'rider_register',          'when v_staff then',               null),
  ('rider edit vouches for its own proof',    'rider_edit',              'mm.rider_proved',                 null),
  ('session window crosses midnight',         '_session_window',         'interval ''1 day''',              null),
  ('damaged return dated in KSA',             'staff_return',            'Asia/Riyadh',                     'current_date'),
  ('list_sessions keeps a booked night',      'list_sessions',           'q.customer_id = p_id',            null)
),
checks(name, ok) as (
  select 'constraints present and validated (19)',
         (select count(*) = 19 from pg_constraint c
           where c.convalidated and c.conname in (
             'customers_id_shape','customers_type_known','customers_gender_known','customers_phone_shape',
             'customers_photo_shape','customers_birth_date_shape','customers_socials_shape',
             'queue_entries_id_shape','queue_entries_group_id_shape','queue_entries_customer_id_shape',
             'queue_entries_session_day_known','queue_entries_type_known','queue_entries_size_known',
             'queue_entries_session_date_shape','queue_entries_registered_at_shape',
             'queue_entries_waiver_version_shape','queue_entries_addons_shape',
             'rider_registrations_badge_shape','rider_registrations_phone_shape'))
  union all
  select 'body: ' || b.name,
         coalesce(bool_and(f.src like '%' || b.must || '%' and (b.must_not is null or f.src not like '%' || b.must_not || '%')), false)
    from body b left join fn f on f.proname = b.fname
   group by b.name
  union all
  select 'profile refuses a taken phone (both overloads)',
         exists (select 1 from fn where proname = 'customer_update_profile' and args like '%p_nationality%' and src like '%phone_taken%')
         and exists (select 1 from fn where proname = 'customer_update_profile' and args not like '%p_nationality%' and src like '%customer_update_profile(p_id%')
  union all
  select 'trigger: promo count fires on status and promo_code',
         exists (select 1 from pg_trigger t where t.tgrelid = 'public.queue_entries'::regclass and t.tgname = 'trg_promo_count_upd'
                  and pg_get_triggerdef(t.oid) like '%UPDATE OF status, promo_code%')
  union all
  select 'trigger: waitlist number re-issued on a move',
         exists (select 1 from pg_trigger t where t.tgrelid = 'public.queue_entries'::regclass and t.tgname = 'wl_num_assign_upd'
                  and pg_get_triggerdef(t.oid) like '%waitlist_num IS NULL%')
  union all
  select 'trigger: staff writes keep addons_held in step',
         exists (select 1 from pg_trigger t where t.tgrelid = 'public.queue_entries'::regclass and t.tgname = 'queue_entries_addons_held')
  union all
  select 'column: queue_entries.addons_held',
         exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'queue_entries' and column_name = 'addons_held')
  union all
  select 'column: login_throttle.updated_at',
         exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'login_throttle' and column_name = 'updated_at')
  union all
  select 'addons_held backfilled on live bookings',
         -- to_jsonb, so this check also runs (and says false) before the column exists
         (select count(*) = 0 from public.queue_entries q
           where coalesce(q.addons, '') not in ('', '[]') and q.status in ('waiting', 'active', 'done')
             and coalesce(to_jsonb(q)->'addons_held', '{}'::jsonb) = '{}'::jsonb)
  union all
  select 'promo_codes: no public read, staff read present',
         not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'promo_codes' and policyname = 'public read')
         and exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'promo_codes' and policyname = 'staff read' and cmd = 'SELECT')
  union all
  select 'inventory.cost hidden from anon and authenticated, other columns readable',
         not has_column_privilege('anon', 'public.inventory', 'cost', 'SELECT')
         and not has_column_privilege('authenticated', 'public.inventory', 'cost', 'SELECT')
         and has_column_privilege('anon', 'public.inventory', 'qty', 'SELECT')
         and has_column_privilege('authenticated', 'public.inventory', 'name', 'SELECT')
  union all
  select 'photos bucket: 1 MB, images only',
         exists (select 1 from storage.buckets where id = 'photos' and file_size_limit = 1048576
                  and allowed_mime_types @> array['image/jpeg','image/png','image/webp'] and cardinality(allowed_mime_types) = 3)
  union all
  select 'photos upload: anon + authenticated, p/<id>.<ext> only',
         exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'photos upload'
                  and cmd = 'INSERT' and roles @> array['anon','authenticated']::name[] and with_check like '%p/%')
  union all
  select 'EXECUTE: RPCs callable as intended',
         coalesce(has_function_privilege('anon', to_regprocedure('public.promo_lookup(text,text,text)'), 'EXECUTE'), false)
         and coalesce(not has_function_privilege('anon', to_regprocedure('public.staff_inventory_costs()'), 'EXECUTE'), false)
         and coalesce(has_function_privilege('authenticated', to_regprocedure('public.staff_inventory_costs()'), 'EXECUTE'), false)
         and coalesce(has_function_privilege('authenticated', to_regprocedure('public.staff_mark_pwd_changed()'), 'EXECUTE'), false)
         and coalesce(not has_function_privilege('anon', to_regprocedure('public.staff_mark_pwd_changed()'), 'EXECUTE'), false)
  union all
  select 'EXECUTE: internal helpers closed',
         coalesce(not has_function_privilege('anon', to_regprocedure('public._ip_gate(text,integer,interval)'), 'EXECUTE'), false)
         and coalesce(not has_function_privilege('anon', to_regprocedure('public._client_ip()'), 'EXECUTE'), false)
         and coalesce(not has_function_privilege('anon', to_regprocedure('public._fare_now(text,text,text)'), 'EXECUTE'), false)
         and coalesce(not has_function_privilege('anon', to_regprocedure('public._session_has_room(text,text,text)'), 'EXECUTE'), false)
         and coalesce(not has_function_privilege('anon', to_regprocedure('public._session_fill_recount(text)'), 'EXECUTE'), false)
         and coalesce(not has_function_privilege('anon', to_regprocedure('public._addons_held_sync()'), 'EXECUTE'), false)
  union all
  select 'EXECUTE: trigger functions closed to anon and authenticated',
         not exists (select 1 from fn
                      where fn.proname in ('_approval_guard','_capacity_guard','_comm_no_carbon','_community_booking_gate',
                              '_customer_name_ok','_enforce_booking_price','_grant_auto_tags','_group_ride_cap','_promo_count',
                              '_rider_link_reprice','_rider_registration_guard','_session_fill_status','_session_status_by_hand',
                              '_solo_ride_cap','_wl_num_assign','assign_queue_num','queue_num_update_guard')
                        and (has_function_privilege('anon', fn.oid, 'EXECUTE') or has_function_privilege('authenticated', fn.oid, 'EXECUTE')))
  union all
  select 'SECURITY DEFINER where it must be',
         (select count(distinct proname) = 26 and bool_and(definer) from fn where proname in ('promo_lookup','_ip_gate','staff_inventory_costs','_addons_held_sync',
                 '_enforce_booking_price','_promo_count','_session_fill_status','_promote_next_waitlist','_approval_guard',
                 'customer_create_booking','customer_booking_update','customer_addon_stock','customer_login','customer_reset',
                 'customer_update_profile','customer_set_photo','customer_set_socials','customer_push_subscribe',
                 'rider_register','rider_edit','staff_return','list_sessions','customer_signup','customer_oauth_signup',
                 '_oracle_gate','_rider_gate'))
         and (select count(distinct proname) = 11 and not bool_or(definer) from fn where proname in ('_client_ip','_fare_now','_promo_fare','_addon_map',
                 '_addons_ok','_socials_ok','_type_ok','_ymd_ok','_session_has_room','_session_fill_recount','_session_window'))
)
select name, ok from checks order by ok, name;
