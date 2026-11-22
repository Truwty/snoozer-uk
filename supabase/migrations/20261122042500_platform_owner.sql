-- Owner identity is held in a private, database-administered table.
-- Never grant the client insert/update/delete privileges on this table.
create table if not exists snoozer.platform_owners (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  granted_at timestamptz not null default now()
);
alter table snoozer.platform_owners enable row level security;
revoke all on snoozer.platform_owners from public, anon, authenticated;

-- Provision the verified existing account. This does not modify login credentials.
insert into snoozer.platform_owners(owner_id)
select id from auth.users where id = 'fddb0ff0-b7ea-4298-9fa2-2e8251df087e'
on conflict (owner_id) do nothing;

-- An authenticated session can inspect only its own Owner state.
create or replace function public.is_platform_owner() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(
    select 1 from snoozer.platform_owners
    where owner_id = snoozer.verified_user()
  )
$$;
revoke all on function public.is_platform_owner() from public, anon, authenticated, service_role;
grant execute on function public.is_platform_owner() to authenticated;

-- Exposes a single verified public badge, never a mutable badge property.
create or replace function public.is_owner_profile(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(
    select 1 from snoozer.profiles p
    join snoozer.platform_owners o on o.owner_id = p.owner_id
    where p.username = p_name and p.published_revision is not null
  )
$$;
revoke all on function public.is_owner_profile(text) from public, anon, authenticated, service_role;
grant execute on function public.is_owner_profile(text) to anon, authenticated;

-- Owners always receive the highest current product capabilities, with no fake
-- Stripe subscription, billing event, expiring entitlement, or extra bypass.
create or replace function snoozer.effective_plan(p_owner uuid)
returns table(plan snoozer.plan_versions, expires_at timestamptz)
language sql stable set search_path = '' as $$
  with selected as (
    select g.plan, g.plan_version, g.expires_at
    from snoozer.entitlement_grants g
    where g.owner_id = p_owner and g.revoked_at is null and not g.payment_held
      and g.starts_at <= now() and g.expires_at > now()
    order by case g.plan when 'studio' then 3 when 'pro' then 2 else 1 end desc,
      g.plan_version desc, g.expires_at desc, g.id
    limit 1
  ), owner_status as (
    select exists(select 1 from snoozer.platform_owners where owner_id = p_owner) as is_owner
  )
  select p, case when o.is_owner then null::timestamptz else selected.expires_at end
  from owner_status o
  left join selected on true
  join snoozer.plan_versions p
    on p.plan = case when o.is_owner then 'studio' else coalesce(selected.plan, 'free') end
    and p.version = coalesce(
      case when o.is_owner then null::integer else selected.plan_version end,
      (select max(version) from snoozer.plan_versions
       where plan = case when o.is_owner then 'studio' else 'free' end)
    )
$$;

-- Read-only operational dashboard. These RPCs return bounded non-secret data.
create or replace function public.owner_overview() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists(select 1 from snoozer.platform_owners where owner_id = snoozer.verified_user()) then
    raise exception 'Owner access required' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'accounts', (select count(*) from auth.users),
    'profiles', (select count(*) from snoozer.profiles),
    'published', (select count(*) from snoozer.profiles where published_revision is not null),
    'owners', (select count(*) from snoozer.platform_owners)
  );
end $$;
revoke all on function public.owner_overview() from public, anon, authenticated, service_role;
grant execute on function public.owner_overview() to authenticated;

create or replace function public.owner_recent_profiles(p_limit integer default 25) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists(select 1 from snoozer.platform_owners where owner_id = snoozer.verified_user()) then
    raise exception 'Owner access required' using errcode = '42501';
  end if;
  return coalesce((select jsonb_agg(to_jsonb(r)) from (
    select p.username, p.display_name, (p.published_revision is not null) as published, p.created_at
    from snoozer.profiles p order by p.created_at desc, p.username
    limit least(greatest(coalesce(p_limit, 25), 1), 100)
  ) r), '[]'::jsonb);
end $$;
revoke all on function public.owner_recent_profiles(integer) from public, anon, authenticated, service_role;
grant execute on function public.owner_recent_profiles(integer) to authenticated;
