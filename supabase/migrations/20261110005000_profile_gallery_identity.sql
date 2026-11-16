create function public.prepare_gallery_upload_for_profile(p_profile uuid, p_owner uuid, p_expected integer, p_alt text, p_id uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare profile snoozer.profiles%rowtype;
declare stage snoozer.gallery_items%rowtype;
declare today date := (now() at time zone 'UTC')::date;
declare issued integer;
begin
  if p_id is null and p_alt is not null then
    perform snoozer.check_profile_media_quota(p_owner, p_profile, p_expected, true);
  end if;
  select * into profile from snoozer.profiles where id = p_profile and owner_id = p_owner and revision = p_expected for update;
  if not found then return null; end if;
  delete from snoozer.gallery_items where profile_id = p_profile and variant is null and created_at < now() - interval '2 hours';
  select * into stage from snoozer.gallery_items where profile_id = p_profile and variant is null;
  if p_id is not null then
    if stage.id is distinct from p_id or stage.processing_at > now() - interval '20 seconds' then return null; end if;
    update snoozer.gallery_items set processing_at = now() where profile_id = p_profile and id = p_id;
  elsif stage.id is null and p_alt is not null then
    if (select count(*) from snoozer.gallery_items where profile_id = p_profile and position is not null) >= 8 then
      raise exception 'Gallery is full' using errcode = 'P1101';
    end if;
    if (select count(*) from snoozer.gallery_items where profile_id = p_profile) >= 48 then
      raise exception 'Media limit reached' using errcode = 'P1102';
    end if;
    issued := case when profile.gallery_upload_day = today then profile.gallery_upload_count else 0 end;
    if issued >= 12 then
      raise exception 'Upload limit reached' using errcode = 'P1103';
    end if;
    update snoozer.profiles set gallery_upload_day = today, gallery_upload_count = issued + 1 where id = p_profile;
    insert into snoozer.gallery_items(owner_id, profile_id, alt) values (p_owner, p_profile, btrim(p_alt)) returning * into stage;
  end if;
  if stage.id is null then return null; end if;
  return jsonb_build_object('scope', profile.media_scope, 'id', stage.id, 'alt', stage.alt);
end $$;

create function public.commit_gallery_upload(p_profile uuid, p_owner uuid, p_expected integer, p_id uuid, p_variant uuid, p_width integer, p_height integer) returns boolean
language plpgsql security definer set search_path = '' as $$
declare next_position integer;
begin
  perform snoozer.check_profile_media_quota(p_owner, p_profile, p_expected, false);
  perform 1 from snoozer.profiles where id = p_profile and owner_id = p_owner and revision = p_expected for update;
  if not found then return false; end if;
  select n into next_position from generate_series(1,8) n where not exists (
    select 1 from snoozer.gallery_items where profile_id = p_profile and position = n
  ) order by n limit 1;
  if next_position is null or p_variant is null or p_width is null or p_height is null then return false; end if;
  update snoozer.gallery_items set position = next_position, variant = p_variant, width = p_width, height = p_height
    where profile_id = p_profile and id = p_id and variant is null and processing_at is not null
      and created_at >= now() - interval '2 hours';
  if not found then return false; end if;
  update snoozer.profiles set revision = revision + 1, updated_at = now() where id = p_profile;
  return true;
end $$;

create function public.discard_gallery_upload(p_profile uuid, p_owner uuid, p_expected integer, p_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare scope uuid;
begin
  select media_scope into scope from snoozer.profiles where id = p_profile and owner_id = p_owner and revision = p_expected for update;
  if not found then return null; end if;
  delete from snoozer.gallery_items where profile_id = p_profile and id = p_id and variant is null;
  if not found then return null; end if;
  return scope;
end $$;

create function public.edit_gallery(p_profile uuid, p_expected integer, p_id uuid, p_operation text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare actor uuid := snoozer.verified_user();
declare old_position integer;
declare other_position integer;
begin
  perform 1 from snoozer.profiles where id = p_profile and owner_id = actor and revision = p_expected for update;
  if not found then return false; end if;
  select position into old_position from snoozer.gallery_items where profile_id = p_profile and id = p_id and position is not null;
  if not found then return false; end if;
  if p_operation = 'remove' then
    update snoozer.gallery_items set position = null where profile_id = p_profile and id = p_id;
    update snoozer.gallery_items set position = position - 1 where profile_id = p_profile and position > old_position;
  elsif p_operation in ('earlier', 'later') then
    other_position := old_position + case when p_operation = 'earlier' then -1 else 1 end;
    if not exists (select 1 from snoozer.gallery_items where profile_id = p_profile and position = other_position) then return false; end if;
    update snoozer.gallery_items set position = case when id = p_id then other_position else old_position end
      where profile_id = p_profile and position in (old_position, other_position);
  else
    return false;
  end if;
  update snoozer.profiles set revision = revision + 1, updated_at = now() where id = p_profile;
  return true;
end $$;

create function public.pending_gallery_upload(p_profile uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', id, 'alt', alt) from snoozer.gallery_items
  where profile_id = p_profile and owner_id = snoozer.verified_user() and variant is null and created_at >= now() - interval '2 hours'
$$;

create function snoozer.profile_library_items(p_profile uuid) returns setof snoozer.gallery_items
language sql stable set search_path = '' as $$
  select g.* from snoozer.gallery_items g
  where g.profile_id = p_profile and g.variant is not null and g.blocked_at is null
    and (g.position is not null or exists (
      select 1 from snoozer.published_gallery s where s.profile_id = p_profile and s.item = g.id
    ))
$$;

create function public.get_media_folders(p_profile uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('scope', p.media_scope, 'revision', p.media_folder_revision,
    'folders', coalesce((
      select jsonb_agg(jsonb_build_object('id', f.id, 'name', f.name) order by lower(f.name), f.id)
      from snoozer.media_folders f where f.profile_id = p.id
    ), '[]'::jsonb),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object('id', g.id, 'alt', g.alt, 'width', g.width,
        'height', g.height, 'folder', g.folder_id, 'in_draft', g.position is not null)
        order by g.created_at desc, g.id)
      from snoozer.profile_library_items(p.id) g
    ), '[]'::jsonb))
  from snoozer.profiles p where p.id = p_profile and p.owner_id = snoozer.verified_user()
$$;

create function public.edit_media_folders_for_profile(p_profile uuid, p_scope uuid, p_expected integer, p_operation text,
  p_id uuid default null, p_name text default null, p_folder uuid default null) returns text
language plpgsql security definer set search_path = '' as $$
declare actor uuid := snoozer.verified_user();
declare folder_name text := btrim(p_name);
declare previous_folder uuid;
begin
  perform 1 from snoozer.profiles where id = p_profile and owner_id = actor and media_scope = p_scope
    and media_folder_revision = p_expected for update;
  if not found then return 'changed'; end if;

  if p_operation in ('create', 'rename') then
    if folder_name is null or char_length(folder_name) not between 1 and 60
      or folder_name !~ '[^[:space:]]' or folder_name ~ '[[:cntrl:]]' or lower(folder_name) = 'unfiled'
      then return 'invalid_name'; end if;
    if exists (select 1 from snoozer.media_folders where profile_id = p_profile
      and lower(name) = lower(folder_name) and (p_operation = 'create' or id is distinct from p_id))
      then return 'duplicate'; end if;
  end if;

  case p_operation
    when 'create' then
      if (select count(*) from snoozer.media_folders where profile_id = p_profile) >= 12 then return 'limit'; end if;
      insert into snoozer.media_folders(owner_id, profile_id, name) values (actor, p_profile, folder_name);
    when 'rename' then
      update snoozer.media_folders set name = folder_name where profile_id = p_profile and id = p_id;
      if not found then return 'not_found'; end if;
    when 'delete' then
      update snoozer.gallery_items set folder_id = null where profile_id = p_profile and folder_id = p_id;
      delete from snoozer.media_folders where profile_id = p_profile and id = p_id;
      if not found then return 'not_found'; end if;
    when 'move' then
      if p_folder is not null and not exists (
        select 1 from snoozer.media_folders where profile_id = p_profile and id = p_folder
      ) then return 'not_found'; end if;
      select g.folder_id into previous_folder from snoozer.profile_library_items(p_profile) g where g.id = p_id;
      if not found then return 'not_found'; end if;
      if previous_folder is not distinct from p_folder then return 'saved'; end if;
      update snoozer.gallery_items set folder_id = p_folder where profile_id = p_profile and id = p_id;
    else
      return 'invalid_operation';
  end case;
  update snoozer.profiles set media_folder_revision = media_folder_revision + 1 where id = p_profile;
  return 'saved';
end $$;

create function public.add_library_image_to_gallery(p_profile uuid, p_expected integer, p_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare actor uuid := snoozer.verified_user();
declare last_position integer;
begin
  perform 1 from snoozer.profiles where id = p_profile and owner_id = actor and revision = p_expected for update;
  if not found then return 'changed'; end if;

  if not exists (select 1 from snoozer.profile_library_items(p_profile) g where g.id = p_id and g.position is null)
    then return 'unavailable'; end if;

  select coalesce(max(position), 0) into last_position from snoozer.gallery_items where profile_id = p_profile;
  if last_position >= 8 then return 'limit'; end if;

  update snoozer.gallery_items set position = last_position + 1 where profile_id = p_profile and id = p_id;
  update snoozer.profiles set revision = revision + 1, updated_at = now() where id = p_profile;
  return 'added';
end $$;

create or replace function public.gallery_object(p_id uuid, p_name text default null, p_owner uuid default null) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('scope', p.media_scope, 'variant', g.variant)
  from snoozer.profiles p join snoozer.gallery_items g on g.profile_id = p.id and g.id = p_id
  where g.variant is not null and g.blocked_at is null and (
    (p_owner is null and p.username = p_name and exists (
      select 1 from snoozer.published_gallery s
      where s.profile_id = p.id and s.revision = p.published_revision and s.item = p_id
    ))
    or (p_name is null and p.owner_id = p_owner and (g.position is not null or exists (
      select 1 from snoozer.published_gallery s where s.profile_id = p.id and s.item = p_id
    )))
  )
$$;

create or replace function public.collect_gallery_garbage() returns integer
language sql security definer set search_path = '' as $$
  with candidates as (
    select g.profile_id, g.id from snoozer.gallery_items g
    where g.position is null and g.created_at < now() - interval '24 hours'
      and not exists (select 1 from snoozer.published_gallery s where s.profile_id = g.profile_id and s.item = g.id)
    order by g.created_at limit 100 for update skip locked
  ), removed as (
    delete from snoozer.gallery_items g using candidates c
    where g.profile_id = c.profile_id and g.id = c.id returning 1
  )
  select count(*)::integer from removed
$$;

create or replace function public.find_orphan_gallery_objects(p_bucket text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(candidate.name), '[]'::jsonb)
  from (
    select o.name from storage.objects o
    join snoozer.profiles p on p.media_scope::text = split_part(o.name, '/', 1)
    where o.bucket_id = p_bucket and o.created_at < now() - interval '24 hours'
      and (
        (p_bucket = 'gallery-incoming' and o.name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.upload$'
          and not exists (select 1 from snoozer.gallery_items g where g.profile_id = p.id and g.variant is null
            and g.id::text || '.upload' = split_part(o.name, '/', 2)))
        or (p_bucket = 'gallery-images' and o.name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$'
          and not exists (select 1 from snoozer.gallery_items g where g.profile_id = p.id
            and g.variant::text || '.webp' = split_part(o.name, '/', 2)))
      )
    order by o.created_at, o.name limit 100
  ) candidate
$$;

create or replace function public.take_down_gallery_image(p_name text, p_id uuid, p_case text) returns text
language plpgsql security definer set search_path = '' as $$
declare profile snoozer.profiles%rowtype;
declare image snoozer.gallery_items%rowtype;
begin
  if p_case is null or p_case !~ '^[a-zA-Z0-9][a-zA-Z0-9._-]{2,79}$' then
    raise exception 'Invalid case reference' using errcode = '22023';
  end if;
  select * into profile from snoozer.profiles where username = p_name for update;
  if not found then return 'not_found'; end if;
  select * into image from snoozer.gallery_items
    where profile_id = profile.id and id = p_id and variant is not null for update;
  if not found then return 'not_found'; end if;
  if image.blocked_at is not null then return 'already_blocked'; end if;
  insert into snoozer.gallery_takedowns(media_scope, item_id, case_reference)
    values (profile.media_scope, p_id, p_case);
  update snoozer.gallery_items set blocked_at = now(), position = null
    where profile_id = profile.id and id = p_id;
  if image.position is not null then
    update snoozer.gallery_items set position = position - 1
      where profile_id = profile.id and position > image.position;
    update snoozer.profiles set revision = revision + 1, updated_at = now() where id = profile.id;
  end if;
  return 'blocked';
end $$;

create or replace function public.get_my_plan() returns jsonb
language sql stable security definer set search_path = '' as $$
  with actor as materialized (select snoozer.verified_user() as id)
  select jsonb_build_object(
    'plan', (e.plan).plan,
    'version', (e.plan).version,
    'quotas', jsonb_build_object(
      'profiles', (e.plan).profiles, 'links', (e.plan).links, 'mediaBytes', (e.plan).media_bytes,
      'domains', (e.plan).domains, 'aliases', (e.plan).aliases,
      'analyticsDays', (e.plan).analytics_days, 'teamSeats', (e.plan).team_seats
    ),
    'capabilities', jsonb_build_object(
      'premiumLayouts', (e.plan).premium_layouts, 'advancedEffects', (e.plan).advanced_effects,
      'scheduledPublishing', (e.plan).scheduled_publishing, 'abTesting', (e.plan).ab_testing,
      'removeBranding', (e.plan).remove_branding, 'advancedSeo', (e.plan).advanced_seo,
      'prioritySupport', (e.plan).priority_support, 'apiAccess', (e.plan).api_access
    ),
    'expiresAt', e.expires_at,
    'usage', jsonb_build_object(
      'publishedProfiles', (select count(*) from snoozer.profiles where owner_id = actor.id and published_revision is not null),
      'draftLinks', (select count(*) from snoozer.links where owner_id = actor.id),
      'mediaBytes', coalesce((select sum(snoozer.retained_media_bytes(media_scope))
        from snoozer.profiles where owner_id = actor.id), 0)
    )
  ) from actor cross join lateral snoozer.effective_plan(actor.id) e
$$;

revoke execute on function snoozer.profile_library_items(uuid),
  public.prepare_gallery_upload_for_profile(uuid,uuid,integer,text,uuid),
  public.commit_gallery_upload(uuid,uuid,integer,uuid,uuid,integer,integer),
  public.discard_gallery_upload(uuid,uuid,integer,uuid),
  public.edit_gallery(uuid,integer,uuid,text),
  public.pending_gallery_upload(uuid),
  public.get_media_folders(uuid),
  public.edit_media_folders_for_profile(uuid,uuid,integer,text,uuid,text,uuid),
  public.add_library_image_to_gallery(uuid,integer,uuid)
from public, anon, authenticated, service_role;
grant execute on function public.prepare_gallery_upload_for_profile(uuid,uuid,integer,text,uuid),
  public.commit_gallery_upload(uuid,uuid,integer,uuid,uuid,integer,integer),
  public.discard_gallery_upload(uuid,uuid,integer,uuid) to service_role;
grant execute on function public.edit_gallery(uuid,integer,uuid,text),
  public.pending_gallery_upload(uuid),
  public.get_media_folders(uuid),
  public.edit_media_folders_for_profile(uuid,uuid,integer,text,uuid,text,uuid),
  public.add_library_image_to_gallery(uuid,integer,uuid) to authenticated;
