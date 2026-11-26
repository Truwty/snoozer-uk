-- Private multi-track audio library. Staged writes are signed and single-use;
-- final objects remain private and are served only when referenced by a live profile.
alter table snoozer.profiles
  add column if not exists audio_upload_day date,
  add column if not exists audio_upload_count integer not null default 0;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
  ('profile-audio-incoming','profile-audio-incoming',false,15728640,
    array['audio/mpeg','audio/mp4','audio/ogg','audio/wav','audio/x-wav','audio/aac','audio/flac','audio/x-flac']),
  ('profile-audio','profile-audio',false,15728640,
    array['audio/mpeg','audio/mp4','audio/ogg','audio/wav','audio/x-wav','audio/aac','audio/flac','audio/x-flac'])
on conflict(id) do update set
  public=false,file_size_limit=15728640,
  allowed_mime_types=excluded.allowed_mime_types;

create table snoozer.profile_audio_assets(
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references snoozer.profiles(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  media_scope uuid not null,
  title text not null check(char_length(title) between 1 and 80 and title ~ '[^[:space:]]'),
  artist text not null check(char_length(artist) between 1 and 80 and artist ~ '[^[:space:]]'),
  extension text not null check(extension in ('mp3','m4a','ogg','wav','aac','flac')),
  content_type text not null check(content_type in ('audio/mpeg','audio/mp4','audio/ogg','audio/wav','audio/x-wav','audio/aac','audio/flac','audio/x-flac')),
  byte_size integer not null check(byte_size between 1 and 15728640),
  state text not null default 'pending' check(state in ('pending','ready')),
  processing_at timestamptz,
  created_at timestamptz not null default now(),
  ready_at timestamptz,
  unique(profile_id,id)
);
create index profile_audio_assets_owner_profile_idx
  on snoozer.profile_audio_assets(owner_id,profile_id,created_at desc);
alter table snoozer.profile_audio_assets enable row level security;
revoke all on table snoozer.profile_audio_assets from public,anon,authenticated,service_role;

-- Include audio in the same per-profile media quota as avatars and gallery images.
create or replace function snoozer.retained_media_bytes(p_scope uuid) returns bigint
language sql stable set search_path='' as $$
 select coalesce((select sum(case when o.metadata->>'size' ~ '^[0-9]{1,12}$'
    then (o.metadata->>'size')::bigint else b.file_size_limit end)
  from storage.objects o join storage.buckets b on b.id=o.bucket_id
  where o.bucket_id in ('avatar-images','gallery-images','profile-audio','product-files')
    and o.name like p_scope::text||'/%'),0)::bigint
  +coalesce((select sum(greatest(0,f.bytes-coalesce((select case
      when o.metadata->>'size' ~ '^[0-9]{1,12}$' then (o.metadata->>'size')::bigint else 4194304 end
    from storage.objects o
    where o.bucket_id='product-files' and o.name=f.media_scope::text||'/'||f.id::text||'.pdf' limit 1),0)))
   from snoozer.product_files f where f.media_scope=p_scope),0)::bigint
$$;

create function public.prepare_profile_audio_upload(
  p_owner uuid,p_profile uuid,p_expected integer,p_title text,p_artist text,
  p_extension text,p_content_type text,p_bytes integer
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  profile snoozer.profiles%rowtype;
  today date := (now() at time zone 'UTC')::date;
  issued integer;
  current_assets integer;
  allowance bigint;
  used bigint;
  asset snoozer.profile_audio_assets%rowtype;
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then
    raise exception 'Service role required' using errcode='42501';
  end if;
  if char_length(btrim(coalesce(p_title,''))) not between 1 and 80
    or char_length(btrim(coalesce(p_artist,''))) not between 1 and 80
    or p_bytes is null or p_bytes not between 1 and 15728640
    or not (
      (p_extension='mp3' and p_content_type='audio/mpeg')
      or (p_extension='m4a' and p_content_type='audio/mp4')
      or (p_extension='ogg' and p_content_type='audio/ogg')
      or (p_extension='wav' and p_content_type in ('audio/wav','audio/x-wav'))
      or (p_extension='aac' and p_content_type='audio/aac')
      or (p_extension='flac' and p_content_type in ('audio/flac','audio/x-flac'))
    ) then
    raise exception 'Invalid audio metadata' using errcode='22023';
  end if;

  select * into profile from snoozer.profiles
    where id=p_profile and owner_id=p_owner and revision=p_expected for update;
  if not found then return null; end if;

  -- Expire abandoned staging rows; their private objects are also removed by
  -- the existing orphan-media maintenance process after the retention window.
  delete from snoozer.profile_audio_assets
    where profile_id=p_profile and owner_id=p_owner and state='pending'
      and created_at < now()-interval '2 hours';

  select count(*)::integer into current_assets from snoozer.profile_audio_assets
    where profile_id=p_profile and state in ('pending','ready');
  if current_assets >= 30 then
    raise exception 'Audio library is full' using errcode='P1105';
  end if;

  issued := case when profile.audio_upload_day=today then profile.audio_upload_count else 0 end;
  if issued >= 12 then
    raise exception 'Daily audio upload limit reached' using errcode='P1103';
  end if;

  select (e.plan).media_bytes into allowance from snoozer.effective_plan(p_owner) e;
  used := snoozer.retained_media_bytes(profile.media_scope);
  if allowance is null or allowance<=0 or used+p_bytes>allowance then
    raise exception 'Plan media storage limit reached' using errcode='P1104';
  end if;

  insert into snoozer.profile_audio_assets(profile_id,owner_id,media_scope,title,artist,extension,content_type,byte_size)
    values(p_profile,p_owner,profile.media_scope,btrim(p_title),btrim(p_artist),p_extension,p_content_type,p_bytes)
    returning * into asset;
  update snoozer.profiles set audio_upload_day=today,audio_upload_count=issued+1
    where id=p_profile and owner_id=p_owner;

  return jsonb_build_object('id',asset.id,'scope',asset.media_scope,'extension',asset.extension,
    'contentType',asset.content_type,'title',asset.title,'artist',asset.artist,'bytes',asset.byte_size);
end
$$;

create function public.get_profile_audio_upload(
  p_owner uuid,p_profile uuid,p_expected integer,p_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare profile snoozer.profiles%rowtype;
declare asset snoozer.profile_audio_assets%rowtype;
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then
    raise exception 'Service role required' using errcode='42501';
  end if;
  select * into profile from snoozer.profiles
    where id=p_profile and owner_id=p_owner and revision=p_expected for update;
  if not found then return null; end if;
  select * into asset from snoozer.profile_audio_assets
    where id=p_id and profile_id=p_profile and owner_id=p_owner and state='pending' for update;
  if not found then return null; end if;
  if asset.processing_at is not null and asset.processing_at>now()-interval '20 seconds' then return null; end if;
  update snoozer.profile_audio_assets set processing_at=now() where id=p_id;
  return jsonb_build_object('id',asset.id,'scope',asset.media_scope,'extension',asset.extension,
    'contentType',asset.content_type,'title',asset.title,'artist',asset.artist,'bytes',asset.byte_size);
end
$$;

create function public.commit_profile_audio_upload(
  p_owner uuid,p_profile uuid,p_expected integer,p_id uuid,p_actual_bytes integer
) returns boolean language plpgsql security definer set search_path='' as $$
declare profile snoozer.profiles%rowtype;
declare asset snoozer.profile_audio_assets%rowtype;
declare object_size bigint;
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then
    raise exception 'Service role required' using errcode='42501';
  end if;
  select * into profile from snoozer.profiles
    where id=p_profile and owner_id=p_owner and revision=p_expected for update;
  if not found then return false; end if;
  select * into asset from snoozer.profile_audio_assets
    where id=p_id and profile_id=p_profile and owner_id=p_owner and state='pending' for update;
  if not found or asset.byte_size<>p_actual_bytes then return false; end if;

  select case when o.metadata->>'size' ~ '^[0-9]{1,12}$'
    then (o.metadata->>'size')::bigint else null end into object_size
    from storage.objects o where o.bucket_id='profile-audio'
      and o.name=asset.media_scope::text||'/'||asset.id::text||'.'||asset.extension;
  if not found or (object_size is not null and object_size<>asset.byte_size) then return false; end if;

  update snoozer.profile_audio_assets set state='ready',ready_at=now()
    where id=p_id and state='pending';
  return found;
end
$$;

create function public.discard_profile_audio_upload(
  p_owner uuid,p_profile uuid,p_expected integer,p_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare profile snoozer.profiles%rowtype;
declare asset snoozer.profile_audio_assets%rowtype;
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then
    raise exception 'Service role required' using errcode='42501';
  end if;
  select * into profile from snoozer.profiles
    where id=p_profile and owner_id=p_owner and revision=p_expected for update;
  if not found then return null; end if;
  delete from snoozer.profile_audio_assets
    where id=p_id and profile_id=p_profile and owner_id=p_owner and state='pending'
    returning * into asset;
  if not found then return null; end if;
  return jsonb_build_object('scope',asset.media_scope,'id',asset.id,'extension',asset.extension);
end
$$;

create function public.list_my_profile_audio(p_profile uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid := snoozer.verified_user();
begin
  if not exists(select 1 from snoozer.profiles where id=p_profile and owner_id=actor) then
    raise exception 'Profile unavailable' using errcode='42501';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id',a.id,'title',a.title,'artist',a.artist,'extension',a.extension,
      'contentType',a.content_type,'bytes',a.byte_size,'createdAt',a.created_at)
      order by a.created_at desc)
    from snoozer.profile_audio_assets a
    where a.profile_id=p_profile and a.owner_id=actor and a.state='ready'),'[]'::jsonb);
end
$$;

create function public.remove_my_profile_audio(p_profile uuid,p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid := snoozer.verified_user();
declare asset snoozer.profile_audio_assets%rowtype;
begin
  if not exists(select 1 from snoozer.profiles where id=p_profile and owner_id=actor) then
    raise exception 'Profile unavailable' using errcode='42501';
  end if;
  if exists(select 1 from snoozer.links where profile_id=p_profile and url like '%'||p_id::text||'%')
    or exists(select 1 from snoozer.published_links l join snoozer.profiles p on p.id=l.profile_id
      where l.profile_id=p_profile and l.revision=p.published_revision and l.url like '%'||p_id::text||'%') then
    return jsonb_build_object('error','Remove this track from the draft and current published profile before deleting it.');
  end if;
  delete from snoozer.profile_audio_assets
    where id=p_id and profile_id=p_profile and owner_id=actor and state='ready'
    returning * into asset;
  if not found then return null; end if;
  return jsonb_build_object('scope',asset.media_scope,'id',asset.id,'extension',asset.extension);
end
$$;

create function public.get_published_profile_audio_object(p_filename text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor_role text := coalesce(auth.jwt()->>'role','');
declare asset snoozer.profile_audio_assets%rowtype;
begin
  if actor_role <> 'service_role' then
    raise exception 'Service role required' using errcode='42501';
  end if;
  if p_filename !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(mp3|m4a|ogg|wav|aac|flac)$' then
    return null;
  end if;
  select a.* into asset
    from snoozer.profile_audio_assets a
    join snoozer.profiles p on p.id=a.profile_id and p.owner_id=a.owner_id
    where a.state='ready' and p.published_revision is not null
      and a.id::text||'.'||a.extension=p_filename
      and exists(
        select 1 from snoozer.published_links l
        where l.profile_id=p.id and l.revision=p.published_revision and not l.hidden
          and right(regexp_replace(l.url,'[?#].*$','','g'),char_length('/media/audio/'||p_filename))='/media/audio/'||p_filename
      )
    limit 1;
  if not found then return null; end if;
  return jsonb_build_object('scope',asset.media_scope,'id',asset.id,'extension',asset.extension,
    'contentType',asset.content_type,'bytes',asset.byte_size);
end
$$;

revoke all on function public.prepare_profile_audio_upload(uuid,uuid,integer,text,text,text,text,integer),
  public.get_profile_audio_upload(uuid,uuid,integer,uuid),
  public.commit_profile_audio_upload(uuid,uuid,integer,uuid,integer),
  public.discard_profile_audio_upload(uuid,uuid,integer,uuid),
  public.get_published_profile_audio_object(text)
from public,anon,authenticated,service_role;
grant execute on function public.prepare_profile_audio_upload(uuid,uuid,integer,text,text,text,text,integer),
  public.get_profile_audio_upload(uuid,uuid,integer,uuid),
  public.commit_profile_audio_upload(uuid,uuid,integer,uuid,integer),
  public.discard_profile_audio_upload(uuid,uuid,integer,uuid),
  public.get_published_profile_audio_object(text) to service_role;

revoke all on function public.list_my_profile_audio(uuid),public.remove_my_profile_audio(uuid,uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.list_my_profile_audio(uuid),public.remove_my_profile_audio(uuid,uuid)
  to authenticated;

notify pgrst,'reload schema';
