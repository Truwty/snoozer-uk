-- Expand the Owner's validated configuration registry.
alter table snoozer.platform_settings drop constraint platform_settings_name_check;
alter table snoozer.platform_settings add constraint platform_settings_name_check
  check(name in ('registrations_enabled','effects_enabled'));
insert into snoozer.platform_settings(name,value) values('effects_enabled',true);
create function public.profile_effects_allowed() returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((select value from snoozer.platform_settings where name='effects_enabled'),false)
$$;
revoke all on function public.profile_effects_allowed() from public,anon,authenticated,service_role;
grant execute on function public.profile_effects_allowed() to anon,authenticated;