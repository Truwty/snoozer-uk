begin;

create or replace function public.get_profile_directory(
  p_query text default '',
  p_category text default null,
  p_tags text[] default array[]::text[],
  p_sort text default 'relevance',
  p_after_score integer default null,
  p_after_timestamp timestamptz default null,
  p_after_username text default null,
  p_limit integer default 24
)
returns table(
  username text,display_name text,bio text,avatar uuid,category text,tags text[],
  has_verified_domain boolean,joined_at timestamptz,rank_score integer
)
language plpgsql stable security definer set search_path = '' as $$
declare q text := lower(btrim(coalesce(p_query,'')));
declare query_terms tsquery;
begin
  if char_length(q)>80 or q ~ '[[:cntrl:]]'
    or (p_category is not null and not snoozer.valid_discovery_category(p_category))
    or not snoozer.valid_discovery_tags(p_tags)
    or p_sort is null or p_sort not in ('relevance','recent','name')
    or p_limit is null or p_limit not between 1 and 25
    or (p_after_username is not null and p_after_username !~ '^[a-z][a-z0-9-]{1,28}[a-z0-9]$') then
    raise exception 'Invalid discovery query' using errcode='22023';
  end if;
  query_terms := case when q='' then null else plainto_tsquery('simple',q) end;

  return query
  with candidates as materialized (
    select p.username,v.display_name,v.bio,v.avatar,d.category,d.tags,
      (snoozer.ready_profile_domain(p.id) is not null) as has_verified_domain,
      coalesce(v.activated_at,v.published_at) as joined_at,
      case
        when q='' then 0
        when lower(p.username)=q then 1000
        when left(lower(p.username),char_length(q))=q then 900
        when lower(v.display_name)=q then 850
        when left(lower(v.display_name),char_length(q))=q then 800
        when strpos(lower(p.username),q)>0 then 700
        when strpos(lower(v.display_name),q)>0 then 600
        when strpos(lower(v.bio),q)>0 then 500
        when query_terms is not null and
          to_tsvector('simple',coalesce(v.display_name,'') || ' ' || coalesce(v.bio,'')) @@ query_terms then 400
        else 0
      end::integer as rank_score
    from snoozer.profiles p
    join snoozer.published_profiles v on v.profile_id=p.id and v.revision=p.published_revision
    join snoozer.profile_discovery_settings d on d.profile_id=p.id and d.directory_enabled
    where p.published_revision is not null and v.activated_at is not null
      and not snoozer.public_profile_blocked(p.id,p.owner_id)
      and (p_category is null or d.category=p_category)
      and (cardinality(p_tags)=0 or d.tags && p_tags)
      and (q='' or lower(p.username)=q or strpos(lower(p.username),q)>0
        or strpos(lower(v.display_name),q)>0 or strpos(lower(v.bio),q)>0
        or (query_terms is not null and
          to_tsvector('simple',coalesce(v.display_name,'') || ' ' || coalesce(v.bio,'')) @@ query_terms))
  )
  select c.username,c.display_name,c.bio,c.avatar,c.category,c.tags,c.has_verified_domain,c.joined_at,c.rank_score
  from candidates c
  where p_after_username is null
    or (p_sort='name' and c.username>p_after_username)
    or (p_sort='recent' and p_after_timestamp is not null and
      (c.joined_at<p_after_timestamp or (c.joined_at=p_after_timestamp and c.username>p_after_username)))
    or (p_sort='relevance' and p_after_score is not null and p_after_timestamp is not null and
      (c.rank_score<p_after_score or (c.rank_score=p_after_score and
        (c.joined_at<p_after_timestamp or (c.joined_at=p_after_timestamp and c.username>p_after_username)))))
  order by case when p_sort='name' then c.username end asc,
    case when p_sort='recent' then c.joined_at end desc,
    case when p_sort='relevance' then c.rank_score end desc,
    c.joined_at desc,c.username asc
  limit p_limit;
end
$$;

create or replace function public.get_related_creators(p_username text,p_limit integer default 6)
returns table(
  username text,display_name text,bio text,avatar uuid,category text,tags text[],
  has_verified_domain boolean,joined_at timestamptz,rank_score integer
)
language plpgsql stable security definer set search_path = '' as $$
declare source_profile uuid;
declare source_category text;
declare source_tags text[];
begin
  if p_username is null or p_username !~ '^[a-z][a-z0-9-]{1,28}[a-z0-9]$'
    or p_limit is null or p_limit not between 1 and 8 then
    raise exception 'Invalid recommendation request' using errcode='22023';
  end if;
  select p.id,d.category,d.tags into source_profile,source_category,source_tags
  from snoozer.profiles p
  join snoozer.profile_discovery_settings d on d.profile_id=p.id
  join snoozer.published_profiles v on v.profile_id=p.id and v.revision=p.published_revision
  where p.username=p_username and d.directory_enabled and d.recommendations_enabled
    and v.activated_at is not null and not snoozer.public_profile_blocked(p.id,p.owner_id);
  if source_profile is null then return; end if;
  return query
    select r.*
    from public.get_profile_directory('',source_category,source_tags,'recent',null,null,null,25) r
    join snoozer.profiles target on target.username=r.username
    join snoozer.profile_discovery_settings settings on settings.profile_id=target.id
    where r.username<>p_username and settings.recommendations_enabled
    order by (r.category=source_category) desc,
      (select count(*) from unnest(r.tags) rt where rt=any(source_tags)) desc,
      r.joined_at desc,r.username
    limit p_limit;
end
$$;

create or replace function public.owner_upsert_discovery_collection(
  p_slug text,p_title text,p_description text,p_published boolean,p_sort_order integer,
  p_starts_at timestamptz,p_expires_at timestamptz,p_usernames text[],p_reason text
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare actor uuid := snoozer.admin_actor(true);
declare v_collection_id uuid;
declare names text[] := coalesce(p_usernames,array[]::text[]);
declare matched integer;
begin
  if p_slug is null or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(p_slug) not between 2 and 48
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
  join snoozer.published_profiles v on v.profile_id=p.id and v.revision=p.published_revision and v.activated_at is not null
  join snoozer.profile_discovery_settings d on d.profile_id=p.id and d.directory_enabled
  where not snoozer.public_profile_blocked(p.id,p.owner_id);
  if matched<>cardinality(names) then
    raise exception 'Every collection profile must be published, discoverable and unrestricted' using errcode='22023';
  end if;

  insert into snoozer.discovery_collections(slug,title,description,published,sort_order,starts_at,expires_at,created_by,updated_by)
  values(p_slug,btrim(p_title),btrim(p_description),p_published,p_sort_order,p_starts_at,p_expires_at,actor,actor)
  on conflict(slug) do update set
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
    jsonb_build_object('slug',p_slug,'published',p_published,'profile_count',cardinality(names)));
  return true;
end
$$;

commit;
