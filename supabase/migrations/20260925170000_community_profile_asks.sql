-- Community members owe a birth date and a nationality before they book (user rule, 2026-09-25).
-- While an account holds an active Community tag (tag_saturday) and either field is empty,
-- _customer_asks adds it to what the account is asked. Its three callers follow with no change
-- of their own: customer_fix_fields shows the rider what is asked (the app raises it at sign-in,
-- when the site opens and at every booking), customer_fix_save takes the answers, and
-- customer_create_booking refuses the booking (FIX_FIRST) until both are on file.
-- Everyone else keeps the app's eight-booking rule, which never reaches the server.
--
-- Rebuilt from the live definition (pg_get_functiondef, 2026-09-25, md5 of prosrc
-- d92205f54acd6b38d0d54baa1e1d5d9b), attributes kept: STABLE SECURITY DEFINER,
-- search_path public, extensions. CREATE OR REPLACE keeps its grants.
create or replace function public._customer_asks(p_id text)
 returns text[]
 language plpgsql
 stable security definer
 set search_path to 'public', 'extensions'
as $function$
declare c customers%rowtype; f text[]; relay boolean;
begin
  select * into c from customers where customers.id = p_id;
  if not found then return null; end if;
  f := coalesce(c.fix_fields,'{}'::text[]);
  relay := lower(btrim(coalesce(c.email,''))) like '%@privaterelay.appleid.com';
  if relay and not ('email' = any(f)) then
    f := f || 'email'::text;
  end if;
  if coalesce(btrim(c.apple_email),'') <> '' and coalesce(c.password_hash,'') like 'oauth:%'
     and (not relay or 'email' = any(f)) then
    f := f || 'password'::text;
  end if;
  if exists (select 1 from customer_tags ct
              where ct.customer_id = p_id and ct.tag_id = 'tag_saturday'
                and _ctag_active(ct.starts_at, ct.expires_at)) then
    if coalesce(btrim(c.birth_date),'') = '' and not ('birth_date' = any(f)) then
      f := f || 'birth_date'::text;
    end if;
    if coalesce(btrim(c.nationality),'') = '' and not ('nationality' = any(f)) then
      f := f || 'nationality'::text;
    end if;
  end if;
  return f;
end $function$;
