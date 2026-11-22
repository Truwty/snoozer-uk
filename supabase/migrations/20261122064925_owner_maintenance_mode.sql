-- Default-off, Owner-controlled maintenance flag. Existing Owner RPCs enforce AAL2 and audit writes.
alter table snoozer.platform_settings drop constraint platform_settings_name_check;
alter table snoozer.platform_settings add constraint platform_settings_name_check
 check(name in ('registrations_enabled','effects_enabled','maintenance_enabled'));
insert into snoozer.platform_settings(name,value) values ('maintenance_enabled',false)
 on conflict (name) do nothing;

create function public.platform_maintenance_enabled() returns boolean
 language sql stable security definer set search_path='' as $$
 select coalesce((select value from snoozer.platform_settings where name='maintenance_enabled'),false)
$$;
revoke all on function public.platform_maintenance_enabled() from public,anon,authenticated,service_role;
grant execute on function public.platform_maintenance_enabled() to anon,authenticated;
