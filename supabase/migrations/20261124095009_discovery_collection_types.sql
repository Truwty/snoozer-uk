begin;

alter table snoozer.discovery_collections
  add column collection_type text not null default 'collection'
  check (collection_type in ('featured','spotlight','collection'));

create index discovery_collections_type_order
  on snoozer.discovery_collections(collection_type,sort_order,created_at desc)
  where published;

create or replace function public.get_public_discovery_collections(
  p_limit integer default 8,p_request_fingerprint text default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform snoozer.consume_discovery_request(p_request_fingerprint);
  if p_limit is null or p_limit not between 1 and 20 then
    raise exception 'Invalid collection limit' using errcode='22023';
  end if;

  return coalesce((
    select jsonb_agg(to_jsonb(item) order by
      case item.collection_type when 'featured' then 1 when 'spotlight' then 2 else 3 end,
      item.sort_order,item.created_at desc)
    from (
      select c.slug,c.collection_type,c.title,c.description,c.sort_order,c.created_at,
        coalesce((
          select jsonb_agg(jsonb_build_object(
            'username',p.username,'display_name',v.display_name,'bio',v.bio,'avatar',v.avatar,
            'category',d.category,'tags',d.tags,
            'has_verified_domain',snoozer.ready_profile_domain(p.id) is not null
          ) order by cp.position)
          from snoozer.discovery_collection_profiles cp
          join snoozer.profiles p on p.id=cp.profile_id
          join snoozer.published_profiles v
            on v.profile_id=p.id and v.revision=p.published_revision and v.activated_at is not null
          join snoozer.profile_discovery_settings d
            on d.profile_id=p.id and d.directory_enabled
          where cp.collection_id=c.id and p.published_revision is not null
            and not snoozer.public_profile_blocked(p.id,p.owner_id)
        ),'[]'::jsonb) as profiles
      from snoozer.discovery_collections c
      where c.published and (c.starts_at is null or c.starts_at<=now())
        and (c.expires_at is null or c.expires_at>now())
        and exists (
          select 1
          from snoozer.discovery_collection_profiles cp
          join snoozer.profiles p on p.id=cp.profile_id
          join snoozer.published_profiles v
            on v.profile_id=p.id and v.revision=p.published_revision and v.activated_at is not null
          join snoozer.profile_discovery_settings d
            on d.profile_id=p.id and d.directory_enabled
          where cp.collection_id=c.id and p.published_revision is not null
            and not snoozer.public_profile_blocked(p.id,p.owner_id)
        )
      order by case c.collection_type when 'featured' then 1 when 'spotlight' then 2 else 3 end,
        c.sort_order,c.created_at desc
      limit p_limit
    ) item
  ),'[]'::jsonb);
end
$$;

create or replace function public.owner_discovery_collections()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := snoozer.admin_actor();
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'slug',c.slug,'collection_type',c.collection_type,'title',c.title,
      'description',c.description,'published',c.published,
      'sort_order',c.sort_order,'starts_at',c.starts_at,'expires_at',c.expires_at,
      'profiles',coalesce((
        select jsonb_agg(p.username order by cp.position)
        from snoozer.discovery_collection_profiles cp
        join snoozer.profiles p on p.id=cp.profile_id
        where cp.collection_id=c.id
      ),'[]'::jsonb)
    ) order by case c.collection_type when 'featured' then 1 when 'spotlight' then 2 else 3 end,
      c.sort_order,c.created_at desc)
    from snoozer.discovery_collections c
  ),'[]'::jsonb);
end
$$;

