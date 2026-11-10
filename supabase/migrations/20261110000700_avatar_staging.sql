alter table snoozer.profiles add column avatar_upload_key text,
  add column avatar_upload_started_at timestamptz,
  add column avatar_upload_day date,
  add column avatar_upload_count integer not null default 0;

-- Keep a previously staged upload usable during the transition.
update snoozer.profiles p
set avatar_upload_key = 'pending', avatar_upload_started_at = o.created_at
from storage.objects o
where o.bucket_id = 'avatar-incoming' and o.name = p.media_scope::text || '/pending'
  and o.created_at >= now() - interval '24 hours';

create function public.prepare_avatar_upload(p_owner uuid, p_expected integer, p_open boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare draft snoozer.profiles;
declare today date := (clock_timestamp() at time zone 'UTC')::date;
declare issued integer;
begin
  select * into draft from snoozer.profiles where owner_id = p_owner and revision = p_expected for update;
  if not found then return null; end if;
  if draft.avatar_upload_started_at >= clock_timestamp() - interval '24 hours' then
    return jsonb_build_object('scope', draft.media_scope, 'key', draft.avatar_upload_key);
  end if;
  if p_open is not true then return jsonb_build_object('scope', draft.media_scope, 'key', null); end if;

  issued := case when draft.avatar_upload_day = today then draft.avatar_upload_count else 0 end;
  if issued >= 12 then raise exception 'Upload limit reached' using errcode = 'P1003'; end if;
  update snoozer.profiles set
    avatar_upload_key = gen_random_uuid()::text || '.upload',
    avatar_upload_started_at = clock_timestamp(),
    avatar_upload_day = today, avatar_upload_count = issued + 1
  where owner_id = p_owner returning * into draft;
  return jsonb_build_object('scope', draft.media_scope, 'key', draft.avatar_upload_key);
end $$;

create function public.clear_avatar_upload(p_owner uuid, p_expected integer, p_key text) returns boolean
language sql security definer set search_path = '' as $$
  with cleared as (
    update snoozer.profiles set avatar_upload_key = null, avatar_upload_started_at = null
    where owner_id = p_owner and revision = p_expected and avatar_upload_key = p_key
    returning 1
  )
  select exists (select 1 from cleared)
$$;

create function public.commit_avatar_upload(p_owner uuid, p_expected integer, p_key text, p_avatar uuid) returns boolean
language sql security definer set search_path = '' as $$
  with committed as (
    update snoozer.profiles set avatar = p_avatar, revision = revision + 1, updated_at = now(),
      avatar_upload_key = null, avatar_upload_started_at = null
    where owner_id = p_owner and revision = p_expected and avatar_upload_key = p_key and p_avatar is not null
      and avatar_upload_started_at >= clock_timestamp() - interval '24 hours'
    returning 1
  )
  select exists (select 1 from committed)
$$;

create function public.find_abandoned_avatar_uploads() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(candidate.name), '[]'::jsonb)
  from (
    select o.name
    from storage.objects o
    join snoozer.profiles p on p.media_scope::text = split_part(o.name, '/', 1)
    where o.bucket_id = 'avatar-incoming'
      and o.created_at < now() - interval '24 hours'
      and o.name ~ '^[0-9a-f-]{36}/(pending|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.upload)$'
      and (split_part(o.name, '/', 2) is distinct from p.avatar_upload_key
        or p.avatar_upload_started_at < now() - interval '24 hours')
    order by o.created_at, o.name limit 40
  ) candidate
$$;

revoke execute on function public.prepare_avatar_upload(uuid,integer,boolean), public.clear_avatar_upload(uuid,integer,text),
  public.commit_avatar_upload(uuid,integer,text,uuid), public.find_abandoned_avatar_uploads()
from public, anon, authenticated, service_role;
grant execute on function public.prepare_avatar_upload(uuid,integer,boolean), public.clear_avatar_upload(uuid,integer,text),
  public.commit_avatar_upload(uuid,integer,text,uuid), public.find_abandoned_avatar_uploads()
to service_role;
