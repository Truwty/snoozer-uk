begin;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('custom-badges','custom-badges',false,2097152,array['image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;

alter table snoozer.plan_versions add column if not exists custom_badges integer not null default 0 check (custom_badges >= 0);
update snoozer.plan_versions set custom_badges=case plan when 'plus' then 3 when 'pro' then 8 when 'studio' then 20 else 0 end;

create table snoozer.custom_profile_badges (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references snoozer.profiles(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 40),
  description text not null default '' check (char_length(description) <= 160),
  icon text not null check (char_length(icon) between 1 and 8),
  image_id uuid unique,
  color text not null default '#73e3bd' check (color ~ '^#[0-9a-fA-F]{6}$'),
  is_public boolean not null default false,
  display_order integer not null default 0 check (display_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(profile_id,id)
);
create index custom_profile_badges_owner on snoozer.custom_profile_badges(owner_id,profile_id,display_order);
alter table snoozer.custom_profile_badges enable row level security;
revoke all on snoozer.custom_profile_badges from public,anon,authenticated,service_role;

create or replace function public.get_my_plan() returns jsonb
language sql stable security definer set search_path = '' as $$
  with actor as materialized (select snoozer.verified_user() as id)
  select jsonb_build_object('plan',p.plan,'version',p.version,
    'quotas',jsonb_build_object('profiles',p.profiles,'links',p.links,'mediaBytes',p.media_bytes,
      'domains',p.domains,'aliases',p.aliases,'analyticsDays',p.analytics_days,'teamSeats',p.team_seats,'customBadges',p.custom_badges),
    'capabilities',jsonb_build_object('premiumLayouts',p.premium_layouts,'advancedEffects',p.advanced_effects,
      'scheduledPublishing',p.scheduled_publishing,'abTesting',p.ab_testing,'removeBranding',p.remove_branding,
      'advancedSeo',p.advanced_seo,'prioritySupport',p.priority_support,'apiAccess',p.api_access),
    'expiresAt',e.expires_at,
    'usage',jsonb_build_object('publishedProfiles',(select count(*) from snoozer.profiles where owner_id=actor.id and published_revision is not null),
      'draftLinks',(select count(*) from snoozer.links where owner_id=actor.id),
      'mediaBytes',coalesce((select sum(snoozer.retained_media_bytes(media_scope)) from snoozer.profiles where owner_id=actor.id),0)))
  from actor cross join lateral snoozer.effective_plan(actor.id) e cross join lateral (select (e.plan).*) p
$$;

create or replace function public.list_my_custom_badges(p_profile uuid)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare actor uuid:=snoozer.verified_user();
begin
 if not exists(select 1 from snoozer.profiles where id=p_profile and owner_id=actor) then raise exception 'Profile not found' using errcode='P0002'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'title',b.title,'description',b.description,'icon',b.icon,
   'color',b.color,'image_id',b.image_id,'is_public',b.is_public,'display_order',b.display_order) order by b.display_order,b.created_at)
   from snoozer.custom_profile_badges b where b.profile_id=p_profile and b.owner_id=actor),'[]'::jsonb);
end $$;

create or replace function public.create_my_custom_badge(p_profile uuid,p_title text,p_description text,p_icon text,p_color text)
returns uuid language plpgsql security definer set search_path to '' as $$
declare actor uuid:=snoozer.verified_user(); cap integer; used integer; result uuid;
begin
 if not exists(select 1 from snoozer.profiles where id=p_profile and owner_id=actor) then raise exception 'Profile not found' using errcode='P0002'; end if;
 if p_title is null or char_length(btrim(p_title)) not between 2 and 40 or p_description is null or char_length(p_description)>160
   or p_icon is null or char_length(p_icon) not between 1 and 8 or p_icon ~ '[[:cntrl:]]'
   or p_color !~ '^#[0-9a-fA-F]{6}$' then raise exception 'Invalid custom badge details' using errcode='22023'; end if;
 perform 1 from auth.users where id=actor for update;
 select (e.plan).custom_badges into cap from snoozer.effective_plan(actor) e;
 select count(*) into used from snoozer.custom_profile_badges where owner_id=actor;
 if used>=coalesce(cap,0) then raise exception 'Custom badge plan limit reached' using errcode='P1104'; end if;
 insert into snoozer.custom_profile_badges(profile_id,owner_id,title,description,icon,color,display_order)
 values(p_profile,actor,btrim(p_title),btrim(p_description),p_icon,p_color,used) returning id into result;
 return result;
end $$;

create or replace function public.set_my_custom_badge_visibility(p_profile uuid,p_ids uuid[])
returns integer language plpgsql security definer set search_path to '' as $$
declare actor uuid:=snoozer.verified_user(); n integer;
begin
 if not exists(select 1 from snoozer.profiles where id=p_profile and owner_id=actor) then raise exception 'Profile not found' using errcode='P0002'; end if;
 if cardinality(coalesce(p_ids,'{}'::uuid[]))>20 or cardinality(coalesce(p_ids,'{}'::uuid[]))<>(select count(distinct x) from unnest(coalesce(p_ids,'{}'::uuid[])) x)
   or exists(select 1 from unnest(coalesce(p_ids,'{}'::uuid[])) x where not exists(select 1 from snoozer.custom_profile_badges b where b.id=x and b.profile_id=p_profile and b.owner_id=actor))
 then raise exception 'Invalid custom badge selection' using errcode='22023'; end if;
 update snoozer.custom_profile_badges b set is_public=(array_position(coalesce(p_ids,'{}'::uuid[]),b.id) is not null),
 display_order=coalesce(array_position(coalesce(p_ids,'{}'::uuid[]),b.id),cardinality(coalesce(p_ids,'{}'::uuid[]))+b.display_order),updated_at=now()
 where b.profile_id=p_profile and b.owner_id=actor; get diagnostics n=row_count; return n;
