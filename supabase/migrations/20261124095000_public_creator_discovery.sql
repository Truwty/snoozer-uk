begin;

-- Public Creator Discovery. Existing publication snapshots remain authoritative;
-- directory preferences are separate from search-engine indexing and drafts.
create table snoozer.profile_discovery_settings (
  profile_id uuid primary key references snoozer.profiles(id) on delete cascade,
  directory_enabled boolean not null default false,
  leaderboard_enabled boolean,
  recommendations_enabled boolean not null default false,
  category text not null default 'other'
    check (category in ('developers','designers','artists','content-creators','gamers','streamers','musicians','businesses','communities','other')),
  tags text[] not null default array[]::text[],
  updated_at timestamptz not null default now(),
  check (cardinality(tags) <= 5)
);

create table snoozer.discovery_collections (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) between 2 and 48),
  title text not null check (length(btrim(title)) between 2 and 72),
  description text not null default '' check (length(description) <= 280),
  published boolean not null default false,
  sort_order integer not null default 0 check (sort_order between 0 and 10000),
  starts_at timestamptz,
  expires_at timestamptz,
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at is null or starts_at is null or expires_at > starts_at)
);

create table snoozer.discovery_collection_profiles (
  collection_id uuid not null references snoozer.discovery_collections(id) on delete cascade,
  profile_id uuid not null references snoozer.profiles(id) on delete cascade,
  position integer not null check (position between 1 and 20),
  added_at timestamptz not null default now(),
  primary key (collection_id, profile_id),
  unique (collection_id, position)
);

create index profile_discovery_directory_category
  on snoozer.profile_discovery_settings(category, profile_id)
  where directory_enabled;
create index profile_discovery_directory_tags
  on snoozer.profile_discovery_settings using gin(tags)
  where directory_enabled;
create index discovery_collections_public_order
  on snoozer.discovery_collections(sort_order, created_at desc)
  where published;
create index discovery_collection_profiles_order
  on snoozer.discovery_collection_profiles(collection_id, position);
create index published_profiles_discovery_search
  on snoozer.published_profiles using gin (
    to_tsvector('simple', coalesce(display_name, '') || ' ' || coalesce(bio, ''))
  );

alter table snoozer.profile_discovery_settings enable row level security;
alter table snoozer.discovery_collections enable row level security;
alter table snoozer.discovery_collection_profiles enable row level security;
revoke all on snoozer.profile_discovery_settings,snoozer.discovery_collections,
  snoozer.discovery_collection_profiles from public,anon,authenticated,service_role;

-- A NULL leaderboard preference means "follow the existing indexable setting".
-- This preserves existing participation until a creator makes an explicit choice.
insert into snoozer.profile_discovery_settings(profile_id, leaderboard_enabled, category)
select p.id, null, 'other'
from snoozer.profiles p
on conflict (profile_id) do nothing;

create function snoozer.valid_discovery_category(p_category text) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(p_category in (
    'developers','designers','artists','content-creators','gamers',
    'streamers','musicians','businesses','communities','other'
  ), false)
$$;

create function snoozer.valid_discovery_tags(p_tags text[]) returns boolean
language plpgsql immutable set search_path = '' as $$
declare allowed text[] := array[
  'web-development','software','roblox','gaming','ui-ux','graphic-design',
  'illustration','photography','video','streaming','music','writing',
  'technology','entrepreneurship','education','community','open-source',
  '3d-art','animation','marketing','fashion','fitness','podcasts','indie'
];
begin
  if p_tags is null or cardinality(p_tags) > 5 then return false; end if;
  if cardinality(p_tags) = 0 then return true; end if;
  if exists(select 1 from unnest(p_tags) t where t is null or not (t = any(allowed))) then
    return false;
  end if;
  return cardinality(p_tags) = (select count(distinct t) from unnest(p_tags) t);
end
$$;
revoke all on function snoozer.valid_discovery_category(text),
  snoozer.valid_discovery_tags(text[]) from public,anon,authenticated,service_role;

