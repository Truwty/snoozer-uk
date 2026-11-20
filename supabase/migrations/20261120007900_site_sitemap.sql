begin;

create function public.list_indexable_profile_sitemap()
returns table(username text, last_modified timestamptz)
language sql stable security definer set search_path=''
as $$
  select p.username, coalesce(v.activated_at, v.published_at)
  from snoozer.profiles p
  join snoozer.published_profiles v on v.profile_id=p.id and v.revision=p.published_revision
  where p.published_revision is not null
    and v.activated_at is not null
    and v.indexable
    and snoozer.ready_profile_domain(p.id) is null
  order by p.username
$$;

revoke all on function public.list_indexable_profile_sitemap() from public,anon,authenticated,service_role;
grant execute on function public.list_indexable_profile_sitemap() to anon,authenticated;

commit;
