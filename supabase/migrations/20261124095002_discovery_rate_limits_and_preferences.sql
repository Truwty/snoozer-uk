begin;

-- Public discovery reads are served by the Snoozer server, not by the public
-- Supabase anon key. This keeps database RPCs private and permits bounded,
-- short-lived per-network abuse controls without retaining raw IP addresses.
create table snoozer.discovery_request_windows (
  request_hash text primary key check (request_hash ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz not null,
  request_count integer not null check (request_count between 1 and 10000)
);
alter table snoozer.discovery_request_windows enable row level security;
revoke all on snoozer.discovery_request_windows from public,anon,authenticated,service_role;

create function snoozer.consume_discovery_request(p_request_hash text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare current_count integer;
begin
  if p_request_hash is null or p_request_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Discovery request identity required' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('discovery-request:' || p_request_hash,0));
  insert into snoozer.discovery_request_windows(request_hash,window_started_at,request_count)
  values(p_request_hash,now(),1)
  on conflict(request_hash) do update set
    window_started_at=case
      when snoozer.discovery_request_windows.window_started_at <= now()-interval '1 minute' then now()
      else snoozer.discovery_request_windows.window_started_at end,
    request_count=case
      when snoozer.discovery_request_windows.window_started_at <= now()-interval '1 minute' then 1
      else snoozer.discovery_request_windows.request_count+1 end
  returning request_count into current_count;

  if current_count>60 then
    raise exception 'Too many discovery requests. Try again shortly.' using errcode='42901';
  end if;
  delete from snoozer.discovery_request_windows where window_started_at<now()-interval '2 hours';
  return true;
end
$$;
revoke all on function snoozer.consume_discovery_request(text) from public,anon,authenticated,service_role;

create or replace function public.get_my_discovery_settings(p_profile uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := snoozer.verified_user();
begin
  return (
    select jsonb_build_object(
      'profile_id',p.id,
      'directory_enabled',coalesce(d.directory_enabled,false),
      'leaderboard_enabled',coalesce(d.leaderboard_enabled,coalesce(v.indexable,p.indexable)),
      'recommendations_enabled',coalesce(d.recommendations_enabled,false),
      'category',coalesce(d.category,'other'),
      'tags',coalesce(to_jsonb(d.tags),'[]'::jsonb),
      'published',p.published_revision is not null
    )
    from snoozer.profiles p
    left join snoozer.published_profiles v on v.profile_id=p.id and v.revision=p.published_revision
    left join snoozer.profile_discovery_settings d on d.profile_id=p.id
    where p.id=p_profile and p.owner_id=actor
  );
end
$$;

create or replace function public.get_profile_directory(
  p_query text default '',
  p_category text default null,
  p_tags text[] default array[]::text[],
  p_sort text default 'relevance',
  p_after_score integer default null,
  p_after_timestamp timestamptz default null,
  p_after_username text default null,
  p_limit integer default 24,
  p_request_fingerprint text default null
)
returns table(
  username text,display_name text,bio text,avatar uuid,category text,tags text[],
  has_verified_domain boolean,joined_at timestamptz,rank_score integer
)
language plpgsql security definer set search_path = '' as $$
declare q text:=lower(btrim(coalesce(p_query,'')));
declare query_terms tsquery;
begin
  perform snoozer.consume_discovery_request(p_request_fingerprint);
  if char_length(q)>80 or q ~ '[[:cntrl:]]'
    or (p_category is not null and not snoozer.valid_discovery_category(p_category))
    or not snoozer.valid_discovery_tags(p_tags)
    or p_sort is null or p_sort not in ('relevance','recent','name')
    or p_limit is null or p_limit not between 1 and 25
    or (p_after_username is not null and p_after_username !~ '^[a-z][a-z0-9-]{1,28}[a-z0-9]$')
    or (p_after_username is not null and p_sort='relevance' and (p_after_score is null or p_after_timestamp is null))
    or (p_after_username is not null and p_sort='recent' and p_after_timestamp is null) then
    raise exception 'Invalid discovery query' using errcode='22023';
  end if;
  query_terms:=case when q='' then null else plainto_tsquery('simple',q) end;
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
        when query_terms is not null and to_tsvector('simple',coalesce(v.display_name,'')||' '||coalesce(v.bio,'')) @@ query_terms then 400
        else 0 end::integer as rank_score
    from snoozer.profiles p
    join snoozer.published_profiles v on v.profile_id=p.id and v.revision=p.published_revision
    join snoozer.profile_discovery_settings d on d.profile_id=p.id and d.directory_enabled
    where p.published_revision is not null and v.activated_at is not null
      and not snoozer.public_profile_blocked(p.id,p.owner_id)
      and (p_category is null or d.category=p_category)
      and (cardinality(p_tags)=0 or d.tags && p_tags)
      and (q='' or lower(p.username)=q or strpos(lower(p.username),q)>0
        or strpos(lower(v.display_name),q)>0 or strpos(lower(v.bio),q)>0
        or (query_terms is not null and to_tsvector('simple',coalesce(v.display_name,'')||' '||coalesce(v.bio,'')) @@ query_terms))
  )
  select c.username,c.display_name,c.bio,c.avatar,c.category,c.tags,c.has_verified_domain,c.joined_at,c.rank_score
  from candidates c
  where p_after_username is null
    or (p_sort='name' and c.username>p_after_username)
    or (p_sort='recent' and (c.joined_at<p_after_timestamp or (c.joined_at=p_after_timestamp and c.username>p_after_username)))
    or (p_sort='relevance' and (c.rank_score<p_after_score or (c.rank_score=p_after_score and
      (c.joined_at<p_after_timestamp or (c.joined_at=p_after_timestamp and c.username>p_after_username)))))
  order by case when p_sort='name' then c.username end asc,
    case when p_sort='recent' then c.joined_at end desc,
    case when p_sort='relevance' then c.rank_score end desc,
    c.joined_at desc,c.username asc
  limit p_limit;
end
$$;

create or replace function public.get_related_creators(
  p_username text,p_limit integer default 6,p_request_fingerprint text default null
)
returns table(
  username text,display_name text,bio text,avatar uuid,category text,tags text[],
  has_verified_domain boolean,joined_at timestamptz,rank_score integer
)
language plpgsql security definer set search_path = '' as $$
declare source_profile uuid;
declare source_category text;
declare source_tags text[];
begin
  perform snoozer.consume_discovery_request(p_request_fingerprint);
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
    from public.get_profile_directory('',source_category,source_tags,'recent',null,null,null,25,p_request_fingerprint) r
    join snoozer.profiles target on target.username=r.username
    join snoozer.profile_discovery_settings settings on settings.profile_id=target.id
    where r.username<>p_username and settings.recommendations_enabled
    order by (r.category=source_category) desc,
      (select count(*) from unnest(r.tags) rt where rt=any(source_tags)) desc,
      r.joined_at desc,r.username
    limit p_limit;
end
$$;

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
    select jsonb_agg(to_jsonb(item) order by item.sort_order,item.created_at desc)
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
      limit p_limit
    ) item
  ),'[]'::jsonb);
