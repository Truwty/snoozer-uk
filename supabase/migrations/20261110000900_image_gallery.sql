alter table snoozer.profiles add column gallery_upload_day date,
  add column gallery_upload_count integer not null default 0;

-- Private buckets: signed writes target only random, single-use staging paths.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('gallery-incoming', 'gallery-incoming', false, 4194304, array['image/jpeg','image/png','image/webp']),
  ('gallery-images', 'gallery-images', false, 1048576, array['image/webp']);

create table snoozer.gallery_items (
  owner_id uuid not null references snoozer.profiles(owner_id) on delete cascade,
  id uuid not null default gen_random_uuid(),
  alt text not null check (char_length(alt) between 1 and 180 and alt ~ '[^[:space:]]'),
  position smallint check (position between 1 and 8),
  variant uuid unique,
  width integer check (width between 1 and 1280),
  height integer check (height between 1 and 1280),
  created_at timestamptz not null default now(),
  processing_at timestamptz,
  primary key (owner_id, id),
  unique (owner_id, position) deferrable initially deferred,
  check ((variant is null and width is null and height is null and position is null)
      or (variant is not null and width is not null and height is not null))
);
create unique index one_pending_gallery_upload on snoozer.gallery_items(owner_id) where variant is null;

create table snoozer.published_gallery (
  owner_id uuid not null,
  revision integer not null,
  position smallint not null check (position between 1 and 8),
  item uuid not null,
  primary key (owner_id, revision, position),
  foreign key (owner_id, revision) references snoozer.published_profiles(owner_id, revision) on delete cascade,
  foreign key (owner_id, item) references snoozer.gallery_items(owner_id, id) deferrable initially deferred
);
create index published_gallery_items on snoozer.published_gallery(owner_id, item);
alter table snoozer.gallery_items enable row level security;
alter table snoozer.published_gallery enable row level security;

create function snoozer.gallery_projection(p_owner uuid, p_revision integer default null) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('gallery', coalesce(jsonb_agg(
    jsonb_build_object('id', g.id, 'alt', g.alt, 'width', g.width, 'height', g.height)
    order by coalesce(s.position, g.position)), '[]'::jsonb))
  from snoozer.gallery_items g
  left join snoozer.published_gallery s
    on s.owner_id = g.owner_id and s.item = g.id and s.revision = p_revision
  where g.owner_id = p_owner and (s.item is not null or (p_revision is null and g.position is not null))
$$;

-- Keep the established profile save and restore behavior inside the same transaction.
alter function public.save_profile(integer,text,text,text,boolean,jsonb,boolean,boolean,jsonb) rename to save_profile_with_sections;
alter function public.save_profile_with_sections(integer,text,text,text,boolean,jsonb,boolean,boolean,jsonb) set schema snoozer;
revoke execute on function snoozer.save_profile_with_sections(integer,text,text,text,boolean,jsonb,boolean,boolean,jsonb) from public, anon, authenticated, service_role;
alter function public.restore_publication(integer,integer) rename to restore_publication_with_sections;
alter function public.restore_publication_with_sections(integer,integer) set schema snoozer;
revoke execute on function snoozer.restore_publication_with_sections(integer,integer) from public, anon, authenticated, service_role;
alter function public.get_draft() rename to get_draft_with_sections;
alter function public.get_draft_with_sections() set schema snoozer;
revoke execute on function snoozer.get_draft_with_sections() from public, anon, authenticated, service_role;
alter function public.get_publication(integer) rename to get_publication_with_sections;
alter function public.get_publication_with_sections(integer) set schema snoozer;
revoke execute on function snoozer.get_publication_with_sections(integer) from public, anon, authenticated, service_role;
alter function public.get_published_profile(text) rename to get_published_profile_with_sections;
alter function public.get_published_profile_with_sections(text) set schema snoozer;
revoke execute on function snoozer.get_published_profile_with_sections(text) from public, anon, authenticated, service_role;

create function public.save_profile(
  p_expected integer, p_name text, p_bio text, p_theme text, p_indexable boolean,
  p_links jsonb, p_publish boolean, p_remove_avatar boolean, p_sections jsonb default null
) returns integer
language plpgsql security definer set search_path = '' as $$
declare actor uuid := snoozer.verified_user();
declare saved integer;
begin
  saved := snoozer.save_profile_with_sections(p_expected, p_name, p_bio, p_theme,
    p_indexable, p_links, p_publish, p_remove_avatar, p_sections);
  if p_publish then
    insert into snoozer.published_gallery(owner_id, revision, position, item)
      select actor, saved, position, id from snoozer.gallery_items where owner_id = actor and position is not null;
  end if;
  return saved;
end $$;

