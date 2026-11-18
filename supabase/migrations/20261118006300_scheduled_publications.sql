begin;
alter table snoozer.published_profiles add column activated_at timestamptz default now();
update snoozer.published_profiles set activated_at=published_at;

create table snoozer.publication_schedules (
 profile_id uuid primary key references snoozer.profiles(id) on delete cascade,
 revision integer not null,
 expected_live_revision integer,
 run_at timestamptz not null,
 state text not null check(state in ('pending','published','cancelled','blocked')),
 reason text check(reason in ('manual','superseded','plan_changed','quota','snapshot_unavailable','owner_unavailable')),
 created_at timestamptz not null default now(),
 completed_at timestamptz,
 foreign key(profile_id,revision) references snoozer.published_profiles(profile_id,revision) on delete cascade
);
create index publication_schedules_due on snoozer.publication_schedules(run_at,profile_id) where state='pending';
alter table snoozer.publication_schedules enable row level security;
revoke all on snoozer.publication_schedules from public,anon,authenticated,service_role;

create function snoozer.cancel_superseded_schedule() returns trigger language plpgsql security definer set search_path='' as $$
begin
 update snoozer.publication_schedules set state='cancelled',reason='superseded',completed_at=now() where profile_id=new.id and state='pending';
 return new;
end $$;
revoke execute on function snoozer.cancel_superseded_schedule() from public,anon,authenticated,service_role;
create trigger cancel_superseded_schedule after update of published_revision on snoozer.profiles for each row execute function snoozer.cancel_superseded_schedule();
create or replace function snoozer.save_profile_for_id(
  p_profile uuid,
  p_expected integer, p_name text, p_bio text, p_theme text,
  p_indexable boolean, p_links jsonb, p_publish boolean, p_remove_avatar boolean
) returns integer
language plpgsql security definer set search_path = '' as $$
declare actor uuid := snoozer.verified_user();
declare current snoozer.profiles;
declare item jsonb;
declare address text;
declare hostname text;
begin
  if p_expected is null or p_name is null or p_bio is null or p_theme is null
    or p_indexable is null or p_publish is null or p_remove_avatar is null
    or jsonb_typeof(p_links) is distinct from 'array' then
    raise exception 'Invalid profile fields' using errcode = '22023';
  end if;
  if jsonb_array_length(p_links) > 2000 then
    raise exception 'Too many links' using errcode = '22023';
  end if;
  for item in select value from jsonb_array_elements(p_links) loop
    address := item->>'url';
    hostname := substring(address from '^https?://([a-z0-9.-]+)');
    if jsonb_typeof(item->'url') is distinct from 'string'
      or jsonb_typeof(item->'label') is distinct from 'string'
      or address !~ '^https?://[a-z0-9.-]+(:[0-9]{1,5})?([/?#][^[:space:]\\]*)?$'
      or hostname !~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$'
      or hostname ~ '\.(local|localhost|internal|test|invalid|example|onion)$'
      or coalesce(substring(address from '^https?://[a-z0-9.-]+:([0-9]+)')::integer, 0) > 65535 then
      raise exception 'Invalid link' using errcode = '22023';
    end if;
  end loop;

  if p_publish then
    perform pg_advisory_xact_lock(hashtextextended('profile-publication:' || actor::text, 0));
  end if;
  select * into current from snoozer.profiles where id = p_profile and owner_id = actor for update;
  if not found or current.revision <> p_expected then
    raise exception 'Profile revision conflict' using errcode = '40001';
  end if;
  if p_publish and
    (select count(*) from snoozer.profiles where owner_id = actor and published_revision is not null)
      + (case when current.published_revision is null then 1 else 0 end)
      > coalesce((select (plan).profiles from snoozer.effective_plan(actor)), 0) then
    raise exception 'Published profile limit reached' using errcode = 'P1005';
  end if;
  if jsonb_array_length(p_links) > snoozer.current_link_limit() and (
    p_publish or p_links is distinct from (
      select coalesce(jsonb_agg(jsonb_build_object('label', label, 'url', url) order by position), '[]'::jsonb)
      from snoozer.links where profile_id = p_profile
    )
  ) then
    raise exception 'Draft exceeds the current link allowance' using errcode = 'P1004';
  end if;

  update snoozer.profiles set
    display_name = btrim(p_name), bio = btrim(p_bio), theme = p_theme, indexable = p_indexable,
    avatar = case when p_remove_avatar then null else avatar end,
    revision = revision + 1, updated_at = now()
  where id = p_profile returning * into current;

  delete from snoozer.links where profile_id = p_profile;
  insert into snoozer.links(owner_id, position, label, url, profile_id)
    select actor, position, btrim(value->>'label'), value->>'url', p_profile
    from jsonb_array_elements(p_links) with ordinality as items(value, position);
  if p_publish then
    -- Keep a bounded publication history until plan-based retention is available.
    insert into snoozer.published_profiles(owner_id, revision, display_name, bio, theme, indexable, avatar, profile_id)
      values (actor, current.revision, current.display_name, current.bio, current.theme, current.indexable, current.avatar, p_profile);
    insert into snoozer.published_links(owner_id, revision, position, label, url, profile_id)
      select actor, current.revision, position, label, url, p_profile from snoozer.links where profile_id = p_profile;
    update snoozer.profiles set published_revision = current.revision where id = p_profile;
    delete from snoozer.published_profiles where profile_id = p_profile and revision in (
      select revision from snoozer.published_profiles where profile_id = p_profile
      order by revision desc offset 20
    ) and revision is distinct from current.published_revision
      and not exists(select 1 from snoozer.publication_schedules s where s.profile_id=p_profile and s.revision=published_profiles.revision and s.state='pending');
  end if;
  return current.revision;