end
$$;

create or replace function public.get_public_discovery_collection(
  p_slug text,p_request_fingerprint text default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform snoozer.consume_discovery_request(p_request_fingerprint);
  if p_slug is null or length(p_slug)>48 or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*
    raise exception 'Invalid collection slug' using errcode='22023';
  end if;
  return (
    select item from jsonb_array_elements(public.get_public_discovery_collections(20,p_request_fingerprint)) item
    where item->>'slug'=p_slug limit 1
  );
end
$$;

-- Keep all public listing access behind the server-side fingerprint/rate limit.
revoke all on function public.get_profile_directory(text,text,text[],text,integer,timestamptz,text,integer)
  from public,anon,authenticated,service_role;
revoke all on function public.get_related_creators(text,integer)
  from public,anon,authenticated,service_role;
revoke all on function public.get_public_discovery_collections(integer)
  from public,anon,authenticated,service_role;
revoke all on function public.get_public_discovery_collection(text)
  from public,anon,authenticated,service_role;
revoke all on function public.get_profile_directory(text,text,text[],text,integer,timestamptz,text,integer,text)
  from public,anon,authenticated,service_role;
revoke all on function public.get_related_creators(text,integer,text)
  from public,anon,authenticated,service_role;
revoke all on function public.get_public_discovery_collections(integer,text)
  from public,anon,authenticated,service_role;
revoke all on function public.get_public_discovery_collection(text,text)
  from public,anon,authenticated,service_role;
grant execute on function public.get_profile_directory(text,text,text[],text,integer,timestamptz,text,integer,text)
  to service_role;
grant execute on function public.get_related_creators(text,integer,text)
  to service_role;
grant execute on function public.get_public_discovery_collections(integer,text)
  to service_role;
grant execute on function public.get_public_discovery_collection(text,text)
  to service_role;
grant execute on function public.get_my_discovery_settings(uuid),
  public.set_profile_discovery_settings(uuid,boolean,boolean,boolean,text,text[]),
  public.owner_discovery_collections(),
  public.owner_upsert_discovery_collection(text,text,text,boolean,integer,timestamptz,timestamptz,text[],text),
  public.owner_delete_discovery_collection(text,text) to authenticated;

commit;
 then
    raise exception 'Invalid collection slug' using errcode='22023';
  end if;
  return (
    select item from jsonb_array_elements(public.get_public_discovery_collections(20,p_request_fingerprint)) item
    where item->>'slug'=p_slug limit 1
  );
end
$$;

-- Keep all public listing access behind the server-side fingerprint/rate limit.
revoke all on function public.get_profile_directory(text,text,text[],text,integer,timestamptz,text,integer)
  from public,anon,authenticated,service_role;
revoke all on function public.get_related_creators(text,integer)
  from public,anon,authenticated,service_role;
revoke all on function public.get_public_discovery_collections(integer)
  from public,anon,authenticated,service_role;
revoke all on function public.get_public_discovery_collection(text)
  from public,anon,authenticated,service_role;
revoke all on function public.get_profile_directory(text,text,text[],text,integer,timestamptz,text,integer,text)
  from public,anon,authenticated,service_role;
revoke all on function public.get_related_creators(text,integer,text)
  from public,anon,authenticated,service_role;
revoke all on function public.get_public_discovery_collections(integer,text)
  from public,anon,authenticated,service_role;
revoke all on function public.get_public_discovery_collection(text,text)
  from public,anon,authenticated,service_role;
grant execute on function public.get_profile_directory(text,text,text[],text,integer,timestamptz,text,integer,text)
  to service_role;
grant execute on function public.get_related_creators(text,integer,text)
  to service_role;
grant execute on function public.get_public_discovery_collections(integer,text)
  to service_role;
grant execute on function public.get_public_discovery_collection(text,text)
  to service_role;
grant execute on function public.get_my_discovery_settings(uuid),
  public.set_profile_discovery_settings(uuid,boolean,boolean,boolean,text,text[]),
  public.owner_discovery_collections(),
  public.owner_upsert_discovery_collection(text,text,text,boolean,integer,timestamptz,timestamptz,text[],text),
  public.owner_delete_discovery_collection(text,text) to authenticated;

commit;
