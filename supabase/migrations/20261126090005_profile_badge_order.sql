begin;

alter table snoozer.profile_badges
  add column if not exists display_order integer not null default 0 check (display_order >= 0);

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
  if cardinality(requested) <> (select count(distinct x) from unnest(requested) x) then
    raise exception 'Duplicate badges are not allowed' using errcode = '22023';
  end if;
  select p.id into target from snoozer.profiles p where p.id=p_profile and p.owner_id=actor;
  if target is null then raise exception 'Profile not found' using errcode = 'P0002'; end if;
  if exists(select 1 from unnest(requested) s where s is null or not exists(
    select 1 from snoozer.profile_badges b where b.profile_id=target and b.slug=s and b.revoked_at is null
  )) then raise exception 'A selected badge is not owned by this profile' using errcode = '22023'; end if;

  update snoozer.profile_badges b set
    is_public = (array_position(requested,b.slug) is not null),
    display_order = coalesce(array_position(requested,b.slug), cardinality(requested)+b.display_order)
  where b.profile_id=target and b.revoked_at is null;
  get diagnostics changed = row_count;
  return changed;
end
$function$;

create or replace function snoozer.public_profile_badges(p_profile uuid)
returns jsonb language sql stable security definer set search_path to '' as $function$
 select coalesce(jsonb_agg(jsonb_build_object('slug',b.slug,'name',b.name,'description',b.description,'icon',b.icon,
 'category',b.category,'rarity',b.rarity,'awarded_at',b.awarded_at) order by b.display_order,b.awarded_at,b.slug),'[]'::jsonb)
 from snoozer.profile_badges b where b.profile_id=p_profile and b.revoked_at is null and b.is_public
$function$;

revoke all on function public.set_my_profile_badge_visibility(uuid,text[]) from public,anon,authenticated,service_role;
grant execute on function public.set_my_profile_badge_visibility(uuid,text[]) to authenticated;
revoke all on function snoozer.public_profile_badges(uuid) from public,anon,authenticated,service_role;
grant execute on function snoozer.public_profile_badges(uuid) to anon,authenticated,service_role;
commit;
