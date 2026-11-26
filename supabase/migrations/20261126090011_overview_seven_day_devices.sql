-- The account overview uses an exact seven UTC calendar day window, independent
-- of the wider retention window used by the detailed analytics page.
create function public.get_my_profile_device_views_7d(p_profile uuid)
returns table(device text, views bigint)
language sql stable security definer set search_path = '' as $$
  select d.device, sum(d.views)::bigint
  from snoozer.profiles p
  join snoozer.profile_traffic_days d on d.profile_id = p.id
  cross join lateral snoozer.effective_plan(p.owner_id) e
  where p.id = p_profile
    and p.owner_id = snoozer.verified_user()
    and (e.plan).analytics_days >= 7
    and d.day >= (now() at time zone 'UTC')::date - 6
  group by d.device
  order by sum(d.views) desc, d.device;
$$;

revoke all on function public.get_my_profile_device_views_7d(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_my_profile_device_views_7d(uuid) to authenticated;