create function public.get_my_discovery_settings(p_profile uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := snoozer.verified_user();
begin
  return (
    select jsonb_build_object(
      'profile_id', p.id,
      'directory_enabled', coalesce(d.directory_enabled, false),
      'leaderboard_enabled', coalesce(d.leaderboard_enabled, p.indexable),
      'recommendations_enabled', coalesce(d.recommendations_enabled, false),
      'category', coalesce(d.category, 'other'),
      'tags', coalesce(to_jsonb(d.tags), '[]'::jsonb),
      'published', p.published_revision is not null
    )
    from snoozer.profiles p
    left join snoozer.profile_discovery_settings d on d.profile_id = p.id
    where p.id = p_profile and p.owner_id = actor
  );
end
$$;

create function public.set_profile_discovery_settings(
  p_profile uuid,
  p_directory_enabled boolean,
  p_leaderboard_enabled boolean,
  p_recommendations_enabled boolean,
  p_category text,
  p_tags text[]
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare actor uuid := snoozer.verified_user();
begin
  if p_directory_enabled is null or p_leaderboard_enabled is null
    or p_recommendations_enabled is null
    or not snoozer.valid_discovery_category(p_category)
    or not snoozer.valid_discovery_tags(p_tags) then
    raise exception 'Invalid discovery settings' using errcode = '22023';
  end if;

  insert into snoozer.profile_discovery_settings(
    profile_id,directory_enabled,leaderboard_enabled,recommendations_enabled,category,tags,updated_at
  )
  select p.id,p_directory_enabled,p_leaderboard_enabled,
    p_recommendations_enabled,p_category,p_tags,now()
  from snoozer.profiles p
  where p.id = p_profile and p.owner_id = actor
  on conflict(profile_id) do update set
    directory_enabled = excluded.directory_enabled,
    leaderboard_enabled = excluded.leaderboard_enabled,
    recommendations_enabled = excluded.recommendations_enabled,
    category = excluded.category,
    tags = excluded.tags,
    updated_at = now();

  if not found then
    raise exception 'Profile not found' using errcode = '42501';
  end if;
  return true;
end
$$;

create function public.get_profile_directory(
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
  username text,
  display_name text,
  bio text,
  avatar uuid,
  category text,
  tags text[],
  has_verified_domain boolean,
  joined_at timestamptz,
  rank_score integer
)
language plpgsql stable security definer set search_path = '' as $$
declare q text := lower(btrim(coalesce(p_query,'')));
declare query_terms tsquery;
begin
  if char_length(q) > 80 or q ~ '[[:cntrl:]]'
    or (p_category is not null and not snoozer.valid_discovery_category(p_category))
    or not snoozer.valid_discovery_tags(p_tags)
    or p_sort not in ('relevance','recent','name')
    or p_limit is null or p_limit not between 1 and 24
    or (p_after_username is not null and p_after_username !~ '^[a-z][a-z0-9-]{1,28}[a-z0-9]$') then
    raise exception 'Invalid discovery query' using errcode = '22023';
  end if;
  query_terms := case when q = '' then null else plainto_tsquery('simple', q) end;

  return query
  with candidates as materialized (
    select p.username,v.display_name,v.bio,v.avatar,
      d.category,d.tags,
      (snoozer.ready_profile_domain(p.id) is not null) as has_verified_domain,
      coalesce(v.activated_at,v.published_at) as joined_at,
      case
        when q = '' then 0
        when lower(p.username) = q then 1000
        when left(lower(p.username),char_length(q)) = q then 900
        when lower(v.display_name) = q then 850
        when left(lower(v.display_name),char_length(q)) = q then 800
        when strpos(lower(p.username),q) > 0 then 700
        when strpos(lower(v.display_name),q) > 0 then 600
        when strpos(lower(v.bio),q) > 0 then 500
        when query_terms is not null and
          to_tsvector('simple',coalesce(v.display_name,'') || ' ' || coalesce(v.bio,'')) @@ query_terms then 400
        else 0
      end::integer as rank_score
    from snoozer.profiles p
    join snoozer.published_profiles v
      on v.profile_id = p.id and v.revision = p.published_revision
    join snoozer.profile_discovery_settings d
      on d.profile_id = p.id and d.directory_enabled
    where p.published_revision is not null
      and v.activated_at is not null
      and not snoozer.public_profile_blocked(p.id,p.owner_id)
      and (p_category is null or d.category = p_category)
      and (cardinality(p_tags) = 0 or d.tags && p_tags)
      and (q = ''
        or lower(p.username) = q
        or strpos(lower(p.username),q) > 0
        or strpos(lower(v.display_name),q) > 0
        or strpos(lower(v.bio),q) > 0
        or (query_terms is not null and
          to_tsvector('simple',coalesce(v.display_name,'') || ' ' || coalesce(v.bio,'')) @@ query_terms))
  )
  select c.username,c.display_name,c.bio,c.avatar,c.category,c.tags,
    c.has_verified_domain,c.joined_at,c.rank_score
  from candidates c
  where p_after_username is null
    or (p_sort = 'name' and c.username > p_after_username)
    or (p_sort = 'recent' and p_after_timestamp is not null and
      (c.joined_at < p_after_timestamp or (c.joined_at = p_after_timestamp and c.username > p_after_username)))
    or (p_sort = 'relevance' and p_after_score is not null and p_after_timestamp is not null and
      (c.rank_score < p_after_score or
       (c.rank_score = p_after_score and
         (c.joined_at < p_after_timestamp or (c.joined_at = p_after_timestamp and c.username > p_after_username)))))
  order by
    case when p_sort = 'name' then c.username end asc,
    case when p_sort = 'recent' then c.joined_at end desc,
    case when p_sort = 'relevance' then c.rank_score end desc,
    c.joined_at desc,c.username asc
  limit p_limit;
end
$$;

create function public.get_related_creators(p_username text,p_limit integer default 6)
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
    raise exception 'Invalid recommendation request' using errcode = '22023';
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
    from public.get_profile_directory('',source_category,source_tags,'recent',null,null,null,24) r
    join snoozer.profiles target on target.username=r.username
    join snoozer.profile_discovery_settings settings on settings.profile_id=target.id
    where r.username <> p_username and settings.recommendations_enabled
    order by (r.category=source_category) desc,
      cardinality(r.tags & source_tags) desc,r.joined_at desc,r.username
    limit p_limit;
end
$$;

create function public.get_public_discovery_collections(p_limit integer default 8)
returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(to_jsonb(item) order by item.sort_order,item.created_at desc),'[]'::jsonb)
  from (
    select c.slug,c.title,c.description,c.sort_order,c.created_at,
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'username',p.username,'display_name',v.display_name,'bio',v.bio,'avatar',v.avatar,
          'category',d.category,'tags',d.tags,
          'has_verified_domain',snoozer.ready_profile_domain(p.id) is not null
        ) order by cp.position)
        from snoozer.discovery_collection_profiles cp
        join snoozer.profiles p on p.id=cp.profile_id
        join snoozer.published_profiles v on v.profile_id=p.id and v.revision=p.published_revision
        join snoozer.profile_discovery_settings d on d.profile_id=p.id and d.directory_enabled
        where cp.collection_id=c.id and p.published_revision is not null
          and v.activated_at is not null and not snoozer.public_profile_blocked(p.id,p.owner_id)
      ),'[]'::jsonb) as profiles
    from snoozer.discovery_collections c
    where c.published and (c.starts_at is null or c.starts_at<=now())
      and (c.expires_at is null or c.expires_at>now())
      and exists (
        select 1 from snoozer.discovery_collection_profiles cp
        join snoozer.profiles p on p.id=cp.profile_id
        join snoozer.profile_discovery_settings d on d.profile_id=p.id and d.directory_enabled
        where cp.collection_id=c.id and p.published_revision is not null
          and not snoozer.public_profile_blocked(p.id,p.owner_id)
      )
    order by c.sort_order,c.created_at desc
    limit least(greatest(coalesce(p_limit,8),1),20)
  ) item
