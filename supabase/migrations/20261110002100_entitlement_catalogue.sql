-- The catalogue and grants are private. Future payment handlers create grants
-- only after verifying provider events.
create table snoozer.plan_versions (
  plan text not null check (plan in ('free', 'plus', 'pro', 'studio')),
  version integer not null check (version > 0),
  quotas jsonb not null check (jsonb_typeof(quotas) = 'object'),
  capabilities jsonb not null check (jsonb_typeof(capabilities) = 'object'),
  primary key (plan, version)
);

insert into snoozer.plan_versions (plan, version, quotas, capabilities) values
  ('free', 1,
    '{"profiles":1,"links":20,"mediaBytes":100000000,"domains":0,"aliases":0,"analyticsDays":30,"teamSeats":1}',
    '{"premiumLayouts":false,"advancedEffects":false,"scheduledPublishing":false,"abTesting":false,"removeBranding":false,"advancedSeo":false,"prioritySupport":false,"apiAccess":"read"}'),
  ('plus', 1,
    '{"profiles":3,"links":100,"mediaBytes":2000000000,"domains":1,"aliases":2,"analyticsDays":180,"teamSeats":1}',
    '{"premiumLayouts":true,"advancedEffects":true,"scheduledPublishing":true,"abTesting":false,"removeBranding":true,"advancedSeo":true,"prioritySupport":false,"apiAccess":"limited"}'),
  ('pro', 1,
    '{"profiles":10,"links":500,"mediaBytes":10000000000,"domains":3,"aliases":10,"analyticsDays":730,"teamSeats":3}',
    '{"premiumLayouts":true,"advancedEffects":true,"scheduledPublishing":true,"abTesting":true,"removeBranding":true,"advancedSeo":true,"prioritySupport":true,"apiAccess":"standard"}'),
  ('studio', 1,
    '{"profiles":50,"links":2000,"mediaBytes":50000000000,"domains":10,"aliases":50,"analyticsDays":1095,"teamSeats":15}',
    '{"premiumLayouts":true,"advancedEffects":true,"scheduledPublishing":true,"abTesting":true,"removeBranding":true,"advancedSeo":true,"prioritySupport":true,"apiAccess":"extended"}');

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
    'plan', p.plan, 'version', p.version, 'quotas', p.quotas, 'capabilities', p.capabilities,
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
