create function public.delete_profile(p_profile uuid, p_expected integer, p_username text) returns void
language plpgsql security definer set search_path = '' as $$
declare actor uuid := snoozer.verified_user();
declare deleted_revision integer;
begin
  perform 1 from auth.users where id = actor for update;
  -- Serialize against save, publish, unpublish and avatar commits.
  delete from snoozer.profiles where id = p_profile and owner_id = actor and revision = p_expected and username = p_username
    returning revision into deleted_revision;
  if not found then
    raise exception 'Profile revision conflict' using errcode = '40001';
  end if;
  insert into snoozer.profile_revision_floor(owner_id, next_revision) values (actor, deleted_revision + 1)
    on conflict (owner_id) do update set next_revision = greatest(profile_revision_floor.next_revision, excluded.next_revision);
end $$;

create function snoozer.check_profile_media_quota(p_owner uuid, p_profile uuid, p_expected integer, p_start boolean) returns void
language plpgsql set search_path = '' as $$
declare used bigint;
declare allowance bigint;
begin
  perform pg_advisory_xact_lock(hashtextextended('profile-media:' || p_owner::text, 0));
  perform 1 from snoozer.profiles
    where id = p_profile and owner_id = p_owner and revision = p_expected for update;
  if not found then return; end if;
  select (plan).media_bytes into allowance from snoozer.effective_plan(p_owner);
  select coalesce(sum(snoozer.retained_media_bytes(media_scope)), 0) into used
    from snoozer.profiles where owner_id = p_owner;
  if allowance is null or used > allowance or (p_start and used = allowance) then
    raise exception 'Plan media storage limit reached' using errcode = 'P1104';
  end if;
end
$$;

create function public.prepare_avatar_upload(p_owner uuid, p_profile uuid, p_expected integer, p_open boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare draft snoozer.profiles;
declare today date := (clock_timestamp() at time zone 'UTC')::date;
declare issued integer;
begin
  if p_open then perform snoozer.check_profile_media_quota(p_owner, p_profile, p_expected, true); end if;
  select * into draft from snoozer.profiles where id = p_profile and owner_id = p_owner and revision = p_expected for update;
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
  where id = p_profile and owner_id = p_owner returning * into draft;
  return jsonb_build_object('scope', draft.media_scope, 'key', draft.avatar_upload_key);
end $$;

create function public.clear_avatar_upload(p_owner uuid, p_profile uuid, p_expected integer, p_key text) returns boolean
language sql security definer set search_path = '' as $$
  with cleared as (
    update snoozer.profiles set avatar_upload_key = null, avatar_upload_started_at = null
    where id = p_profile and owner_id = p_owner and revision = p_expected and avatar_upload_key = p_key
    returning 1
  )
  select exists (select 1 from cleared)
$$;

create function public.commit_avatar_upload(p_owner uuid, p_profile uuid, p_expected integer, p_key text, p_avatar uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  perform snoozer.check_profile_media_quota(p_owner, p_profile, p_expected, false);
  update snoozer.profiles set avatar = p_avatar, revision = revision + 1, updated_at = now(),
    avatar_upload_key = null, avatar_upload_started_at = null
  where id = p_profile and owner_id = p_owner and revision = p_expected and avatar_upload_key = p_key and p_avatar is not null
    and avatar_upload_started_at >= clock_timestamp() - interval '24 hours';
  return found;
end
$$;

create function public.begin_avatar_processing(p_owner uuid, p_profile uuid, p_expected integer) returns boolean
language sql security definer set search_path = '' as $$
  with updated as (
    update snoozer.profiles set avatar_attempt_at = clock_timestamp()
    where id = p_profile and owner_id = p_owner and revision = p_expected
      and (avatar_attempt_at is null or avatar_attempt_at < clock_timestamp() - interval '20 seconds')
    returning 1
  )
  select exists (select 1 from updated)
$$;

create function public.avatar_references(p_owner uuid, p_profile uuid) returns uuid[]
language sql stable security definer set search_path = '' as $$
  select array(select avatar from snoozer.profiles where id = p_profile and owner_id = p_owner and avatar is not null
    union select avatar from snoozer.published_profiles where profile_id = p_profile and owner_id = p_owner and avatar is not null)
$$;

create or replace function public.published_avatar_scope(p_name text, p_avatar uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select p.media_scope from snoozer.profiles p join snoozer.published_profiles v
    on (p.id, p.published_revision) = (v.profile_id, v.revision)
  where p.username = p_name and v.avatar = p_avatar
$$;

create or replace function public.draft_avatar_scope(p_avatar uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select p.media_scope from snoozer.profiles p where p.owner_id = snoozer.verified_user()
  and (p.avatar = p_avatar or exists (
    select 1 from snoozer.published_profiles v where v.profile_id = p.id and v.avatar = p_avatar
  ))
  order by p.id limit 1
$$;

create or replace function public.find_orphan_avatars() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(candidate.name), '[]'::jsonb)
  from (
    select o.name
    from storage.objects o
    join snoozer.profiles p on p.media_scope::text = split_part(o.name, '/', 1)
    where o.bucket_id = 'avatar-images'
      and o.created_at < now() - interval '24 hours'
      and o.name ~ '^[0-9a-f-]{36}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$'
      and split_part(o.name, '/', 2) is distinct from p.avatar::text || '.webp'
      and not exists (
        select 1 from snoozer.published_profiles v
        where v.profile_id = p.id and v.avatar::text || '.webp' = split_part(o.name, '/', 2)
      )
    order by o.created_at, o.name limit 40
  ) candidate
$$;

revoke execute on function snoozer.check_profile_media_quota(uuid,uuid,integer,boolean),
  public.delete_profile(uuid,integer,text), public.prepare_avatar_upload(uuid,uuid,integer,boolean),
  public.clear_avatar_upload(uuid,uuid,integer,text), public.commit_avatar_upload(uuid,uuid,integer,text,uuid),
  public.begin_avatar_processing(uuid,uuid,integer), public.avatar_references(uuid,uuid)
from public, anon, authenticated, service_role;
grant execute on function public.delete_profile(uuid,integer,text) to authenticated;
grant execute on function public.prepare_avatar_upload(uuid,uuid,integer,boolean),
  public.clear_avatar_upload(uuid,uuid,integer,text), public.commit_avatar_upload(uuid,uuid,integer,text,uuid),
  public.begin_avatar_processing(uuid,uuid,integer), public.avatar_references(uuid,uuid) to service_role;
