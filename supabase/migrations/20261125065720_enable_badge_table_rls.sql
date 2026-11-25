-- Defence in depth: badge records remain private behind fixed-search-path RPCs.
alter table snoozer.badge_catalog enable row level security;
alter table snoozer.profile_badges enable row level security;
revoke all on snoozer.badge_catalog,snoozer.profile_badges from public,anon,authenticated,service_role;
