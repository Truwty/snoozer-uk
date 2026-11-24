begin;

create index if not exists discovery_request_windows_expiry
  on snoozer.discovery_request_windows(window_started_at);

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
      order by c.sort_order,c.created_at desc
      limit p_limit
    ) item
  ),'[]'::jsonb);
end
$$;

commit;