$$;

create function public.get_public_discovery_collection(p_slug text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select item from jsonb_array_elements(public.get_public_discovery_collections(20)) item
  where item->>'slug'=p_slug
  limit 1
$$;

create function public.owner_discovery_collections()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := snoozer.admin_actor();
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'slug',c.slug,'title',c.title,'description',c.description,'published',c.published,
      'sort_order',c.sort_order,'starts_at',c.starts_at,'expires_at',c.expires_at,
      'profiles',coalesce((
        select jsonb_agg(p.username order by cp.position)
        from snoozer.discovery_collection_profiles cp
        join snoozer.profiles p on p.id=cp.profile_id
        where cp.collection_id=c.id
      ),'[]'::jsonb)
    ) order by c.sort_order,c.created_at desc)
    from snoozer.discovery_collections c
  ),'[]'::jsonb);
end
$$;

create function public.owner_upsert_discovery_collection(
  p_slug text,p_title text,p_description text,p_published boolean,p_sort_order integer,
  p_starts_at timestamptz,p_expires_at timestamptz,p_usernames text[],p_reason text
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare actor uuid := snoozer.admin_actor(true);
declare collection_id uuid;
declare names text[] := coalesce(p_usernames,array[]::text[]);
declare matched integer;
begin
  if p_slug is null or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(p_slug) not between 2 and 48
    or length(btrim(coalesce(p_title,''))) not between 2 and 72
    or length(coalesce(p_description,''))>280
    or p_published is null or p_sort_order is null or p_sort_order not between 0 and 10000
    or cardinality(names)>20 or cardinality(names)<>(select count(distinct n) from unnest(names) n)
    or length(btrim(coalesce(p_reason,''))) not between 8 and 500
    or (p_expires_at is not null and p_starts_at is not null and p_expires_at<=p_starts_at) then
    raise exception 'Invalid discovery collection' using errcode = '22023';
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

  insert into snoozer.discovery_collections(
    slug,title,description,published,sort_order,starts_at,expires_at,created_by,updated_by
  ) values (
    p_slug,btrim(p_title),btrim(p_description),p_published,p_sort_order,p_starts_at,p_expires_at,actor,actor
  )
  on conflict(slug) do update set
    title=excluded.title,description=excluded.description,published=excluded.published,
    sort_order=excluded.sort_order,starts_at=excluded.starts_at,expires_at=excluded.expires_at,
    updated_by=actor,updated_at=now()
  returning id into collection_id;

  delete from snoozer.discovery_collection_profiles where collection_id=collection_id;
  insert into snoozer.discovery_collection_profiles(collection_id,profile_id,position)
  select collection_id,p.id,requested.position::integer
  from unnest(names) with ordinality requested(username,position)
  join snoozer.profiles p on p.username=requested.username
  order by requested.position;

  insert into snoozer.admin_audit_events(actor_id,action,reason,details)
  values(actor,'discovery.collection.upsert',p_reason,
    jsonb_build_object('slug',p_slug,'published',p_published,'profile_count',cardinality(names)));
  return true;
end
$$;

create function public.owner_delete_discovery_collection(p_slug text,p_reason text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare actor uuid := snoozer.admin_actor(true);
begin
  if p_slug is null or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    or length(btrim(coalesce(p_reason,''))) not between 8 and 500 then
    raise exception 'Invalid collection removal' using errcode='22023';
  end if;
  delete from snoozer.discovery_collections where slug=p_slug;
  if not found then return false; end if;
  insert into snoozer.admin_audit_events(actor_id,action,reason,details)
  values(actor,'discovery.collection.delete',p_reason,jsonb_build_object('slug',p_slug));
  return true;
end
$$;

-- Leaderboard visibility is now independently controllable. NULL preserves the
-- historic indexable preference; explicit creator choices override it.
create or replace function public.get_views_leaderboard(p_period text default 'all')
returns table(username text, display_name text, avatar text, views bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_period is null or p_period not in ('all','month') then
    raise exception 'Invalid leaderboard period' using errcode='22023';
  end if;
  return query
    select p.username,v.display_name,v.avatar::text,
      case when p_period='month' then t.month_views else t.total_views end
    from snoozer.profile_view_leaderboard t
    join snoozer.profiles p on p.id=t.profile_id
    join snoozer.published_profiles v on v.profile_id=p.id and v.revision=p.published_revision
    left join snoozer.profile_discovery_settings d on d.profile_id=p.id
    where p.published_revision is not null and v.activated_at is not null
      and coalesce(d.leaderboard_enabled,v.indexable)
      and not snoozer.public_profile_blocked(p.id,p.owner_id)
      and (case when p_period='month'
        then t.month_start=date_trunc('month',now() at time zone 'UTC')::date and t.month_views>0
        else t.total_views>0 end)
    order by 4 desc,p.username asc limit 50;
end
$$;

do $$
declare name text; args text;
begin
  for name,args in
    select p.proname,pg_get_function_identity_arguments(p.oid)
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in (
      'get_my_discovery_settings','set_profile_discovery_settings','get_profile_directory',
      'get_related_creators','get_public_discovery_collections','get_public_discovery_collection',
      'owner_discovery_collections','owner_upsert_discovery_collection',
      'owner_delete_discovery_collection','get_views_leaderboard'
    )
  loop
    execute format('revoke all on function public.%I(%s) from public,anon,authenticated,service_role',name,args);
    if name in ('get_profile_directory','get_public_discovery_collections','get_public_discovery_collection','get_related_creators','get_views_leaderboard') then
      execute format('grant execute on function public.%I(%s) to anon,authenticated',name,args);
    else
      execute format('grant execute on function public.%I(%s) to authenticated',name,args);
    end if;
  end loop;
end
$$;

commit;
