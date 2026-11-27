begin;

-- Background video is private media until a published snapshot references it.
alter table snoozer.profiles
  add column if not exists background_video_upload_day date,
  add column if not exists background_video_upload_count integer not null default 0;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
  ('profile-background-incoming','profile-background-incoming',false,52428800,array['video/mp4','video/webm']),
  ('profile-background-videos','profile-background-videos',false,52428800,array['video/mp4','video/webm'])
on conflict(id) do update set
  public=false,
  file_size_limit=52428800,
  allowed_mime_types=excluded.allowed_mime_types;

create table snoozer.profile_background_videos(
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references snoozer.profiles(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  media_scope uuid not null,
  extension text not null check(extension in ('mp4','webm')),
  content_type text not null check(content_type in ('video/mp4','video/webm')),
  byte_size integer not null check(byte_size between 12 and 52428800),
  state text not null default 'pending' check(state in ('pending','ready')),
  processing_at timestamptz,
  created_at timestamptz not null default now(),
  ready_at timestamptz,
  unique(profile_id,id)
);
create index profile_background_videos_owner_profile_idx
  on snoozer.profile_background_videos(owner_id,profile_id,created_at desc);
alter table snoozer.profile_background_videos enable row level security;
revoke all on table snoozer.profile_background_videos from public,anon,authenticated,service_role;

-- Count video bytes against the same effective per-profile media allowance.
create or replace function snoozer.retained_media_bytes(p_scope uuid) returns bigint
language sql stable set search_path='' as $$
 select coalesce((select sum(case when o.metadata->>'size' ~ '^[0-9]{1,12}$'
    then (o.metadata->>'size')::bigint else b.file_size_limit end)
  from storage.objects o join storage.buckets b on b.id=o.bucket_id
  where o.bucket_id in ('avatar-images','gallery-images','profile-audio','profile-background-videos','product-files')
    and o.name like p_scope::text||'/%'),0)::bigint
  +coalesce((select sum(greatest(0,f.bytes-coalesce((select case
      when o.metadata->>'size' ~ '^[0-9]{1,12}$' then (o.metadata->>'size')::bigint else 4194304 end
    from storage.objects o
    where o.bucket_id='product-files' and o.name=f.media_scope::text||'/'||f.id::text||'.pdf' limit 1),0)))
   from snoozer.product_files f where f.media_scope=p_scope),0)::bigint
$$;

create function public.prepare_profile_background_video_upload(
  p_owner uuid,p_profile uuid,p_expected integer,p_extension text,p_content_type text,p_bytes integer
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  profile snoozer.profiles%rowtype;
  today date := (now() at time zone 'UTC')::date;
  issued integer;
  current_assets integer;
  allowance bigint;
  used bigint;
  asset snoozer.profile_background_videos%rowtype;
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then
    raise exception 'Service role required' using errcode='42501';
  end if;
  if p_bytes is null or p_bytes not between 12 and 52428800
    or not ((p_extension='mp4' and p_content_type='video/mp4')
      or (p_extension='webm' and p_content_type='video/webm')) then
    raise exception 'Invalid background video metadata' using errcode='22023';
  end if;

  select * into profile from snoozer.profiles
    where id=p_profile and owner_id=p_owner and revision=p_expected for update;
  if not found then return null; end if;

  delete from snoozer.profile_background_videos
    where profile_id=p_profile and owner_id=p_owner and state='pending'
      and created_at < now()-interval '2 hours';

  select count(*)::integer into current_assets from snoozer.profile_background_videos
    where profile_id=p_profile and owner_id=p_owner and state in ('pending','ready');
  if current_assets >= 8 then
    raise exception 'Background video library is full' using errcode='P1105';
  end if;

  issued := case when profile.background_video_upload_day=today then profile.background_video_upload_count else 0 end;
  if issued >= 8 then
    raise exception 'Daily background video upload limit reached' using errcode='P1103';
  end if;

  select (e.plan).media_bytes into allowance from snoozer.effective_plan(p_owner) e;
  used := snoozer.retained_media_bytes(profile.media_scope);
  if allowance is null or allowance<=0 or used+p_bytes>allowance then
    raise exception 'Plan media storage limit reached' using errcode='P1104';
  end if;

  insert into snoozer.profile_background_videos(profile_id,owner_id,media_scope,extension,content_type,byte_size)
    values(p_profile,p_owner,profile.media_scope,p_extension,p_content_type,p_bytes)
    returning * into asset;
  update snoozer.profiles
    set background_video_upload_day=today,background_video_upload_count=issued+1
    where id=p_profile and owner_id=p_owner;

  return jsonb_build_object('id',asset.id,'scope',asset.media_scope,'extension',asset.extension,
    'contentType',asset.content_type,'bytes',asset.byte_size);
end
$$;

create function public.get_profile_background_video_upload(
  p_owner uuid,p_profile uuid,p_expected integer,p_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare profile snoozer.profiles%rowtype;
  asset snoozer.profile_background_videos%rowtype;
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then
    raise exception 'Service role required' using errcode='42501';
  end if;
  select * into profile from snoozer.profiles
    where id=p_profile and owner_id=p_owner and revision=p_expected for update;
  if not found then return null; end if;
  select * into asset from snoozer.profile_background_videos
    where id=p_id and profile_id=p_profile and owner_id=p_owner and state='pending' for update;
  if not found then return null; end if;
  if asset.processing_at is not null and asset.processing_at>now()-interval '20 seconds' then return null; end if;
  update snoozer.profile_background_videos set processing_at=now() where id=p_id;
  return jsonb_build_object('id',asset.id,'scope',asset.media_scope,'extension',asset.extension,
    'contentType',asset.content_type,'bytes',asset.byte_size);
end
$$;

create function public.commit_profile_background_video_upload(
  p_owner uuid,p_profile uuid,p_expected integer,p_id uuid,p_actual_bytes integer
) returns boolean language plpgsql security definer set search_path='' as $$
declare profile snoozer.profiles%rowtype;
  asset snoozer.profile_background_videos%rowtype;
  object_size bigint;
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then
    raise exception 'Service role required' using errcode='42501';
  end if;
  select * into profile from snoozer.profiles
    where id=p_profile and owner_id=p_owner and revision=p_expected for update;
  if not found then return false; end if;
  select * into asset from snoozer.profile_background_videos
    where id=p_id and profile_id=p_profile and owner_id=p_owner and state='pending' for update;
  if not found or asset.byte_size<>p_actual_bytes then return false; end if;

  select case when o.metadata->>'size' ~ '^[0-9]{1,12}$'
    then (o.metadata->>'size')::bigint else null end into object_size
    from storage.objects o where o.bucket_id='profile-background-videos'
      and o.name=asset.media_scope::text||'/'||asset.id::text||'.'||asset.extension;
  if not found or (object_size is not null and object_size<>asset.byte_size) then return false; end if;

  update snoozer.profile_background_videos set state='ready',ready_at=now()
    where id=p_id and state='pending';
  return found;
end
$$;

create function public.discard_profile_background_video_upload(
  p_owner uuid,p_profile uuid,p_expected integer,p_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare profile snoozer.profiles%rowtype;
  asset snoozer.profile_background_videos%rowtype;
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then
    raise exception 'Service role required' using errcode='42501';
  end if;
  select * into profile from snoozer.profiles
    where id=p_profile and owner_id=p_owner and revision=p_expected for update;
  if not found then return null; end if;
  delete from snoozer.profile_background_videos
    where id=p_id and profile_id=p_profile and owner_id=p_owner and state='pending'
    returning * into asset;
  if not found then return null; end if;
  return jsonb_build_object('scope',asset.media_scope,'id',asset.id,'extension',asset.extension);
end
$$;

create function public.list_my_profile_background_videos(p_profile uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid := snoozer.verified_user();
begin
  if not exists(select 1 from snoozer.profiles where id=p_profile and owner_id=actor) then
    raise exception 'Profile unavailable' using errcode='42501';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id',v.id,'extension',v.extension,'contentType',v.content_type,'bytes',v.byte_size,'createdAt',v.created_at)
      order by v.created_at desc)
    from snoozer.profile_background_videos v
    where v.profile_id=p_profile and v.owner_id=actor and v.state='ready'),'[]'::jsonb);
end
$$;

create function public.remove_my_profile_background_video(p_profile uuid,p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid := snoozer.verified_user();
  asset snoozer.profile_background_videos%rowtype;
begin
  if not exists(select 1 from snoozer.profiles where id=p_profile and owner_id=actor) then
    raise exception 'Profile unavailable' using errcode='42501';
  end if;
  if exists(select 1 from snoozer.profiles p where p.id=p_profile and p.appearance->>'backgroundVideo'=p_id::text)
    or exists(select 1 from snoozer.published_profiles v join snoozer.profiles p on p.id=v.profile_id
      where v.profile_id=p_profile and v.revision=p.published_revision and v.appearance->>'backgroundVideo'=p_id::text) then
    return jsonb_build_object('error','Remove this clip from the draft and current published profile before deleting it.');
  end if;
  delete from snoozer.profile_background_videos
    where id=p_id and profile_id=p_profile and owner_id=actor and state='ready'
    returning * into asset;
  if not found then return null; end if;
  return jsonb_build_object('scope',asset.media_scope,'id',asset.id,'extension',asset.extension);
end
$$;

create function public.get_published_profile_background_video_object(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor_role text := coalesce(auth.jwt()->>'role','');
  asset snoozer.profile_background_videos%rowtype;
begin
  if actor_role <> 'service_role' then
    raise exception 'Service role required' using errcode='42501';
  end if;
  select v.* into asset
    from snoozer.profile_background_videos v
    join snoozer.profiles p on p.id=v.profile_id and p.owner_id=v.owner_id
    join snoozer.published_profiles snapshot on snapshot.profile_id=p.id and snapshot.revision=p.published_revision
    where v.id=p_id and v.state='ready' and snapshot.appearance->>'backgroundVideo'=p_id::text
    limit 1;
  if not found then return null; end if;
  return jsonb_build_object('scope',asset.media_scope,'id',asset.id,'extension',asset.extension,
    'contentType',asset.content_type,'bytes',asset.byte_size);
end
$$;

create function public.get_my_profile_background_video_object(p_owner uuid,p_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor_role text := coalesce(auth.jwt()->>'role','');
  asset snoozer.profile_background_videos%rowtype;
begin
  if actor_role <> 'service_role' then
    raise exception 'Service role required' using errcode='42501';
  end if;
  select v.* into asset
    from snoozer.profile_background_videos v
    join snoozer.profiles p on p.id=v.profile_id and p.owner_id=v.owner_id
    where v.id=p_id and v.owner_id=p_owner and v.state='ready'
    limit 1;
  if not found then return null; end if;
  return jsonb_build_object('scope',asset.media_scope,'id',asset.id,'extension',asset.extension,
    'contentType',asset.content_type,'bytes',asset.byte_size);
end
$$;

-- Add a UUID-only backgroundVideo key. Image and video backgrounds are mutually exclusive.
create or replace function snoozer.valid_profile_appearance(p_value jsonb) returns boolean
language sql immutable set search_path = '' as $$
 select case when jsonb_typeof(p_value)='object' then coalesce(
   not exists (
     select 1 from jsonb_object_keys(p_value) as allowed_appearance_key(key_name)
     where key_name <> all (array[
       'density','corners','layout','accent','entrance','backgroundImage','backgroundVideo','effects','colors','font','templateStyle',
       'gradientEnabled','opacity','blur','monochromeIcons','animatedTitle','usernameGlow','socialGlow','badgeGlow',
       'location','showLocation','swapBoxColors'
     ]::text[])
   )
   and p_value->'density' is not null and p_value->'corners' is not null
   and p_value->>'density' in ('compact','balanced','airy')
   and p_value->>'corners' in ('square','soft','round')
   and (p_value->'layout' is null or p_value->>'layout' in ('centred','editorial','portfolio'))
   and (p_value->'accent' is null or p_value->>'accent' in ('theme','mint','rose','ink'))
   and (p_value->'entrance' is null or p_value->>'entrance' in ('none','fade','rise'))
   and (p_value->'templateStyle' is null or (
     jsonb_typeof(p_value->'templateStyle')='string'
     and p_value->>'templateStyle' in (
       'slate','mono','paper','sakura','oni','cel','noir','dusk','grain','terminal','matrix','synthwave','forest',
       'ocean','desert','arcade','esports','pixel','studio','brutalist','gallery','vinyl','waveform','backstage',
       'cloud','bloom','lilac','obsidian','goldline','velvet'
     )
   ))
   and (p_value->'backgroundImage' is null or
     (jsonb_typeof(p_value->'backgroundImage')='string' and lower(p_value->>'backgroundImage')
      ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'))
   and (p_value->'backgroundVideo' is null or
     (jsonb_typeof(p_value->'backgroundVideo')='string' and lower(p_value->>'backgroundVideo')
      ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'))
   and not (p_value->'backgroundImage' is not null and p_value->'backgroundVideo' is not null)
   and (p_value->'effects' is null or snoozer.valid_profile_effects(p_value->'effects'))
   and (p_value->'font' is null or p_value->>'font' in ('system','sans','serif','mono'))
   and (p_value->'gradientEnabled' is null or jsonb_typeof(p_value->'gradientEnabled')='boolean')
   and (p_value->'opacity' is null or (jsonb_typeof(p_value->'opacity')='number' and p_value->>'opacity' ~ '^(100|[4-9][0-9])$'))
   and (p_value->'blur' is null or (jsonb_typeof(p_value->'blur')='number' and p_value->>'blur' ~ '^(0|[1-9]|1[0-9]|2[0-4])$'))
   and (p_value->'monochromeIcons' is null or jsonb_typeof(p_value->'monochromeIcons')='boolean')
   and (p_value->'animatedTitle' is null or jsonb_typeof(p_value->'animatedTitle')='boolean')
   and (p_value->'usernameGlow' is null or jsonb_typeof(p_value->'usernameGlow')='boolean')
   and (p_value->'socialGlow' is null or jsonb_typeof(p_value->'socialGlow')='boolean')
   and (p_value->'badgeGlow' is null or jsonb_typeof(p_value->'badgeGlow')='boolean')
   and (p_value->'showLocation' is null or jsonb_typeof(p_value->'showLocation')='boolean')
   and (p_value->'swapBoxColors' is null or jsonb_typeof(p_value->'swapBoxColors')='boolean')
   and (p_value->'location' is null or (
     jsonb_typeof(p_value->'location')='string'
     and char_length(btrim(p_value->>'location')) between 1 and 80
     and p_value->>'location' !~ '[[:cntrl:]]'
   ))
   and (p_value->'colors' is null or (
     jsonb_typeof(p_value->'colors')='object'
     and not exists (
       select 1 from jsonb_object_keys(p_value->'colors') as allowed_colour_key(key_name)
       where key_name <> all (array['background','text','accent','icon','effect','gradientStart','gradientEnd']::text[])
     )
     and (p_value->'colors'->'background' is null or (jsonb_typeof(p_value->'colors'->'background')='string' and p_value->'colors'->>'background' ~ '^#[0-9a-fA-F]{6}$'))
     and (p_value->'colors'->'text' is null or (jsonb_typeof(p_value->'colors'->'text')='string' and p_value->'colors'->>'text' ~ '^#[0-9a-fA-F]{6}$'))
     and (p_value->'colors'->'accent' is null or (jsonb_typeof(p_value->'colors'->'accent')='string' and p_value->'colors'->>'accent' ~ '^#[0-9a-fA-F]{6}$'))
     and (p_value->'colors'->'icon' is null or (jsonb_typeof(p_value->'colors'->'icon')='string' and p_value->'colors'->>'icon' ~ '^#[0-9a-fA-F]{6}$'))
     and (p_value->'colors'->'effect' is null or (jsonb_typeof(p_value->'colors'->'effect')='string' and p_value->'colors'->>'effect' ~ '^#[0-9a-fA-F]{6}$'))
     and (p_value->'colors'->'gradientStart' is null or (jsonb_typeof(p_value->'colors'->'gradientStart')='string' and p_value->'colors'->>'gradientStart' ~ '^#[0-9a-fA-F]{6}$'))
     and (p_value->'colors'->'gradientEnd' is null or (jsonb_typeof(p_value->'colors'->'gradientEnd')='string' and p_value->'colors'->>'gradientEnd' ~ '^#[0-9a-fA-F]{6}$'))
   )), false)
 else false end
$$;

revoke all on function public.prepare_profile_background_video_upload(uuid,uuid,integer,text,text,integer),
  public.get_profile_background_video_upload(uuid,uuid,integer,uuid),
  public.commit_profile_background_video_upload(uuid,uuid,integer,uuid,integer),
  public.discard_profile_background_video_upload(uuid,uuid,integer,uuid),
  public.get_published_profile_background_video_object(uuid),
  public.get_my_profile_background_video_object(uuid,uuid)
from public,anon,authenticated,service_role;
grant execute on function public.prepare_profile_background_video_upload(uuid,uuid,integer,text,text,integer),
  public.get_profile_background_video_upload(uuid,uuid,integer,uuid),
  public.commit_profile_background_video_upload(uuid,uuid,integer,uuid,integer),
  public.discard_profile_background_video_upload(uuid,uuid,integer,uuid),
  public.get_published_profile_background_video_object(uuid),
  public.get_my_profile_background_video_object(uuid,uuid) to service_role;

revoke all on function public.list_my_profile_background_videos(uuid),
  public.remove_my_profile_background_video(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.list_my_profile_background_videos(uuid),
  public.remove_my_profile_background_video(uuid,uuid) to authenticated;

notify pgrst,'reload schema';
commit;
