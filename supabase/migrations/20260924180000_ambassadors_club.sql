-- ============================================================================
-- Ambassadors and the Club (micromobility.sa/ambassadors and /club), run from the staff page.
--
-- The owner's rules (2026-09-24): every submission on the main website is received by the staff
-- page; the programmes follow the launch design's rules, and every number is editable. The
-- numbers live in the website's content store (site_content, edited in the staff page's Website
-- section), so the page that states a rule and the database that applies it read one value:
--   ambassadors.rules.discount     10     % off for anyone using an ambassador's code
--   ambassadors.rules.rentalPts    100    per ride booked with the code
--   ambassadors.rules.eventPts     50     per community event booked with the code
--   ambassadors.rules.workshopPts  100    per workshop request made with the code
--   ambassadors.rules.captainAt    2000   points earned for Captain (Scout below)
--   ambassadors.rules.eliteAt      10000  points earned for Elite
--   ambassadors.redeem.items       [{label, cost}] - what points buy
--   club.rules.perTen              1      credits per SAR 10 of paid, completed rides
--   club.rules.groupRidePts        200    per completed community ride
--   club.rules.reviewPts           50     per completed ride the member rated
--   club.rules.proAt               150    credits for Pro (Rider below)
--   club.rules.legendAt            500    credits for Legend
--
--  1. ambassadors - applications from the website (ambassador_apply) and the ambassadors staff
--     approved. Approving gives the ambassador a code, and that code is an ordinary promo code
--     (promo_codes id 'amb_<id>'): the booking app already takes codes at checkout and keeps the
--     code on every booking, so a friend's discount needs no change there. Pausing or rejecting
--     switches the code off.
--  2. ambassador_redemptions - points spent: asked for from the portal, handed over by staff.
--  3. Points count what really happened (_amb_events): bookings made with the code - confirmed
--     once the ride is done, pending while it is booked, void when cancelled, a no-show or
--     removed - and workshop requests made with it (confirmed when completed). The tier follows
--     the points earned; the balance is earned minus redeemed.
--  4. ambassador_portal(code, mobile) - an ambassador's card; ambassador_redeem - asks for a
--     reward; ambassador_board - this quarter's top five (first names and codes, which
--     ambassadors share publicly anyway). All metered per network.
--  5. The Club is the existing Community membership (tag_saturday): joining is the community
--     application the staff page already approves. club_card(email, mobile) - a member's card:
--     tier and credits counted from their paid rides, completed community rides and ratings.
--     club_rides() - the upcoming community rides for the Club page.
--  6. workshop_jobs.promo_code - a code given on the workshop form, kept only when it is a valid
--     code, and counted for its ambassador. workshop_request is redefined to take it.
--  7. Saving ambassadors.rules.discount reprices every ambassador code at once (bookings already
--     made keep their price).
--  8. staff_ambassador_set / staff_ambassador_stats - the staff page's approve, pause, reject and
--     the numbers beside each ambassador. Staff only (is_staff()).
--
-- Rollback:
--   drop trigger if exists site_content_amb_discount on public.site_content;
--   drop function if exists public._amb_discount_sync();
--   drop function if exists public.club_rides();
--   drop function if exists public.club_card(text, text);
--   drop function if exists public.staff_ambassador_stats();
--   drop function if exists public.staff_ambassador_set(bigint, text, text, text);
--   drop function if exists public.ambassador_board();
--   drop function if exists public.ambassador_redeem(text, text, integer);
--   drop function if exists public.ambassador_portal(text, text);
--   drop function if exists public.ambassador_apply(jsonb);
--   drop function if exists public._amb_summary(bigint);
--   drop function if exists public._amb_events(text);
--   drop function if exists public._amb_redeem_items();
--   drop function if exists public._site_num(text, numeric);
--   drop function if exists public._try_ts(text);
--   drop function if exists public._amb_stamp();
--   drop table if exists public.ambassador_redemptions;
--   delete from public.promo_codes where id like 'amb\_%';
--   drop table if exists public.ambassadors;
--   drop index if exists public.queue_entries_promo_lower;
--   alter table public.workshop_jobs drop column if exists promo_code;  -- and restore workshop_request from 20260924160000
-- Idempotent.
-- ============================================================================

begin;

