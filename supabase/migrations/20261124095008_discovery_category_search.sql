begin;

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
declare prefix_pattern text;
declare tag_query text;
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

  prefix_pattern:=replace(replace(replace(q,'!','!!'),'%','!%'),'_','!_')||'%';
  tag_query:=replace(q,' ','-');
  query_terms:=case when q='' then null else plainto_tsquery('simple',q) end;

  return query
  with candidates as materialized (
    select p.username,v.display_name,v.bio,v.avatar,d.category,d.tags,
      (snoozer.ready_profile_domain(p.id) is not null) as has_verified_domain,
      coalesce(v.activated_at,v.published_at) as joined_at,
      case
        when q='' then 0
        when lower(p.username)=q then 1000
        when lower(p.username) like prefix_pattern escape '!' then 900
        when lower(v.display_name)=q then 850
        when lower(v.display_name) like prefix_pattern escape '!' then 800
        when strpos(replace(d.category,'-',' '),q)>0 then 430
        when d.tags @> array[tag_query]::text[] then 450
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
      and (q='' or lower(p.username)=q
        or lower(p.username) like prefix_pattern escape '!'
        or lower(v.display_name)=q
        or lower(v.display_name) like prefix_pattern escape '!'
        or strpos(replace(d.category,'-',' '),q)>0
        or d.tags @> array[tag_query]::text[]
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