create function public.restore_publication(p_revision integer, p_expected integer) returns void
language plpgsql security definer set search_path = '' as $$
declare actor uuid := snoozer.verified_user();
begin
  perform snoozer.restore_publication_with_sections(p_revision, p_expected);
  update snoozer.gallery_items set position = null where owner_id = actor and position is not null;
  update snoozer.gallery_items g set position = s.position
    from snoozer.published_gallery s
    where g.owner_id = actor and s.owner_id = actor and s.revision = p_revision and g.id = s.item;
end $$;

create function public.get_draft() returns jsonb
language sql stable security definer set search_path = '' as $$
  select snoozer.get_draft_with_sections() || snoozer.gallery_projection(snoozer.verified_user())
$$;
create function public.get_publication(p_revision integer) returns jsonb
language sql stable security definer set search_path = '' as $$
  select snoozer.get_publication_with_sections(p_revision) || snoozer.gallery_projection(snoozer.verified_user(), p_revision)
$$;
create function public.get_published_profile(p_name text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select snoozer.get_published_profile_with_sections(p_name) || snoozer.gallery_projection(owner_id, published_revision)
  from snoozer.profiles where username = p_name and published_revision is not null
$$;

create function public.prepare_gallery_upload(p_owner uuid, p_expected integer, p_alt text, p_id uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare profile snoozer.profiles%rowtype;
declare stage snoozer.gallery_items%rowtype;
declare today date := (now() at time zone 'UTC')::date;
declare issued integer;
begin
  select * into profile from snoozer.profiles where owner_id = p_owner and revision = p_expected for update;
  if not found then return null; end if;
  delete from snoozer.gallery_items where owner_id = p_owner and variant is null and created_at < now() - interval '2 hours';
  select * into stage from snoozer.gallery_items where owner_id = p_owner and variant is null;
  if p_id is not null then
    if stage.id is distinct from p_id or stage.processing_at > now() - interval '20 seconds' then return null; end if;
    update snoozer.gallery_items set processing_at = now() where owner_id = p_owner and id = p_id;
  elsif stage.id is null and p_alt is not null then
    if (select count(*) from snoozer.gallery_items where owner_id = p_owner and position is not null) >= 8 then
      raise exception 'Gallery is full' using errcode = 'P1101';
    end if;
    if (select count(*) from snoozer.gallery_items where owner_id = p_owner) >= 48 then
      raise exception 'Media limit reached' using errcode = 'P1102';
    end if;
    issued := case when profile.gallery_upload_day = today then profile.gallery_upload_count else 0 end;
    if issued >= 12 then
      raise exception 'Upload limit reached' using errcode = 'P1103';
    end if;
    update snoozer.profiles set gallery_upload_day = today, gallery_upload_count = issued + 1 where owner_id = p_owner;
    insert into snoozer.gallery_items(owner_id, alt) values (p_owner, btrim(p_alt)) returning * into stage;
  end if;
  if stage.id is null then return null; end if;
  return jsonb_build_object('scope', profile.media_scope, 'id', stage.id, 'alt', stage.alt);
end $$;

create function public.commit_gallery_upload(p_owner uuid, p_expected integer, p_id uuid, p_variant uuid, p_width integer, p_height integer) returns boolean
language plpgsql security definer set search_path = '' as $$
declare next_position integer;
begin
  perform 1 from snoozer.profiles where owner_id = p_owner and revision = p_expected for update;
  if not found then return false; end if;
  select n into next_position from generate_series(1,8) n where not exists (
    select 1 from snoozer.gallery_items where owner_id = p_owner and position = n
  ) order by n limit 1;
  if next_position is null or p_variant is null or p_width is null or p_height is null then return false; end if;
  update snoozer.gallery_items set position = next_position, variant = p_variant, width = p_width, height = p_height
    where owner_id = p_owner and id = p_id and variant is null and processing_at is not null
      and created_at >= now() - interval '2 hours';
  if not found then return false; end if;
  update snoozer.profiles set revision = revision + 1, updated_at = now() where owner_id = p_owner;
  return true;
end $$;

create function public.discard_gallery_upload(p_owner uuid, p_expected integer, p_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare scope uuid;
begin
  select media_scope into scope from snoozer.profiles where owner_id = p_owner and revision = p_expected for update;
  if not found then return null; end if;
  delete from snoozer.gallery_items where owner_id = p_owner and id = p_id and variant is null;
  if not found then return null; end if;
  return scope;
end $$;

create function public.edit_gallery(p_expected integer, p_id uuid, p_operation text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare actor uuid := snoozer.verified_user();
declare old_position integer;
declare other_position integer;
begin
  perform 1 from snoozer.profiles where owner_id = actor and revision = p_expected for update;
  if not found then return false; end if;
  select position into old_position from snoozer.gallery_items where owner_id = actor and id = p_id and position is not null;
  if not found then return false; end if;
  if p_operation = 'remove' then
    update snoozer.gallery_items set position = null where owner_id = actor and id = p_id;
    update snoozer.gallery_items set position = position - 1 where owner_id = actor and position > old_position;
  elsif p_operation in ('earlier', 'later') then
    other_position := old_position + case when p_operation = 'earlier' then -1 else 1 end;
    if not exists (select 1 from snoozer.gallery_items where owner_id = actor and position = other_position) then return false; end if;
    update snoozer.gallery_items set position = case when id = p_id then other_position else old_position end
      where owner_id = actor and position in (old_position, other_position);
  else
    return false;
  end if;
  update snoozer.profiles set revision = revision + 1, updated_at = now() where owner_id = actor;
  return true;
end $$;

create function public.pending_gallery_upload() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', id, 'alt', alt) from snoozer.gallery_items
  where owner_id = snoozer.verified_user() and variant is null and created_at >= now() - interval '2 hours'
$$;

create function public.gallery_object(p_id uuid, p_name text default null, p_owner uuid default null) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('scope', p.media_scope, 'variant', g.variant)
  from snoozer.profiles p join snoozer.gallery_items g on g.owner_id = p.owner_id and g.id = p_id
  where g.variant is not null and (
    (p_owner is null and p.username = p_name and exists (
      select 1 from snoozer.published_gallery s
      where s.owner_id = p.owner_id and s.revision = p.published_revision and s.item = p_id
    ))
    or (p_name is null and p.owner_id = p_owner and (g.position is not null or exists (
      select 1 from snoozer.published_gallery s where s.owner_id = p.owner_id and s.item = p_id
    )))
  )
$$;

-- Delete registry entries only when unreachable. Physical removal uses the Storage API.
create function public.collect_gallery_garbage() returns integer
language sql security definer set search_path = '' as $$
  with candidates as (
    select g.owner_id, g.id from snoozer.gallery_items g
    where g.position is null and g.created_at < now() - interval '24 hours'
      and not exists (select 1 from snoozer.published_gallery s where s.owner_id = g.owner_id and s.item = g.id)
    order by g.created_at limit 100 for update skip locked
  ), removed as (
    delete from snoozer.gallery_items g using candidates c
    where g.owner_id = c.owner_id and g.id = c.id returning 1
  )
  select count(*)::integer from removed
$$;

create function public.find_orphan_gallery_objects(p_bucket text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(candidate.name), '[]'::jsonb)
  from (
    select o.name from storage.objects o
    join snoozer.profiles p on p.media_scope::text = split_part(o.name, '/', 1)
    where o.bucket_id = p_bucket and o.created_at < now() - interval '24 hours'
      and (
        (p_bucket = 'gallery-incoming' and o.name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.upload$'
          and not exists (select 1 from snoozer.gallery_items g where g.owner_id = p.owner_id and g.variant is null
            and g.id::text || '.upload' = split_part(o.name, '/', 2)))
        or (p_bucket = 'gallery-images' and o.name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$'
          and not exists (select 1 from snoozer.gallery_items g where g.owner_id = p.owner_id
            and g.variant::text || '.webp' = split_part(o.name, '/', 2)))
      )
    order by o.created_at, o.name limit 100
  ) candidate
$$;

revoke execute on function snoozer.gallery_projection(uuid,integer) from public, anon, authenticated, service_role;
revoke execute on function public.save_profile(integer,text,text,text,boolean,jsonb,boolean,boolean,jsonb),
  public.restore_publication(integer,integer),
  public.get_draft(),
  public.get_publication(integer),
  public.pending_gallery_upload(),
  public.edit_gallery(integer,uuid,text) from public, anon, authenticated, service_role;
grant execute on function public.save_profile(integer,text,text,text,boolean,jsonb,boolean,boolean,jsonb),
  public.restore_publication(integer,integer),
  public.get_draft(),
  public.get_publication(integer),
  public.pending_gallery_upload(),
  public.edit_gallery(integer,uuid,text) to authenticated;
revoke execute on function public.get_published_profile(text) from public, anon, authenticated, service_role;
grant execute on function public.get_published_profile(text) to anon, authenticated;
revoke execute on function public.prepare_gallery_upload(uuid,integer,text,uuid),
  public.commit_gallery_upload(uuid,integer,uuid,uuid,integer,integer),
  public.discard_gallery_upload(uuid,integer,uuid),
  public.gallery_object(uuid,text,uuid),
  public.collect_gallery_garbage(),
  public.find_orphan_gallery_objects(text) from public, anon, authenticated, service_role;
grant execute on function public.prepare_gallery_upload(uuid,integer,text,uuid),
  public.commit_gallery_upload(uuid,integer,uuid,uuid,integer,integer),
  public.discard_gallery_upload(uuid,integer,uuid),
  public.gallery_object(uuid,text,uuid),
  public.collect_gallery_garbage(),
  public.find_orphan_gallery_objects(text) to service_role;
