insert into snoozer.reserved_names values ('profile-not-found');

create function public.published_profile_exists(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from snoozer.profiles where username = p_name and published_revision is not null)
$$;

revoke execute on function public.published_profile_exists(text) from public, anon, authenticated, service_role;
grant execute on function public.published_profile_exists(text) to anon, authenticated;
