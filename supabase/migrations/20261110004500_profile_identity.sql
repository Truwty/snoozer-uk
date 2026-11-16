-- Assign a stable profile ID to existing rows and new claims. Keep the owner
-- key in place until every draft and publication writer uses the profile ID.
alter table snoozer.profiles add column id uuid not null default gen_random_uuid();
alter table snoozer.profiles add constraint profiles_id_key unique (id);

create function public.list_my_profiles() returns jsonb
language sql stable security definer set search_path = '' as $$
  with actor as materialized (select snoozer.verified_user() as id)
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id,
    'username', p.username,
    'published', p.published_revision is not null
  ) order by p.created_at, p.id), '[]'::jsonb)
  from actor join snoozer.profiles p on p.owner_id = actor.id
$$;

revoke execute on function public.list_my_profiles() from public, anon, authenticated, service_role;
grant execute on function public.list_my_profiles() to authenticated;
