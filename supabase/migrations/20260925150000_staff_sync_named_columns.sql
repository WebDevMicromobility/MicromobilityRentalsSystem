-- Staff page fix, 2026-09-25: the Accounts list (and the account report) stopped loading after
-- this morning's update hid customers.password_hash and session_token from API reads.
-- staff_sync runs as the staff member and read whole rows (to_jsonb(c)), which Postgres now
-- refuses. It now names the columns it returns - the same ones as before.
CREATE OR REPLACE FUNCTION public.staff_sync(p_table text, p_since timestamp with time zone DEFAULT NULL::timestamp with time zone, p_cut text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_rows jsonb;
  v_del  jsonb := '[]'::jsonb;
begin
  if not is_staff() then
    raise exception 'STAFF_ONLY' using errcode = '42501';
  end if;

  if p_table = 'queue_entries' then
    select coalesce(jsonb_agg(to_jsonb(q) order by q.session_id, q.queue_num, q.id), '[]'::jsonb)
      into v_rows
      from queue_entries q
     where (p_since is null or q.updated_at > p_since)
       and (p_cut is null or q.session_date >= p_cut);
  elsif p_table = 'customers' then
    -- Column by column: this runs as the staff member, and the API may not read password_hash or
    -- session_token, so a whole-row read is refused. Never the photo either.
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', c.id, 'name', c.name, 'email', c.email, 'phone', c.phone, 'height', c.height,
             'type_preference', c.type_preference, 'gender', c.gender, 'birth_date', c.birth_date,
             'country', c.country, 'city', c.city, 'nationality', c.nationality, 'socials', c.socials,
             'created_at', c.created_at, 'default_pay', c.default_pay, 'hidden_types', c.hidden_types,
             'fix_fields', c.fix_fields, 'apple_email', c.apple_email, 'ride_news_at', c.ride_news_at,
             'ride_news', c.ride_news, 'deletion_requested_at', c.deletion_requested_at, 'updated_at', c.updated_at)
             order by c.created_at, c.id), '[]'::jsonb)
      into v_rows
      from customers c
     where p_since is null or c.updated_at > p_since;
  elsif p_table = 'customer_tags' then
    select coalesce(jsonb_agg(to_jsonb(t) order by t.customer_id, t.tag_id), '[]'::jsonb)
      into v_rows
      from customer_tags t
     where p_since is null or t.updated_at > p_since;
  else
    raise exception 'staff_sync: unknown table %', p_table using errcode = '22023';
  end if;

  if p_since is not null then
    select coalesce(jsonb_agg(jsonb_build_object('id', d.row_id, 'at', d.deleted_at) order by d.deleted_at), '[]'::jsonb)
      into v_del
      from sync_deletions d
     where d.tbl = p_table and d.deleted_at > p_since;
  end if;

  return jsonb_build_object('now', now(), 'rows', v_rows, 'deleted', v_del);
end
$function$;
