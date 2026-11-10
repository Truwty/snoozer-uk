-- Read Storage metadata here. The operator deletes the objects through the Storage API.
create function public.find_orphan_avatars() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(candidate.name), '[]'::jsonb)
  from (
    select o.name
    from storage.objects o
    join snoozer.profiles p on p.media_scope::text = split_part(o.name, '/', 1)
    where o.bucket_id = 'avatar-images'
      and o.created_at < now() - interval '24 hours'
      and o.name ~ '^[0-9a-f-]{36}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$'
      and split_part(o.name, '/', 2) is distinct from p.avatar::text || '.webp'
      and not exists (
        select 1 from snoozer.published_profiles v
        where v.owner_id = p.owner_id and v.avatar::text || '.webp' = split_part(o.name, '/', 2)
      )
    order by o.created_at, o.name limit 40
  ) candidate
$$;

revoke execute on function public.find_orphan_avatars() from public, anon, authenticated, service_role;
grant execute on function public.find_orphan_avatars() to service_role;
