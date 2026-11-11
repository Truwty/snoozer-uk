-- The catalogue and grants are private. Future payment handlers create grants
-- only after verifying provider events.
create table snoozer.plan_versions (
  plan text not null check (plan in ('free', 'plus', 'pro', 'studio')),
  version integer not null check (version > 0),
  profiles integer not null check (profiles >= 0),
  links integer not null check (links >= 0),
  media_bytes bigint not null check (media_bytes between 0 and 9007199254740991),
  domains integer not null check (domains >= 0),
  aliases integer not null check (aliases >= 0),
  analytics_days integer not null check (analytics_days >= 0),
  team_seats integer not null check (team_seats >= 0),
  premium_layouts boolean not null,
  advanced_effects boolean not null,
  scheduled_publishing boolean not null,
  ab_testing boolean not null,
  remove_branding boolean not null,
  advanced_seo boolean not null,
  priority_support boolean not null,
  api_access text not null check (api_access in ('read', 'limited', 'standard', 'extended')),
  primary key (plan, version)
);

insert into snoozer.plan_versions (
  plan, version, profiles, links, media_bytes, domains, aliases, analytics_days, team_seats,
  premium_layouts, advanced_effects, scheduled_publishing, ab_testing, remove_branding,
  advanced_seo, priority_support, api_access
) values
  ('free', 1, 1, 20, 100000000, 0, 0, 30, 1, false, false, false, false, false, false, false, 'read'),
  ('plus', 1, 3, 100, 2000000000, 1, 2, 180, 1, true, true, true, false, true, true, false, 'limited'),
  ('pro', 1, 10, 500, 10000000000, 3, 10, 730, 3, true, true, true, true, true, true, true, 'standard'),
  ('studio', 1, 50, 2000, 50000000000, 10, 50, 1095, 15, true, true, true, true, true, true, true, 'extended');

create table snoozer.entitlement_grants (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  plan text not null check (plan <> 'free'),
  plan_version integer not null,
  source text not null check (source in ('stripe','kofi','gift','staff')),
  source_ref text not null check (char_length(source_ref) between 1 and 200),
  starts_at timestamptz not null,
  expires_at timestamptz not null check (expires_at > starts_at),
  revoked_at timestamptz,
  unique (source, source_ref),
  foreign key (plan, plan_version) references snoozer.plan_versions(plan, version)
);
create index entitlement_grants_active_owner on snoozer.entitlement_grants(owner_id, expires_at)
  where revoked_at is null;

alter table snoozer.plan_versions enable row level security;
alter table snoozer.entitlement_grants enable row level security;
revoke all on snoozer.plan_versions, snoozer.entitlement_grants from public, anon, authenticated, service_role;

create function public.get_my_plan() returns jsonb
language sql stable security definer set search_path = '' as $$
  with actor as materialized (select snoozer.verified_user() as id),
    selected as (
      select g.plan, g.plan_version, g.expires_at
      from actor join snoozer.entitlement_grants g on g.owner_id = actor.id
      where g.revoked_at is null and g.starts_at <= now() and g.expires_at > now()
      order by case g.plan when 'studio' then 3 when 'pro' then 2 else 1 end desc,
        g.plan_version desc, g.expires_at desc, g.id
      limit 1
    )
  select jsonb_build_object(
    'plan', p.plan,
    'version', p.version,
    'quotas', jsonb_build_object(
      'profiles', p.profiles, 'links', p.links, 'mediaBytes', p.media_bytes,
      'domains', p.domains, 'aliases', p.aliases, 'analyticsDays', p.analytics_days, 'teamSeats', p.team_seats
    ),
    'capabilities', jsonb_build_object(
      'premiumLayouts', p.premium_layouts, 'advancedEffects', p.advanced_effects,
      'scheduledPublishing', p.scheduled_publishing, 'abTesting', p.ab_testing,
      'removeBranding', p.remove_branding, 'advancedSeo', p.advanced_seo,
      'prioritySupport', p.priority_support, 'apiAccess', p.api_access
    ),
    'expiresAt', selected.expires_at,
    'usage', jsonb_build_object(
      'publishedProfiles', (select count(*) from snoozer.profiles where owner_id = actor.id and published_revision is not null),
      'draftLinks', (select count(*) from snoozer.links where owner_id = actor.id)
    )
  )
  from actor left join selected on true
  join snoozer.plan_versions p on p.plan = coalesce(selected.plan, 'free')
    and p.version = coalesce(selected.plan_version, (select max(version) from snoozer.plan_versions where plan = 'free'))
$$;

revoke execute on function public.get_my_plan() from public, anon, authenticated, service_role;
grant execute on function public.get_my_plan() to authenticated;
