-- Optional Supabase Auth "Before User Created" hook.
-- It must be enabled in Dashboard -> Authentication -> Hooks after deployment.
-- This hook runs BEFORE INSERT, for email, Discord and other providers.
create function public.snoozer_before_user_created(event jsonb)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare enabled boolean;
begin
  -- Do not accept an unknown payload as proof of a legitimate new user.
  if event->'metadata'->>'name' is distinct from 'before-user-created'
    or event->'user'->>'id' is null
    or event->'user'->'app_metadata'->>'provider' is null then
    return jsonb_build_object('error',jsonb_build_object('http_code',400,
      'message','Invalid registration event.'));
  end if;

  select value into enabled from snoozer.platform_settings
  where name='registrations_enabled';
  if enabled is distinct from true then
    return jsonb_build_object('error',jsonb_build_object('http_code',403,
      'message','New account registrations are temporarily disabled.'));
  end if;
  return '{}'::jsonb;
end $$;

revoke all on function public.snoozer_before_user_created(jsonb)
 from PUBLIC,anon,authenticated,service_role;
do $ begin
  if exists (select 1 from pg_catalog.pg_roles where rolname='supabase_auth_admin') then
    grant execute on function public.snoozer_before_user_created(jsonb) to supabase_auth_admin;
  end if;
end $;