end $$;

create or replace function public.delete_my_custom_badge(p_profile uuid,p_id uuid)
returns boolean language plpgsql security definer set search_path to '' as $$
declare actor uuid:=snoozer.verified_user(); n integer;
begin
 if not exists(select 1 from snoozer.profiles where id=p_profile and owner_id=actor) then raise exception 'Profile not found' using errcode='P0002'; end if;
 delete from snoozer.custom_profile_badges where id=p_id and profile_id=p_profile and owner_id=actor; get diagnostics n=row_count; return n=1;
end $$;

create or replace function public.update_my_custom_badge(p_profile uuid,p_id uuid,p_title text,p_description text,p_icon text,p_color text)
returns boolean language plpgsql security definer set search_path to '' as $$
declare actor uuid:=snoozer.verified_user(); n integer;
begin
 if not exists(select 1 from snoozer.profiles where id=p_profile and owner_id=actor) then raise exception 'Profile not found' using errcode='P0002'; end if;
 if p_title is null or char_length(btrim(p_title)) not between 2 and 40 or p_description is null or char_length(p_description)>160
   or p_icon is null or char_length(p_icon) not between 1 and 8 or p_icon ~ '[[:cntrl:]]'
   or p_color !~ '^#[0-9a-fA-F]{6}$' then raise exception 'Invalid custom badge details' using errcode='22023'; end if;
 update snoozer.custom_profile_badges set title=btrim(p_title),description=btrim(p_description),icon=p_icon,color=p_color,updated_at=now()
 where id=p_id and profile_id=p_profile and owner_id=actor;
 get diagnostics n=row_count; return n=1;
end $$;

create or replace function public.set_my_custom_badge_artwork(p_profile uuid,p_id uuid,p_image_id uuid)
returns boolean language plpgsql security definer set search_path to '' as $$
declare actor uuid:=snoozer.verified_user(); n integer;
begin
 if not exists(select 1 from snoozer.profiles where id=p_profile and owner_id=actor) then raise exception 'Profile not found' using errcode='P0002'; end if;
 update snoozer.custom_profile_badges set image_id=p_image_id,updated_at=now() where id=p_id and profile_id=p_profile and owner_id=actor;
 get diagnostics n=row_count; return n=1;
end $$;

create or replace function public.profile_badge_artwork(p_id uuid)
returns text language plpgsql stable security definer set search_path to '' as $$
declare actor uuid:=auth.uid(); image uuid; visible boolean; file_owner uuid;
begin
 select b.image_id,(b.is_public and p.published_revision is not null),b.owner_id into image,visible,file_owner
 from snoozer.custom_profile_badges b join snoozer.profiles p on p.id=b.profile_id where b.id=p_id;
 if image is null or (not coalesce(visible,false) and file_owner is distinct from actor) then return null; end if;
 return file_owner::text||'/'||image::text||'.webp';
end $$;

create or replace function snoozer.public_profile_badges(p_profile uuid)
returns jsonb language sql stable security definer set search_path to '' as $$
 select coalesce((select jsonb_agg(x.badge order by x.position,x.slug) from (
   select jsonb_build_object('slug',b.slug,'name',b.name,'description',b.description,'icon',b.icon,'category',b.category,
     'rarity',b.rarity,'awarded_at',b.awarded_at) badge,b.display_order position,b.slug
   from snoozer.profile_badges b where b.profile_id=p_profile and b.revoked_at is null and b.is_public
   union all
   select jsonb_build_object('slug','custom-'||b.id::text,'name',b.title,'description',b.description,'icon',b.icon,'category','custom',
     'rarity','custom','awarded_at',b.created_at,'color',b.color,'image_id',b.image_id) badge,b.display_order position,'custom-'||b.id::text slug
   from snoozer.custom_profile_badges b where b.profile_id=p_profile and b.is_public
 ) x),'[]'::jsonb)
$$;

revoke all on function public.get_my_plan() from public,anon,authenticated,service_role;
grant execute on function public.get_my_plan() to authenticated;
revoke all on function public.list_my_custom_badges(uuid),public.create_my_custom_badge(uuid,text,text,text,text),public.update_my_custom_badge(uuid,uuid,text,text,text,text),public.set_my_custom_badge_visibility(uuid,uuid[]),public.delete_my_custom_badge(uuid,uuid),public.set_my_custom_badge_artwork(uuid,uuid,uuid),public.profile_badge_artwork(uuid) from public,anon,authenticated,service_role;
grant execute on function public.list_my_custom_badges(uuid),public.create_my_custom_badge(uuid,text,text,text,text),public.update_my_custom_badge(uuid,uuid,text,text,text,text),public.set_my_custom_badge_visibility(uuid,uuid[]),public.delete_my_custom_badge(uuid,uuid),public.set_my_custom_badge_artwork(uuid,uuid,uuid) to authenticated;
grant execute on function public.profile_badge_artwork(uuid) to anon,authenticated,service_role;
revoke all on function snoozer.public_profile_badges(uuid) from public,anon,authenticated,service_role;
grant execute on function snoozer.public_profile_badges(uuid) to anon,authenticated,service_role;
commit;