create function public.owner_upsert_discovery_collection(
  p_slug text,p_collection_type text,p_title text,p_description text,p_published boolean,
  p_sort_order integer,p_starts_at timestamptz,p_expires_at timestamptz,
  p_usernames text[],p_reason text
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare actor uuid := snoozer.admin_actor(true);
declare v_collection_id uuid;
declare names text[] := coalesce(p_usernames,array[]::text[]);
declare matched integer;
begin
  if p_slug is null or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(p_slug) not between 2 and 48
    or p_collection_type is null or p_collection_type not in ('featured','spotlight','collection')
    or length(btrim(coalesce(p_title,''))) not between 2 and 72
    or length(coalesce(p_description,''))>280 or p_published is null
    or p_sort_order is null or p_sort_order not between 0 and 10000
    or cardinality(names)>20 or cardinality(names)<>(select count(distinct n) from unnest(names) n)
    or length(btrim(coalesce(p_reason,''))) not between 8 and 500
    or (p_expires_at is not null and p_starts_at is not null and p_expires_at<=p_starts_at) then
    raise exception 'Invalid discovery collection' using errcode='22023';
  end if;

  select count(*) into matched
  from unnest(names) requested(username)
  join snoozer.profiles p on p.username=requested.username and p.published_revision is not null
  join snoozer.published_profiles v
    on v.profile_id=p.id and v.revision=p.published_revision and v.activated_at is not null
  join snoozer.profile_discovery_settings d
    on d.profile_id=p.id and d.directory_enabled
  where not snoozer.public_profile_blocked(p.id,p.owner_id);
  if matched<>cardinality(names) then
    raise exception 'Every collection profile must be published, discoverable and unrestricted' using errcode='22023';
  end if;

  insert into snoozer.discovery_collections(
    slug,collection_type,title,description,published,sort_order,starts_at,expires_at,created_by,updated_by
  ) values (
    p_slug,p_collection_type,btrim(p_title),btrim(p_description),p_published,p_sort_order,
    p_starts_at,p_expires_at,actor,actor
  )
  on conflict(slug) do update set
    collection_type=excluded.collection_type,
    title=excluded.title,description=excluded.description,published=excluded.published,
    sort_order=excluded.sort_order,starts_at=excluded.starts_at,expires_at=excluded.expires_at,
    updated_by=actor,updated_at=now()
  returning id into v_collection_id;

  delete from snoozer.discovery_collection_profiles cp where cp.collection_id=v_collection_id;
  insert into snoozer.discovery_collection_profiles(collection_id,profile_id,position)
  select v_collection_id,p.id,requested.position::integer
  from unnest(names) with ordinality requested(username,position)
  join snoozer.profiles p on p.username=requested.username
  order by requested.position;

  insert into snoozer.admin_audit_events(actor_id,action,reason,details)
  values(actor,'discovery.collection.upsert',p_reason,
    jsonb_build_object('slug',p_slug,'type',p_collection_type,'published',p_published,'profile_count',cardinality(names)));
  return true;
end
$$;

revoke all on function public.owner_upsert_discovery_collection(
  text,text,text,boolean,integer,timestamptz,timestamptz,text[],text
) from public,anon,authenticated,service_role;
revoke all on function public.owner_upsert_discovery_collection(
  text,text,text,text,boolean,integer,timestamptz,timestamptz,text[],text
) from public,anon,authenticated,service_role;
grant execute on function public.owner_upsert_discovery_collection(
  text,text,text,text,boolean,integer,timestamptz,timestamptz,text[],text
) to authenticated;


-- Fetch a single collection directly. The public shelf is intentionally capped
-- at 20 entries, but a valid collection must remain reachable by its own URL.
create or replace function public.get_public_discovery_collection(
  p_slug text,p_request_fingerprint text default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform snoozer.consume_discovery_request(p_request_fingerprint);
  if p_slug is null or length(p_slug)>48 or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'Invalid collection slug' using errcode='22023';
  end if;

  return (
    select jsonb_build_object(
      'slug',c.slug,
      'collection_type',c.collection_type,
      'title',c.title,
      'description',c.description,
      'sort_order',c.sort_order,
      'created_at',c.created_at,
      'profiles',coalesce((
        select jsonb_agg(jsonb_build_object(
          'username',p.username,
          'display_name',v.display_name,
          'bio',v.bio,
          'avatar',v.avatar,
          'category',d.category,
          'tags',d.tags,
          'has_verified_domain',snoozer.ready_profile_domain(p.id) is not null
        ) order by cp.position)
        from snoozer.discovery_collection_profiles cp
        join snoozer.profiles p on p.id=cp.profile_id
        join snoozer.published_profiles v
          on v.profile_id=p.id and v.revision=p.published_revision and v.activated_at is not null
        join snoozer.profile_discovery_settings d
          on d.profile_id=p.id and d.directory_enabled
        where cp.collection_id=c.id and p.published_revision is not null
          and not snoozer.public_profile_blocked(p.id,p.owner_id)
      ),'[]'::jsonb)
    )
    from snoozer.discovery_collections c
    where c.slug=p_slug and c.published
      and (c.starts_at is null or c.starts_at<=now())
      and (c.expires_at is null or c.expires_at>now())
      and exists (
        select 1
        from snoozer.discovery_collection_profiles cp
        join snoozer.profiles p on p.id=cp.profile_id
        join snoozer.published_profiles v
          on v.profile_id=p.id and v.revision=p.published_revision and v.activated_at is not null
        join snoozer.profile_discovery_settings d
          on d.profile_id=p.id and d.directory_enabled
        where cp.collection_id=c.id and p.published_revision is not null
          and not snoozer.public_profile_blocked(p.id,p.owner_id)
      )
  );
end
$$;

-- This SECURITY DEFINER reader must only be reachable through the trusted
-- server client, which supplies the HMAC generated from the ingress address.
revoke all on function public.get_public_discovery_collection(text,text)
  from public,anon,authenticated,service_role;
grant execute on function public.get_public_discovery_collection(text,text) to service_role;

commit;