end $$;


create function public.schedule_publication(p_profile uuid,p_expected integer,p_run_at timestamptz) returns integer
language plpgsql security definer set search_path='' as $$
declare actor uuid := snoozer.verified_user();
declare current snoozer.profiles;
declare content jsonb;
declare saved integer;
begin
 if p_run_at is null or p_run_at<=clock_timestamp()+interval '1 minute' or p_run_at>now()+interval '365 days' then raise exception 'Choose a UTC time between one minute and 365 days ahead' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('profile-publication:' || actor::text,0));
 select * into current from snoozer.profiles where id=p_profile and owner_id=actor for update;
 if not found or current.revision is distinct from p_expected then raise exception 'Profile revision conflict' using errcode='40001'; end if;
 if not coalesce((select (plan).scheduled_publishing from snoozer.effective_plan(actor)),false) then raise exception 'Scheduled publishing requires an eligible plan' using errcode='P1009'; end if;
 content := snoozer.profile_draft(p_profile);
 saved := public.save_profile(p_profile,p_expected,current.display_name,current.bio,current.theme,current.indexable,content->'links',true,false,
   (select coalesce(jsonb_agg(jsonb_build_object('hidden',false,'locked',false)||value),'[]'::jsonb) from jsonb_array_elements(content->'sections')),
   current.appearance,jsonb_build_object('title',current.seo_title,'description',current.seo_description));
 -- The prepared snapshot and pointer restoration commit together; it is never briefly public.
 update snoozer.published_profiles set activated_at=null where profile_id=p_profile and revision=saved;
 update snoozer.profiles set published_revision=current.published_revision where id=p_profile;
 insert into snoozer.publication_schedules(profile_id,revision,expected_live_revision,run_at,state)
 values(p_profile,saved,current.published_revision,p_run_at,'pending')
 on conflict(profile_id) do update set revision=excluded.revision,expected_live_revision=excluded.expected_live_revision,run_at=excluded.run_at,state='pending',reason=null,created_at=now(),completed_at=null;
 return saved;
end $$;

create function public.cancel_publication_schedule(p_profile uuid) returns void language plpgsql security definer set search_path='' as $$
declare actor uuid := snoozer.verified_user();
begin
 perform 1 from snoozer.profiles where id=p_profile and owner_id=actor for update;
 if not found then raise exception 'Profile unavailable' using errcode='42501'; end if;
 update snoozer.publication_schedules set state='cancelled',reason='manual',completed_at=now() where profile_id=p_profile and state='pending';
end $$;

create function snoozer.activate_publication_schedule(p_profile uuid) returns text language plpgsql security definer set search_path='' as $$
declare current snoozer.profiles;
declare job snoozer.publication_schedules;
declare snapshot snoozer.published_profiles;
declare plan snoozer.plan_versions;
declare problem text;
declare selected_owner uuid;
begin
 select owner_id into selected_owner from snoozer.profiles where id=p_profile;
 if not found then return 'missing'; end if;
 if not pg_try_advisory_xact_lock(hashtextextended('profile-publication:' || selected_owner::text,0)) then return 'busy'; end if;
 select * into current from snoozer.profiles where id=p_profile and owner_id=selected_owner for update skip locked;
 if not found then return 'busy'; end if;
 select * into job from snoozer.publication_schedules where profile_id=p_profile for update;
 if not found or job.state<>'pending' then return 'missing'; end if;
 if job.run_at>now() then return 'not_due'; end if;
 if current.published_revision is distinct from job.expected_live_revision then
  update snoozer.publication_schedules set state='cancelled',reason='superseded',completed_at=now() where profile_id=p_profile;
  return 'cancelled';
 end if;
 select * into snapshot from snoozer.published_profiles where profile_id=p_profile and revision=job.revision;
 select (e.plan).* into plan from snoozer.effective_plan(current.owner_id) e;
 if snapshot.profile_id is null or snapshot.owner_id is distinct from current.owner_id then problem := 'snapshot_unavailable';
 elsif not exists(select 1 from auth.users where id=current.owner_id and email_confirmed_at is not null) then problem := 'owner_unavailable';
 elsif not coalesce(plan.scheduled_publishing,false) or ((snapshot.seo_title<>'' or snapshot.seo_description<>'') and not coalesce(plan.advanced_seo,false)) then problem := 'plan_changed';
 elsif (select count(*) from snoozer.profiles where owner_id=current.owner_id and published_revision is not null)+(case when current.published_revision is null then 1 else 0 end)>plan.profiles
   or (select count(*) from snoozer.published_links where profile_id=p_profile and revision=job.revision)>plan.links then problem := 'quota';
 end if;
 if problem is not null then
  update snoozer.publication_schedules set state='blocked',reason=problem,completed_at=now() where profile_id=p_profile;
  return 'blocked';
 end if;
 -- Serialize the account quota check with manual publishing on every sibling profile.
 -- The account lock was acquired before the profile lock.
 update snoozer.published_profiles set activated_at=coalesce(activated_at,now()) where profile_id=p_profile and revision=job.revision;
 update snoozer.profiles set published_revision=job.revision,updated_at=now() where id=p_profile;
 update snoozer.publication_schedules set state='published',reason=null,completed_at=now() where profile_id=p_profile;
 return 'published';