-- ── Tables ──────────────────────────────────────────────────────────────────
create table if not exists public.ambassadors (
  id           bigint generated always as identity primary key,
  created_at   timestamptz not null default now(),
  name         text not null check (length(name) between 2 and 120),
  phone        text not null check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  instagram    text check (instagram is null or instagram ~ '^[A-Za-z0-9._]{1,30}$'),
  why          text check (why is null or length(why) <= 1000),
  lang         text not null default 'en' check (lang ~ '^[a-z]{2}$'),
  customer_id  text references public.customers(id) on delete set null,
  status       text not null default 'pending' check (status in ('pending','active','paused','rejected')),
  code         text check (code is null or code ~ '^[A-Z0-9]{3,20}$'),
  decided_at   timestamptz,
  staff_notes  text check (staff_notes is null or length(staff_notes) <= 1000),
  updated_at   timestamptz not null default now(),
  updated_by   text check (updated_by is null or length(updated_by) <= 120)
);
create unique index if not exists ambassadors_code on public.ambassadors (code) where code is not null;
-- One live application or membership per mobile; a rejected one may apply again.
create unique index if not exists ambassadors_phone_live on public.ambassadors (phone) where status in ('pending','active','paused');
create index if not exists ambassadors_status_created on public.ambassadors (status, created_at desc);
alter table public.ambassadors enable row level security;
drop policy if exists "ambassadors staff read" on public.ambassadors;
create policy "ambassadors staff read" on public.ambassadors for select to authenticated using ((select public.is_staff()));
drop policy if exists "ambassadors staff update" on public.ambassadors;
create policy "ambassadors staff update" on public.ambassadors for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
drop policy if exists "ambassadors admin delete" on public.ambassadors;
create policy "ambassadors admin delete" on public.ambassadors for delete to authenticated using ((select public.is_admin()));
revoke all on public.ambassadors from anon, authenticated;
grant select, update, delete on public.ambassadors to authenticated;

create table if not exists public.ambassador_redemptions (
  id             bigint generated always as identity primary key,
  created_at     timestamptz not null default now(),
  ambassador_id  bigint not null references public.ambassadors(id) on delete cascade,
  item           text not null check (length(item) between 1 and 120),
  points         integer not null check (points between 1 and 1000000),
  status         text not null default 'requested' check (status in ('requested','given','cancelled')),
  updated_at     timestamptz not null default now(),
  updated_by     text check (updated_by is null or length(updated_by) <= 120)
);
create index if not exists ambassador_redemptions_amb on public.ambassador_redemptions (ambassador_id, created_at desc);
alter table public.ambassador_redemptions enable row level security;
drop policy if exists "amb redemptions staff read" on public.ambassador_redemptions;
create policy "amb redemptions staff read" on public.ambassador_redemptions for select to authenticated using ((select public.is_staff()));
drop policy if exists "amb redemptions staff insert" on public.ambassador_redemptions;
create policy "amb redemptions staff insert" on public.ambassador_redemptions for insert to authenticated with check ((select public.is_staff()));
drop policy if exists "amb redemptions staff update" on public.ambassador_redemptions;
create policy "amb redemptions staff update" on public.ambassador_redemptions for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
drop policy if exists "amb redemptions admin delete" on public.ambassador_redemptions;
create policy "amb redemptions admin delete" on public.ambassador_redemptions for delete to authenticated using ((select public.is_admin()));
revoke all on public.ambassador_redemptions from anon, authenticated;
grant select, insert, update, delete on public.ambassador_redemptions to authenticated;

-- updated_at is the server's clock; updated_by is the operator the staff page names, else the
-- signed-in account's email (the Workshop's rule).
create or replace function public._amb_stamp()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' and coalesce(new.updated_by, '') = '' then
    new.updated_by := left(coalesce(auth.jwt() ->> 'email', 'unknown'), 120);
  end if;
  return new;
end $function$;
revoke all on function public._amb_stamp() from public, anon, authenticated;
drop trigger if exists ambassadors_stamp on public.ambassadors;
create trigger ambassadors_stamp before update on public.ambassadors for each row execute function public._amb_stamp();
drop trigger if exists ambassador_redemptions_stamp on public.ambassador_redemptions;
create trigger ambassador_redemptions_stamp before update on public.ambassador_redemptions for each row execute function public._amb_stamp();

-- Codes on workshop requests, and a lookup index for codes on bookings.
alter table public.workshop_jobs add column if not exists promo_code text;
alter table public.workshop_jobs drop constraint if exists workshop_jobs_promo_code_shape;
alter table public.workshop_jobs add constraint workshop_jobs_promo_code_shape check (promo_code is null or promo_code ~ '^[A-Za-z0-9_-]{1,40}$');
create index if not exists workshop_jobs_promo_lower on public.workshop_jobs (lower(promo_code)) where promo_code is not null;
create index if not exists queue_entries_promo_lower on public.queue_entries (lower(promo_code)) where promo_code is not null;

