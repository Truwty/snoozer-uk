begin;

create or replace function snoozer.consume_discovery_request(p_request_hash text)
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
    window_started_at=case when snoozer.discovery_request_windows.window_started_at<=now()-interval '1 minute'
      then now() else snoozer.discovery_request_windows.window_started_at end,
    request_count=case when snoozer.discovery_request_windows.window_started_at<=now()-interval '1 minute'
      then 1 else snoozer.discovery_request_windows.request_count+1 end
  returning request_count into current_count;
  if current_count>180 then
    raise exception 'Too many discovery requests. Try again shortly.' using errcode='42901';
  end if;
  delete from snoozer.discovery_request_windows where window_started_at<now()-interval '2 hours';
  return true;
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
        when exists(select 1 from unnest(d.tags) chosen_tag where strpos(replace(chosen_tag,'-',' '),q)>0) then 450
        when query_terms is not null and
          to_tsvector('simple',coalesce(v.display_name,'')||' '||coalesce(v.bio,'')) @@ query_terms then 400
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
        or exists(select 1 from unnest(d.tags) chosen_tag where strpos(replace(chosen_tag,'-',' '),q)>0)
        or (query_terms is not null and
          to_tsvector('simple',coalesce(v.display_name,'')||' '||coalesce(v.bio,'')) @@ query_terms))
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

commit;