end $$;

create function public.run_my_publication_schedule(p_profile uuid) returns text language plpgsql security definer set search_path='' as $$
declare actor uuid := snoozer.verified_user();
begin
 if not exists(select 1 from snoozer.profiles where id=p_profile and owner_id=actor) then raise exception 'Profile unavailable' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('profile-publication:' || actor::text,0));
 return snoozer.activate_publication_schedule(p_profile);
end $$;

create function public.run_due_publications(p_limit integer default 10) returns integer language plpgsql security definer set search_path='' as $$
declare candidate record;
declare handled integer := 0;
declare result text;
begin
 if p_limit is null or p_limit not between 1 and 50 then raise exception 'Invalid batch limit' using errcode='22023'; end if;
 for candidate in select s.profile_id,p.owner_id from snoozer.publication_schedules s join snoozer.profiles p on p.id=s.profile_id where s.state='pending' and s.run_at<=now() order by s.run_at,s.profile_id limit p_limit loop
  if pg_try_advisory_xact_lock(hashtextextended('profile-publication:' || candidate.owner_id::text,0)) then
   result := snoozer.activate_publication_schedule(candidate.profile_id);
   if result in ('published','cancelled','blocked') then handled := handled+1; end if;
  end if;
 end loop;
 return handled;
end $$;

create function snoozer.publication_scheduler_ready() returns boolean language plpgsql stable security definer set search_path='' as $$
declare ready boolean;
begin
 if to_regclass('cron.job') is null then return false; end if;
 execute 'select exists(select 1 from cron.job where jobname=''snoozer-publications-v1'' and active)' into ready;
 return coalesce(ready,false);
end $$;
revoke execute on function snoozer.publication_scheduler_ready() from public,anon,authenticated,service_role;

create function public.get_my_publication_schedule(p_profile uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not exists(select 1 from snoozer.profiles where id=p_profile and owner_id=snoozer.verified_user()) then raise exception 'Profile unavailable' using errcode='42501'; end if;
 return jsonb_build_object('automatic',snoozer.publication_scheduler_ready(),'schedule',(select jsonb_build_object('revision',revision,'runAt',run_at,'state',state,'reason',reason) from snoozer.publication_schedules where profile_id=p_profile));
end $$;

create or replace function snoozer.profile_snapshot(p_profile uuid,p_revision integer,p_public boolean) returns jsonb language sql stable set search_path='' as $$
 select snoozer.profile_snapshot_content(p_profile,p_revision,p_public) || jsonb_build_object('seo',jsonb_build_object('title',v.seo_title,'description',v.seo_description)) ||
 case when p_public then '{}'::jsonb else jsonb_build_object('published_at',coalesce(v.activated_at,v.published_at),'activated',v.activated_at is not null,'scheduled_for',case when s.state='pending' then s.run_at end) end
 from snoozer.published_profiles v left join snoozer.publication_schedules s on s.profile_id=v.profile_id and s.revision=v.revision
 where v.profile_id=p_profile and v.revision=p_revision
$$;

create or replace function public.list_publications(p_profile uuid) returns jsonb language sql stable security definer set search_path='' as $$
 with actor as materialized(select snoozer.verified_user() as id)
 select coalesce(jsonb_agg(jsonb_build_object('revision',v.revision,'display_name',v.display_name,'published_at',coalesce(v.activated_at,v.published_at),'live',v.revision is not distinct from p.published_revision,'activated',v.activated_at is not null,'scheduled_for',case when s.state='pending' then s.run_at end) order by v.revision desc),'[]'::jsonb)
 from actor join snoozer.profiles p on p.owner_id=actor.id and p.id=p_profile
 join snoozer.published_profiles v on v.profile_id=p.id
 left join snoozer.publication_schedules s on s.profile_id=p.id and s.revision=v.revision
$$;

revoke execute on function public.schedule_publication(uuid,integer,timestamptz),public.cancel_publication_schedule(uuid),snoozer.activate_publication_schedule(uuid),public.run_my_publication_schedule(uuid),public.run_due_publications(integer),public.get_my_publication_schedule(uuid) from public,anon,authenticated,service_role;
grant execute on function public.schedule_publication(uuid,integer,timestamptz),public.cancel_publication_schedule(uuid),public.run_my_publication_schedule(uuid),public.get_my_publication_schedule(uuid) to authenticated;
grant execute on function public.run_due_publications(integer) to service_role;

commit;
