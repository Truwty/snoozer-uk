-- Public badge selection and automatic full-catalogue collection for platform Owners.
begin;

create or replace function snoozer.grant_owner_profile_badges(p_profile uuid)
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
  target_owner uuid;
  granted integer := 0;
begin
  select p.owner_id into target_owner
  from snoozer.profiles p
  where p.id = p_profile;

  if target_owner is null or not exists (
    select 1 from snoozer.platform_owners o where o.owner_id = target_owner
  ) then
    return 0;
  end if;

  -- Include every enabled shared catalogue entry. Profile-specific one-off
  -- awards stay with the profile for which they were created.
  insert into snoozer.profile_badges(
    profile_id,slug,name,description,icon,category,rarity,source,is_public
  )
  select p.id,b.slug,b.name,b.description,b.icon,b.category,b.rarity,'automatic',true
  from snoozer.profiles p
  cross join snoozer.badge_catalog b
  where p.id = p_profile
    and b.enabled
    and b.unique_profile_id is null
  on conflict(profile_id,slug) do update
    set revoked_at = null,
        source = 'automatic',
        awarded_by = null,
        award_reason = null,
        is_public = true,
        awarded_at = now()
    where snoozer.profile_badges.revoked_at is not null;

  get diagnostics granted = row_count;
  return granted;
end
$function$;

create or replace function snoozer.grant_owner_badges_after_profile_change()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  perform snoozer.grant_owner_profile_badges(new.id);
  return new;
end
$function$;

create or replace function snoozer.grant_owner_badges_after_owner_change()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare item record;
begin
  for item in select p.id from snoozer.profiles p where p.owner_id = new.owner_id loop
    perform snoozer.grant_owner_profile_badges(item.id);
  end loop;
  return new;
end
$function$;

create or replace function snoozer.grant_owner_badges_after_catalog_change()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare item record;
begin
  for item in
    select p.id
    from snoozer.profiles p
    join snoozer.platform_owners o on o.owner_id = p.owner_id
  loop
    perform snoozer.grant_owner_profile_badges(item.id);
  end loop;
  return new;
end
$function$;

drop trigger if exists badges_owner_profiles_grant on snoozer.profiles;
create trigger badges_owner_profiles_grant
after insert or update of owner_id on snoozer.profiles
for each row execute function snoozer.grant_owner_badges_after_profile_change();

drop trigger if exists badges_owner_assignment_grant on snoozer.platform_owners;
create trigger badges_owner_assignment_grant
after insert or update of owner_id on snoozer.platform_owners
for each row execute function snoozer.grant_owner_badges_after_owner_change();

drop trigger if exists badges_owner_catalog_insert_grant on snoozer.badge_catalog;
create trigger badges_owner_catalog_insert_grant
after insert on snoozer.badge_catalog
for each row execute function snoozer.grant_owner_badges_after_catalog_change();

drop trigger if exists badges_owner_catalog_enable_grant on snoozer.badge_catalog;
create trigger badges_owner_catalog_enable_grant
after update of enabled on snoozer.badge_catalog
for each row execute function snoozer.grant_owner_badges_after_catalog_change();

-- Backfill owners and profiles already present when this migration is applied.
do $block$
declare item record;
begin
  for item in
    select p.id
    from snoozer.profiles p
    join snoozer.platform_owners o on o.owner_id = p.owner_id
  loop
    perform snoozer.grant_owner_profile_badges(item.id);
  end loop;
end
$block$;

create or replace function public.get_my_profile_badges(p_profile uuid default null::uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  actor uuid := snoozer.verified_user();
  target uuid;
begin
  select p.id into target
  from snoozer.profiles p
  where p.owner_id = actor
    and (p_profile is null or p.id = p_profile)
  order by (p.id = p_profile) desc,p.created_at,p.id
  limit 1;

  if target is null then
    raise exception 'Profile not found' using errcode = 'P0002';
  end if;

  perform snoozer.award_profile_milestones(target);

  return jsonb_build_object(
    'profile_id',target,
    'earned',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',a.id,'slug',a.slug,'name',a.name,'description',a.description,
        'icon',a.icon,'category',a.category,'rarity',a.rarity,'source',a.source,
        'awarded_at',a.awarded_at,'award_reason',a.award_reason,'is_public',a.is_public
      ) order by a.awarded_at desc,a.name)
      from snoozer.profile_badges a
      where a.profile_id = target and a.revoked_at is null
    ),'[]'::jsonb),
    'catalogue',coalesce((
      select jsonb_agg(jsonb_build_object(
        'slug',c.slug,'name',c.name,'description',c.description,'icon',c.icon,
        'category',c.category,'rarity',c.rarity,'award_mode',c.award_mode,
        'enabled',c.enabled,
        'earned',exists(
          select 1 from snoozer.profile_badges a
          where a.profile_id = target and a.slug = c.slug and a.revoked_at is null
        )
      ) order by c.sort_order,c.name)
      from snoozer.badge_catalog c
      where (c.unique_profile_id is null and c.award_mode <> 'manual')
         or c.unique_profile_id = target
    ),'[]'::jsonb)
  );
end
$function$;

create or replace function public.set_my_profile_badge_visibility(
  p_profile uuid,
  p_slugs text[]
)
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
  actor uuid := snoozer.verified_user();
  target uuid;
  requested text[] := coalesce(p_slugs,array[]::text[]);
  changed integer := 0;
begin
  if cardinality(requested) > 256 then
    raise exception 'Too many badges selected' using errcode = '22023';
  end if;

  select p.id into target
  from snoozer.profiles p
  where p.id = p_profile and p.owner_id = actor;

  if target is null then
    raise exception 'Profile not found' using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from unnest(requested) as selected(slug)
    where selected.slug is null
       or not exists (
         select 1
         from snoozer.profile_badges b
         where b.profile_id = target
           and b.slug = selected.slug
           and b.revoked_at is null
       )
  ) then
    raise exception 'A selected badge is not owned by this profile' using errcode = '22023';
  end if;

  update snoozer.profile_badges b
  set is_public = (b.slug = any(requested))
  where b.profile_id = target and b.revoked_at is null;

  get diagnostics changed = row_count;
  return changed;
end
$function$;

revoke all on function snoozer.grant_owner_profile_badges(uuid) from public,anon,authenticated,service_role;
revoke all on function snoozer.grant_owner_badges_after_profile_change() from public,anon,authenticated,service_role;
revoke all on function snoozer.grant_owner_badges_after_owner_change() from public,anon,authenticated,service_role;
revoke all on function snoozer.grant_owner_badges_after_catalog_change() from public,anon,authenticated,service_role;

revoke all on function public.get_my_profile_badges(uuid) from public,anon,authenticated,service_role;
grant execute on function public.get_my_profile_badges(uuid) to authenticated;
revoke all on function public.set_my_profile_badge_visibility(uuid,text[]) from public,anon,authenticated,service_role;
grant execute on function public.set_my_profile_badge_visibility(uuid,text[]) to authenticated;

commit;
