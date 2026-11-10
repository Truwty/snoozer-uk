insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatar-incoming', 'avatar-incoming', false, 2097152, array['image/jpeg','image/png','image/webp']),
  ('avatar-images', 'avatar-images', false, 262144, array['image/webp']);

-- No browser storage policies. Only the backend can grant a scoped upload.
alter table snoozer.profiles add column avatar_attempt_at timestamptz;

create function public.begin_avatar_processing(p_owner uuid, p_expected integer) returns boolean
language sql security definer set search_path = '' as $$
  with updated as (
    update snoozer.profiles set avatar_attempt_at = clock_timestamp()
    where owner_id = p_owner and revision = p_expected
      and (avatar_attempt_at is null or avatar_attempt_at < clock_timestamp() - interval '20 seconds')
    returning 1
  )
  select exists (select 1 from updated)
$$;

create function public.set_avatar(p_owner uuid, p_expected integer, p_avatar uuid) returns boolean
language sql security definer set search_path = '' as $$
  with updated as (
    update snoozer.profiles set avatar = p_avatar, revision = revision + 1, updated_at = now()
    where owner_id = p_owner and revision = p_expected and p_avatar is not null
    returning 1
  )
  select exists (select 1 from updated)
$$;

create function public.avatar_references(p_owner uuid) returns uuid[]
language sql stable security definer set search_path = '' as $$
  select array(select avatar from snoozer.profiles where owner_id = p_owner and avatar is not null
    union select avatar from snoozer.published_profiles where owner_id = p_owner and avatar is not null)
$$;

create function public.published_avatar_owner(p_name text, p_avatar uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select p.owner_id from snoozer.profiles p join snoozer.published_profiles v
    on (p.owner_id, p.published_revision) = (v.owner_id, v.revision)
  where p.username = p_name and v.avatar = p_avatar
$$;

revoke execute on function public.begin_avatar_processing(uuid,integer), public.set_avatar(uuid,integer,uuid),
  public.avatar_references(uuid), public.published_avatar_owner(text,uuid) from public, anon, authenticated, service_role;
grant execute on function public.begin_avatar_processing(uuid,integer), public.set_avatar(uuid,integer,uuid),
  public.avatar_references(uuid), public.published_avatar_owner(text,uuid) to service_role;
