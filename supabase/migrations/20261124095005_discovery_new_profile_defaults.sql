begin;

-- Migrations backfill existing profiles with a NULL leaderboard preference so
-- their historic SEO-indexability behaviour is retained. Profiles created
-- after this feature ships must instead start with every discovery surface off.
create or replace function snoozer.initialize_profile_discovery_settings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into snoozer.profile_discovery_settings(
    profile_id,directory_enabled,leaderboard_enabled,recommendations_enabled,category,tags,updated_at
  ) values (
    new.id,false,false,false,'other',array[]::text[],now()
  )
  on conflict(profile_id) do nothing;
  return new;
end
$$;

revoke all on function snoozer.initialize_profile_discovery_settings()
  from public,anon,authenticated,service_role;

drop trigger if exists initialize_profile_discovery_settings on snoozer.profiles;
create trigger initialize_profile_discovery_settings
after insert on snoozer.profiles
for each row execute function snoozer.initialize_profile_discovery_settings();

-- Catch any profile created concurrently while the original backfill migration
-- was acquiring its locks. Existing rows are never overwritten here.
insert into snoozer.profile_discovery_settings(
  profile_id,directory_enabled,leaderboard_enabled,recommendations_enabled,category,tags
)
select p.id,false,false,false,'other',array[]::text[]
from snoozer.profiles p
on conflict(profile_id) do nothing;

commit;
