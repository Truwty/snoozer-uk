-- Expose aggregate homepage totals to the server-only service role.
-- The function is SECURITY INVOKER and cannot be called by anon/authenticated.
create or replace function public.get_public_homepage_stats()
returns jsonb
language sql
stable
security invoker
set search_path = pg_catalog, public, snoozer, auth, storage
as $function$
  select jsonb_build_object(
    'members', (
      select count(*)::bigint
      from auth.users u
      where u.email_confirmed_at is not null
    ),
    'profiles', (
      select count(distinct pp.profile_id)::bigint
      from snoozer.published_profiles pp
      join snoozer.profiles p
        on p.id = pp.profile_id
       and p.published_revision = pp.revision
    ),
    'views', (
      select coalesce(sum(l.total_views), 0)::bigint
      from snoozer.profile_view_leaderboard l
    ),
    'uploads', (
      select count(*)::bigint
      from storage.objects o
      where o.bucket_id in (
        'avatar-images',
        'gallery-images',
        'profile-audio',
        'profile-background-videos',
        'custom-badges'
      )
    )
  );
$function$;

revoke all on function public.get_public_homepage_stats() from public, anon, authenticated;
grant usage on schema snoozer to service_role;
grant select on snoozer.profiles, snoozer.published_profiles, snoozer.profile_view_leaderboard to service_role;
grant select on auth.users to service_role;
grant execute on function public.get_public_homepage_stats() to service_role;