-- ── Helpers ─────────────────────────────────────────────────────────────────
-- A number staff set in the content store, else the design's.
create or replace function public._site_num(p_key text, p_def numeric)
 returns numeric
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select coalesce((select (value #>> '{}')::numeric from site_content where key = p_key and jsonb_typeof(value) = 'number'), p_def);
$function$;
revoke all on function public._site_num(text, numeric) from public, anon, authenticated;

-- Booking times are stored as text; one that does not read as a time is simply unknown.
create or replace function public._try_ts(p text)
 returns timestamptz
 language plpgsql
 stable
 set search_path to 'public'
as $function$
begin
  return nullif(btrim(p), '')::timestamptz;
exception when others then
  return null;
end $function$;
revoke all on function public._try_ts(text) from public, anon, authenticated;

-- What points buy: the content store's list, else the design's three rewards.
create or replace function public._amb_redeem_items()
 returns jsonb
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select coalesce(
    (select value from site_content where key = 'ambassadors.redeem.items' and jsonb_typeof(value) = 'array' and jsonb_array_length(value) > 0),
    '[{"label":{"en":"Basic workshop service","ar":"خدمة ورشة أساسية"},"cost":500},
      {"label":{"en":"Store kit (cap + socks)","ar":"طقم المتجر (كاب + جوارب)"},"cost":1000},
      {"label":{"en":"Full pro fitting","ar":"قياس احترافي كامل"},"cost":1500}]'::jsonb);
$function$;
revoke all on function public._amb_redeem_items() from public, anon, authenticated;

-- Every use of a code: rides and community events booked with it, workshop requests made with it.
create or replace function public._amb_events(p_code text)
 returns table(at timestamptz, context text, points integer, status text)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select coalesce(_try_ts(q.registered_at), _try_ts(q.session_date), now()),
         case when s.event_kind = 'community' then 'event' else 'rental' end,
         (case when s.event_kind = 'community' then _site_num('ambassadors.rules.eventPts', 50)
               else _site_num('ambassadors.rules.rentalPts', 100) end)::integer,
         case when q.status = 'done' then 'confirmed'
              when q.status in ('waiting','waitlist','active') then 'pending'
              else 'void' end
    from queue_entries q
    left join sessions s on s.id = q.session_id
   where p_code is not null and lower(q.promo_code) = lower(p_code)
  union all
  select w.created_at, 'workshop', _site_num('ambassadors.rules.workshopPts', 100)::integer,
         case when w.status = 'completed' then 'confirmed' when w.status = 'cancelled' then 'void' else 'pending' end
    from workshop_jobs w
   where p_code is not null and lower(w.promo_code) = lower(p_code);
$function$;
revoke all on function public._amb_events(text) from public, anon, authenticated;

-- An ambassador's numbers. The season is the current quarter in Riyadh.
create or replace function public._amb_summary(p_id bigint)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  a ambassadors%rowtype;
  v_q date := date_trunc('quarter', now() at time zone 'Asia/Riyadh')::date;
  v_earned int; v_pending int; v_uses int; v_season int; v_redeemed int;
  v_cap numeric := _site_num('ambassadors.rules.captainAt', 2000);
  v_eli numeric := _site_num('ambassadors.rules.eliteAt', 10000);
  v_tier int;
begin
  select * into a from ambassadors where id = p_id;
  if a.id is null then return null; end if;
  select coalesce(sum(e.points) filter (where e.status = 'confirmed'), 0),
         coalesce(sum(e.points) filter (where e.status = 'pending'), 0),
         count(*) filter (where e.status <> 'void'),
         coalesce(sum(e.points) filter (where e.status = 'confirmed' and (e.at at time zone 'Asia/Riyadh')::date >= v_q), 0)
    into v_earned, v_pending, v_uses, v_season
    from _amb_events(a.code) e;
  select coalesce(sum(r.points), 0) into v_redeemed
    from ambassador_redemptions r where r.ambassador_id = a.id and r.status in ('requested','given');
  v_tier := case when v_earned >= v_eli then 2 when v_earned >= v_cap then 1 else 0 end;
  return jsonb_build_object('earned', v_earned, 'pending', v_pending, 'uses', v_uses, 'season', v_season,
    'redeemed', v_redeemed, 'balance', v_earned - v_redeemed, 'tier', v_tier,
    'next', case v_tier when 0 then v_cap when 1 then v_eli end);
end $function$;
revoke all on function public._amb_summary(bigint) from public, anon, authenticated;

-- ── The website ─────────────────────────────────────────────────────────────
create or replace function public.ambassador_apply(p jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
as $function$
declare
  v_name  text := regexp_replace(trim(coalesce(p->>'name','')), '\s+', ' ', 'g');
  v_phone text := trim(coalesce(p->>'phone',''));
  v_insta text := nullif(regexp_replace(trim(coalesce(p->>'instagram','')), '^(https?://)?(www\.)?(instagram\.com/)?@?', '', 'i'), '');
  v_why   text := nullif(trim(coalesce(p->>'why','')), '');
  v_lang  text := coalesce(nullif(p->>'lang',''), 'en');
  v_cust  text;
  v_prev  ambassadors%rowtype;
begin
  if not _ip_gate('ambapply', 5, interval '10 minutes') then return jsonb_build_object('ok', false, 'error', 'throttled'); end if;
  if v_name = '' or length(v_name) > 120 or not _name_chars_ok(v_name) then return jsonb_build_object('ok', false, 'error', 'name'); end if;
  if v_phone !~ '^\+[1-9][0-9]{7,14}$' or (v_phone like '+966%' and v_phone !~ '^\+9665[0-9]{8}$') then
    return jsonb_build_object('ok', false, 'error', 'phone'); end if;
  v_insta := rtrim(v_insta, '/');
  if v_insta is not null and v_insta !~ '^[A-Za-z0-9._]{1,30}$' then return jsonb_build_object('ok', false, 'error', 'instagram'); end if;
  if v_why is not null and length(v_why) > 1000 then return jsonb_build_object('ok', false, 'error', 'why'); end if;
  if v_lang !~ '^[a-z]{2}$' then v_lang := 'en'; end if;
  -- The account: the signed-in rider, else the only account with this mobile.
  if coalesce(p->>'customer_id','') <> '' and coalesce(p->>'token','') <> '' and _cust_token_ok(p->>'customer_id', p->>'token') then
    v_cust := p->>'customer_id';
  else
    select min(c.id) into v_cust from customers c
     where right(regexp_replace(coalesce(c.phone,''), '\D', '', 'g'), 9) = right(regexp_replace(v_phone, '\D', '', 'g'), 9)
    having count(*) = 1;
  end if;
  perform pg_advisory_xact_lock(hashtext('ambapply:' || v_phone));
  select * into v_prev from ambassadors where phone = v_phone and status in ('pending','active','paused') limit 1;
  if v_prev.id is not null then
    return jsonb_build_object('ok', true, 'status', v_prev.status, 'repeat', true);
  end if;
  insert into ambassadors(name, phone, instagram, why, lang, customer_id, updated_by)
  values (v_name, v_phone, v_insta, v_why, v_lang, v_cust, 'website');
  return jsonb_build_object('ok', true, 'status', 'pending');
end $function$;
revoke all on function public.ambassador_apply(jsonb) from public;
grant execute on function public.ambassador_apply(jsonb) to anon, authenticated;

create or replace function public.ambassador_portal(p_code text, p_phone text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  a ambassadors%rowtype;
  v_digits text := right(regexp_replace(coalesce(p_phone,''), '\D', '', 'g'), 9);
  v_ev jsonb; v_red jsonb;
begin
  if not _ip_gate('ambportal', 30, interval '10 minutes') then return jsonb_build_object('ok', false, 'error', 'throttled'); end if;
  if coalesce(p_code,'') !~* '^\s*[A-Z0-9]{3,20}\s*$' or length(v_digits) < 9 then
    return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  select * into a from ambassadors
   where code = upper(btrim(p_code)) and status in ('active','paused')
     and right(regexp_replace(phone, '\D', '', 'g'), 9) = v_digits;
  if a.id is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  select coalesce(jsonb_agg(jsonb_build_object('at', e.at, 'context', e.context, 'points', e.points, 'status', e.status) order by e.at desc), '[]'::jsonb)
    into v_ev from (select * from _amb_events(a.code) order by at desc limit 12) e;
  select coalesce(jsonb_agg(jsonb_build_object('at', r.created_at, 'item', r.item, 'points', r.points, 'status', r.status) order by r.created_at desc), '[]'::jsonb)
    into v_red from (select * from ambassador_redemptions where ambassador_id = a.id and status <> 'cancelled' order by created_at desc limit 10) r;
  return jsonb_build_object('ok', true, 'first_name', split_part(a.name, ' ', 1), 'code', a.code, 'status', a.status)
    || _amb_summary(a.id) || jsonb_build_object('events', v_ev, 'redemptions', v_red);
end $function$;
revoke all on function public.ambassador_portal(text, text) from public;
grant execute on function public.ambassador_portal(text, text) to anon, authenticated;

create or replace function public.ambassador_redeem(p_code text, p_phone text, p_item integer)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  a ambassadors%rowtype;
  v_digits text := right(regexp_replace(coalesce(p_phone,''), '\D', '', 'g'), 9);
  v_items jsonb := _amb_redeem_items();
  v_it jsonb; v_cost int; v_label text; v_bal int;
begin
  if not _ip_gate('ambredeem', 10, interval '10 minutes') then return jsonb_build_object('ok', false, 'error', 'throttled'); end if;
  select * into a from ambassadors
   where code = upper(btrim(coalesce(p_code,''))) and status = 'active'
     and length(v_digits) >= 9 and right(regexp_replace(phone, '\D', '', 'g'), 9) = v_digits;
  if a.id is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if p_item is null or p_item < 0 or p_item >= jsonb_array_length(v_items) then return jsonb_build_object('ok', false, 'error', 'item'); end if;
  v_it := v_items -> p_item;
  begin v_cost := (v_it ->> 'cost')::numeric::int; exception when others then v_cost := null; end;
  if v_cost is null or v_cost < 1 then return jsonb_build_object('ok', false, 'error', 'item'); end if;
  v_label := left(coalesce(nullif(v_it #>> '{label,en}', ''), nullif(v_it #>> '{label,ar}', ''), 'Reward'), 120);
  perform pg_advisory_xact_lock(hashtext('ambredeem:' || a.id));
  v_bal := (_amb_summary(a.id) ->> 'balance')::int;
  if v_bal < v_cost then return jsonb_build_object('ok', false, 'error', 'points', 'balance', v_bal); end if;
  insert into ambassador_redemptions(ambassador_id, item, points, updated_by) values (a.id, v_label, v_cost, 'website');
  return jsonb_build_object('ok', true, 'item', v_label, 'balance', v_bal - v_cost);
end $function$;
revoke all on function public.ambassador_redeem(text, text, integer) from public;
grant execute on function public.ambassador_redeem(text, text, integer) to anon, authenticated;

create or replace function public.ambassador_board()
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v jsonb;
begin
  if not _ip_gate('ambboard', 60, interval '10 minutes') then return '[]'::jsonb; end if;
  select coalesce(jsonb_agg(x order by (x->>'season')::int desc, (x->>'uses')::int desc), '[]'::jsonb) into v
    from (select jsonb_build_object('first_name', split_part(a.name, ' ', 1), 'code', a.code,
                   'uses', (s->>'uses')::int, 'season', (s->>'season')::int) as x
            from ambassadors a, lateral _amb_summary(a.id) s
           where a.status = 'active'
           order by (s->>'season')::int desc, (s->>'uses')::int desc, a.id
           limit 5) t;
  return v;
end $function$;
revoke all on function public.ambassador_board() from public;
grant execute on function public.ambassador_board() to anon, authenticated;

create or replace function public.club_card(p_email text, p_phone text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_em text := lower(btrim(coalesce(p_email,'')));
  v_digits text := right(regexp_replace(coalesce(p_phone,''), '\D', '', 'g'), 9);
  v_id text; v_name text; v_since bigint; n int;
  v_spend numeric; v_group int; v_rated int; v_rides int; v_credits int; v_tier int;
  v_pro numeric := _site_num('club.rules.proAt', 150);
  v_leg numeric := _site_num('club.rules.legendAt', 500);
begin
  if not _ip_gate('clubcard', 20, interval '10 minutes') then return jsonb_build_object('ok', false, 'error', 'throttled'); end if;
  if v_em = '' or length(v_digits) < 9 then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  select count(*), min(c.id) into n, v_id from customers c
   where (lower(c.email) = v_em or lower(c.apple_email) = v_em)
     and right(regexp_replace(coalesce(c.phone,''), '\D', '', 'g'), 9) = v_digits;
  -- No account, or more than one: the same answer as a rider who is not a member.
  if n <> 1 then return jsonb_build_object('ok', true, 'member', false); end if;
  select ct.added_at into v_since from customer_tags ct
   where ct.customer_id = v_id and ct.tag_id = 'tag_saturday' and _ctag_active(ct.starts_at, ct.expires_at)
   limit 1;
  if not found then return jsonb_build_object('ok', true, 'member', false); end if;
  select name into v_name from customers where id = v_id;
  select coalesce(sum(q.price) filter (where q.status = 'done' and q.paid), 0),
         count(*) filter (where q.status = 'done' and s.event_kind = 'community'),
         count(*) filter (where q.status = 'done' and (q.rating_exp is not null or q.rating_bike is not null)),
         count(*) filter (where q.status = 'done')
    into v_spend, v_group, v_rated, v_rides
    from queue_entries q left join sessions s on s.id = q.session_id
   where q.customer_id = v_id;
  v_credits := floor(v_spend / 10 * _site_num('club.rules.perTen', 1))::int
             + (v_group * _site_num('club.rules.groupRidePts', 200))::int
             + (v_rated * _site_num('club.rules.reviewPts', 50))::int;
  v_tier := case when v_credits >= v_leg then 2 when v_credits >= v_pro then 1 else 0 end;
  return jsonb_build_object('ok', true, 'member', true, 'first_name', split_part(coalesce(v_name, ''), ' ', 1),
    'since', case when v_since is not null then to_timestamp(v_since / 1000.0) end,
    'credits', v_credits, 'tier', v_tier, 'next', case v_tier when 0 then v_pro when 1 then v_leg end, 'rides', v_rides);
end $function$;
revoke all on function public.club_card(text, text) from public;
grant execute on function public.club_card(text, text) to anon, authenticated;

-- The Club page's upcoming rides: open community sessions from today on. The Petromin nights
-- are a company's own and are left out. Titles, days and times only.
create or replace function public.club_rides()
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v jsonb;
begin
  if not _ip_gate('clubrides', 60, interval '10 minutes') then return '[]'::jsonb; end if;
  select coalesce(jsonb_agg(x order by x->>'date', x->>'time'), '[]'::jsonb) into v from (
    select jsonb_build_object('title', coalesce(nullif(btrim(s.title), ''), ''), 'date', s.session_date,
             'time', substring(coalesce(s.bike_slots, '') from '"_time"\s*:\s*"([^"]*)"'), 'kind', s.ride_kind) as x
      from sessions s
     where s.event_kind = 'community' and s.status = 'open' and coalesce(s.ride_kind, '') <> 'petromin'
       and s.session_date >= to_char((now() at time zone 'Asia/Riyadh')::date, 'YYYY-MM-DD')
     order by s.session_date
     limit 6) t;
  return v;
end $function$;
revoke all on function public.club_rides() from public;
grant execute on function public.club_rides() to anon, authenticated;

-- The workshop form, taking a code: kept only when it is a code the booking app would take.
create or replace function public.workshop_request(p jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
as $function$
declare
  v_name    text := regexp_replace(trim(coalesce(p->>'name','')), '\s+', ' ', 'g');
  v_phone   text := trim(coalesce(p->>'phone',''));
  v_email   text := nullif(lower(trim(coalesce(p->>'email',''))), '');
  v_service text := coalesce(p->>'service','');
  v_label   text := nullif(trim(coalesce(p->>'service_label','')), '');
  v_price   numeric;
  v_parts   jsonb := coalesce(p->'parts', '[]'::jsonb);
  v_lane    text := coalesce(nullif(p->>'lane',''), 'dropoff');
  v_addr    text := nullif(trim(coalesce(p->>'pickup_address','')), '');
  v_date    date;
  v_time    text := nullif(p->>'preferred_time','');
  v_bike    text := nullif(trim(coalesce(p->>'bike','')), '');
  v_notes   text := nullif(trim(coalesce(p->>'notes','')), '');
  v_lang    text := coalesce(nullif(p->>'lang',''), 'en');
  v_code    text := nullif(translate(btrim(coalesce(p->>'code','')), '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', '01234567890123456789'), '');
  v_cust    text;
  v_today   date := (now() at time zone 'Asia/Riyadh')::date;
  v_part    jsonb;
  v_prev    bigint;
  v_id      bigint;
begin
  if not _ip_gate('workshop', 10, interval '10 minutes') then
    return jsonb_build_object('ok', false, 'error', 'throttled');
  end if;
  if v_name = '' or length(v_name) > 120 or not _name_chars_ok(v_name) then return jsonb_build_object('ok', false, 'error', 'name'); end if;
  if v_phone !~ '^\+[1-9][0-9]{7,14}$' or (v_phone like '+966%' and v_phone !~ '^\+9665[0-9]{8}$') then
    return jsonb_build_object('ok', false, 'error', 'phone'); end if;
  if v_email is not null and (length(v_email) > 254 or v_email !~ '^[a-z0-9._%+''-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$') then
    return jsonb_build_object('ok', false, 'error', 'email'); end if;
  if v_service !~ '^[a-z0-9_-]{1,40}$' then return jsonb_build_object('ok', false, 'error', 'service'); end if;
  if v_label is not null and (length(v_label) > 80 or v_label ~ '[<>`]') then return jsonb_build_object('ok', false, 'error', 'service'); end if;
  begin v_price := nullif(p->>'price','')::numeric; exception when others then v_price := null; end;
  if v_price is not null and (v_price < 0 or v_price > 100000) then v_price := null; end if;
  if jsonb_typeof(v_parts) <> 'array' or jsonb_array_length(v_parts) > 10 then return jsonb_build_object('ok', false, 'error', 'parts'); end if;
  for v_part in select * from jsonb_array_elements(v_parts) loop
    if jsonb_typeof(v_part) <> 'object' or coalesce(v_part->>'id','') !~ '^[a-z0-9_-]{1,40}$'
       or length(coalesce(v_part->>'label','')) > 80 or coalesce(v_part->>'label','') ~ '[<>`]' then
      return jsonb_build_object('ok', false, 'error', 'parts'); end if;
  end loop;
  if v_lane not in ('dropoff','wait','pickup') then return jsonb_build_object('ok', false, 'error', 'lane'); end if;
  if v_lane = 'pickup' and (v_addr is null or length(v_addr) > 200) then return jsonb_build_object('ok', false, 'error', 'pickup_address'); end if;
  if v_lane <> 'pickup' then v_addr := null; end if;
  if nullif(p->>'preferred_date','') is not null then
    begin v_date := (p->>'preferred_date')::date; exception when others then return jsonb_build_object('ok', false, 'error', 'date'); end;
    if v_date < v_today or v_date > v_today + 60 then return jsonb_build_object('ok', false, 'error', 'date'); end if;
  end if;
  if v_time is not null and v_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then return jsonb_build_object('ok', false, 'error', 'time'); end if;
  if v_bike is not null and length(v_bike) > 80 then return jsonb_build_object('ok', false, 'error', 'bike'); end if;
  if v_notes is not null and length(v_notes) > 600 then return jsonb_build_object('ok', false, 'error', 'notes'); end if;
  if v_lang !~ '^[a-z]{2}$' then v_lang := 'en'; end if;
  if coalesce(p->>'customer_id','') <> '' and coalesce(p->>'token','') <> '' and _cust_token_ok(p->>'customer_id', p->>'token') then
    v_cust := p->>'customer_id';
  end if;
  if v_code is not null and (v_code !~ '^[A-Za-z0-9_-]{1,40}$' or not _promo_valid(v_code, v_cust)) then v_code := null; end if;

  -- A double tap (or a retry after a lost answer) gets the same reference back.
  perform pg_advisory_xact_lock(hashtext('workshop:' || v_phone));
  select id into v_prev from workshop_jobs
   where phone = v_phone and service = v_service and preferred_date is not distinct from v_date
     and status = 'new' and created_at > now() - interval '10 minutes'
   order by id desc limit 1;
  if v_prev is not null then
    return jsonb_build_object('ok', true, 'id', v_prev, 'ref', 'W-' || lpad(v_prev::text, 4, '0'), 'repeat', true);
  end if;

  insert into workshop_jobs(customer_id, name, phone, email, service, service_label, price_quoted, parts, lane, pickup_address,
                            preferred_date, preferred_time, bike, notes, lang, promo_code, updated_by)
  values (v_cust, v_name, v_phone, v_email, v_service, v_label, v_price, v_parts, v_lane, v_addr,
          v_date, v_time, v_bike, v_notes, v_lang, v_code, 'website')
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id, 'ref', 'W-' || lpad(v_id::text, 4, '0'), 'code', v_code is not null);
end $function$;
revoke all on function public.workshop_request(jsonb) from public;
grant execute on function public.workshop_request(jsonb) to anon, authenticated;

-- ── The staff page ──────────────────────────────────────────────────────────
-- Approve (a code, suggested from the first name when none is given), pause, reject, or put
-- back to pending. The code is a promo code: switched on with the ambassador, off without.
create or replace function public.staff_ambassador_set(p_id bigint, p_status text, p_code text default null, p_by text default null)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  a ambassadors%rowtype;
  v_code text; v_base text; v_n int := 1;
  v_by text := left(nullif(btrim(coalesce(p_by, '')), ''), 120);
begin
  if not (select is_staff()) then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  if p_status not in ('active','paused','rejected','pending') then return jsonb_build_object('ok', false, 'error', 'status'); end if;
  select * into a from ambassadors where id = p_id for update;
  if a.id is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if p_status = 'active' then
    v_code := upper(regexp_replace(coalesce(nullif(btrim(coalesce(p_code, '')), ''), a.code, ''), '[^A-Za-z0-9]', '', 'g'));
    if v_code = '' then
      v_base := left(upper(regexp_replace(split_part(a.name, ' ', 1), '[^A-Za-z]', '', 'g')), 14);
      if length(v_base) < 3 then v_base := 'RIDER'; end if;
      v_code := v_base || '10';
      while exists (select 1 from ambassadors where code = v_code and id <> a.id)
         or exists (select 1 from promo_codes where lower(code) = lower(v_code) and id <> 'amb_' || a.id) loop
        v_n := v_n + 1;
        v_code := v_base || (10 * v_n)::text;
      end loop;
    end if;
    if v_code !~ '^[A-Z0-9]{3,20}$' then return jsonb_build_object('ok', false, 'error', 'code'); end if;
    if exists (select 1 from ambassadors where code = v_code and id <> a.id)
       or exists (select 1 from promo_codes where lower(code) = lower(v_code) and id <> 'amb_' || a.id) then
      return jsonb_build_object('ok', false, 'error', 'code_taken');
    end if;
    update ambassadors set status = 'active', code = v_code, decided_at = coalesce(decided_at, now()), updated_by = v_by where id = a.id;
    insert into promo_codes(id, code, kind, value, active, created_at)
    values ('amb_' || a.id, v_code, 'percent', greatest(0, least(100, _site_num('ambassadors.rules.discount', 10))), true,
            to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
    on conflict (id) do update set code = excluded.code, value = excluded.value, active = true;
  else
    update ambassadors set status = p_status, decided_at = case when p_status = 'pending' then null else now() end, updated_by = v_by where id = a.id;
    update promo_codes set active = false where id = 'amb_' || a.id;
  end if;
  return jsonb_build_object('ok', true, 'code', (select code from ambassadors where id = a.id),
    'discount', (select value from promo_codes where id = 'amb_' || a.id));
end $function$;
revoke all on function public.staff_ambassador_set(bigint, text, text, text) from public, anon;
grant execute on function public.staff_ambassador_set(bigint, text, text, text) to authenticated;

-- The numbers beside each ambassador on the staff page, and whether their code is on.
create or replace function public.staff_ambassador_stats()
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare v jsonb;
begin
  if not (select is_staff()) then return '[]'::jsonb; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', a.id,
           'code_active', coalesce((select pc.active from promo_codes pc where pc.id = 'amb_' || a.id), false)) || _amb_summary(a.id)), '[]'::jsonb)
    into v from ambassadors a where a.status <> 'rejected';
  return v;
end $function$;
revoke all on function public.staff_ambassador_stats() from public, anon;
grant execute on function public.staff_ambassador_stats() to authenticated;

-- Saving the discount reprices every ambassador code at once; removing it goes back to 10.
create or replace function public._amb_discount_sync()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v numeric;
begin
  if tg_op = 'DELETE' then
    if old.key = 'ambassadors.rules.discount' then update promo_codes set value = 10 where id like 'amb\_%'; end if;
    return old;
  end if;
  if new.key = 'ambassadors.rules.discount' and jsonb_typeof(new.value) = 'number' then
    v := greatest(0, least(100, (new.value #>> '{}')::numeric));
    update promo_codes set value = v where id like 'amb\_%';
  end if;
  return new;
end $function$;
revoke all on function public._amb_discount_sync() from public, anon, authenticated;
drop trigger if exists site_content_amb_discount on public.site_content;
create trigger site_content_amb_discount after insert or update or delete on public.site_content
  for each row execute function public._amb_discount_sync();

commit;
