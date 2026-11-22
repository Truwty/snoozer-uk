
-- Public reports, user appeals, owner moderation tools and published-profile quarantine.
create table snoozer.moderation_reports (
 id uuid primary key default gen_random_uuid(),
 reporter_id uuid not null references auth.users(id),
 profile_id uuid not null references snoozer.profiles(id),
 category text not null check(category in ('spam','phishing','impersonation','harassment','malware','copyright','other')),
 reason text not null check(length(reason) between 15 and 1000),
 case_id uuid references snoozer.moderation_cases(id),
 created_at timestamptz not null default now()
);
create index moderation_report_queue on snoozer.moderation_reports(case_id,created_at desc);
create index moderation_reports_actor on snoozer.moderation_reports(reporter_id,created_at desc);
create table snoozer.moderation_appeals (
 id uuid primary key default gen_random_uuid(),
 case_id uuid not null references snoozer.moderation_cases(id),
 user_id uuid not null references auth.users(id),
 reason text not null check(length(reason) between 15 and 1000),
 status text not null default 'open' check(status in ('open','review','accepted','rejected')),
 response text,
 reviewed_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 reviewed_at timestamptz
);
create index moderation_appeals_queue on snoozer.moderation_appeals(status,created_at desc);
create table snoozer.moderated_profiles (
 profile_id uuid primary key references snoozer.profiles(id) on delete cascade,
 case_id uuid not null references snoozer.moderation_cases(id),
 reason text not null check(length(reason) between 8 and 500),
 blocked_at timestamptz not null default now(),
 blocked_by uuid not null references auth.users(id),
 unblocked_at timestamptz,
 unblocked_by uuid references auth.users(id)
);
alter table snoozer.moderation_reports enable row level security;
alter table snoozer.moderation_appeals enable row level security;
alter table snoozer.moderated_profiles enable row level security;
revoke all on snoozer.moderation_reports,snoozer.moderation_appeals,snoozer.moderated_profiles from public,anon,authenticated,service_role;

create function snoozer.public_profile_blocked(p_profile uuid,p_owner uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from snoozer.moderated_profiles q where q.profile_id=p_profile and q.unblocked_at is null)
  or exists(select 1 from snoozer.account_restrictions r where r.user_id=p_owner
    and r.revoked_at is null and (r.ends_at is null or r.ends_at>now()))
$$;
revoke all on function snoozer.public_profile_blocked(uuid,uuid) from public,anon,authenticated,service_role;

-- Route and renderer must agree on the same publication visibility decision.
create or replace function public.get_published_profile(p_name text) returns jsonb
language sql stable security definer set search_path='' as $$
 select snoozer.profile_snapshot(p.id,p.published_revision,true) ||
 case when snoozer.ready_profile_domain(p.id) is not null
    then jsonb_build_object('custom_domain',snoozer.ready_profile_domain(p.id))
      when snoozer.profile_domain_candidate(p.id) is not null
    then jsonb_build_object('domain_renewal',snoozer.profile_domain_candidate(p.id))
      else '{}'::jsonb end
 from snoozer.profiles p
 where p.username=p_name and p.published_revision is not null
   and not snoozer.public_profile_blocked(p.id,p.owner_id)
$$;
create or replace function public.resolve_public_address(p_name text) returns text
language sql stable security definer set search_path='' as $$
 select p.username from snoozer.profiles p
 where p.published_revision is not null
   and (p.username=p_name or p.username=public.resolve_profile_alias(p_name))
   and not snoozer.public_profile_blocked(p.id,p.owner_id)
 order by (p.username=p_name) desc limit 1
$$;
create or replace function public.published_profile_exists(p_name text) returns boolean
language sql stable security definer set search_path='' as $$
 select public.resolve_public_address(p_name) is not null
$$;
create or replace function public.list_indexable_profile_sitemap()
returns table(username text,last_modified timestamptz)
language sql stable security definer set search_path='' as $$
 select p.username,coalesce(v.activated_at,v.published_at)
 from snoozer.profiles p
 join snoozer.published_profiles v on v.profile_id=p.id and v.revision=p.published_revision
 where p.published_revision is not null and v.activated_at is not null and v.indexable
   and snoozer.ready_profile_domain(p.id) is null
   and not snoozer.public_profile_blocked(p.id,p.owner_id)
 order by p.username
$$;

create function public.submit_profile_report(p_name text,p_category text,p_reason text)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=snoozer.verified_user(); target uuid; report_id uuid;
begin
 if p_category not in ('spam','phishing','impersonation','harassment','malware','copyright','other')
 or length(coalesce(p_reason,'')) not between 15 and 1000 then
  raise exception 'Invalid report' using errcode='22023';
 end if;
 select id into target from snoozer.profiles where username=p_name and published_revision is not null;
 if target is null then raise exception 'Profile not found' using errcode='22023'; end if;
 if exists(select 1 from snoozer.profiles where id=target and owner_id=actor) then
  raise exception 'Cannot report own profile' using errcode='42501';
 end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text, 527));
 if (select count(*) from snoozer.moderation_reports where reporter_id=actor and created_at>now()-interval '24 hours')>=3
   or exists(select 1 from snoozer.moderation_reports where reporter_id=actor and profile_id=target and created_at>now()-interval '24 hours') then
  raise exception 'Reporting limit reached' using errcode='42901';
 end if;
 insert into snoozer.moderation_reports(reporter_id,profile_id,category,reason)
 values(actor,target,p_category,p_reason) returning id into report_id;
 return report_id;
end $$;
create function public.submit_moderation_appeal(p_case uuid,p_reason text)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); appeal_id uuid;
begin
 if actor is null or not exists(select 1 from auth.users where id=actor and email_confirmed_at is not null) then
  raise exception 'Verified account required' using errcode='42501';
 end if;
 if length(coalesce(p_reason,'')) not between 15 and 1000 then raise exception 'Invalid appeal' using errcode='22023'; end if;
 if not exists(select 1 from snoozer.moderation_cases where id=p_case and target_id=actor and status in ('actioned','closed','appealed')) then
  raise exception 'Case is not appealable' using errcode='42501';
 end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text, 528));
 if exists(select 1 from snoozer.moderation_appeals where case_id=p_case and user_id=actor and status in ('open','review'))
  or (select count(*) from snoozer.moderation_appeals where user_id=actor and created_at>now()-interval '24 hours')>=2 then
  raise exception 'Appeal limit reached' using errcode='42901';
 end if;
 insert into snoozer.moderation_appeals(case_id,user_id,reason)
 values(p_case,actor,p_reason) returning id into appeal_id;
 update snoozer.moderation_cases set status='appealed',updated_at=now() where id=p_case;
 return appeal_id;
end $$;

create function public.owner_reports(p_limit integer default 50) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=snoozer.admin_actor();
begin
 return coalesce((select jsonb_agg(to_jsonb(r)) from
 (select r.id,r.reporter_id,r.profile_id,p.username,r.category,r.reason,r.case_id,r.created_at
 from snoozer.moderation_reports r join snoozer.profiles p on p.id=r.profile_id
 order by r.created_at desc,r.id desc limit least(greatest(coalesce(p_limit,50),1),100)) r),'[]'::jsonb);
end $$;

create function public.owner_appeals(p_limit integer default 50) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=snoozer.admin_actor();
begin
 return coalesce((select jsonb_agg(to_jsonb(a)) from
 (select id,case_id,user_id,reason,status,response,created_at,reviewed_at
 from snoozer.moderation_appeals
 order by created_at desc,id desc limit least(greatest(coalesce(p_limit,50),1),100)) a),'[]'::jsonb);
end $$;

create function public.owner_triage_report(p_report uuid,p_reason text) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=snoozer.admin_actor(true); r snoozer.moderation_reports; target uuid; c uuid;
begin
 if length(coalesce(p_reason,'')) not between 8 and 500 then raise exception 'Reason required' using errcode='22023'; end if;
 select * into r from snoozer.moderation_reports where id=p_report for update;
 if not found then raise exception 'Report not found' using errcode='22023'; end if;
 if r.case_id is not null then return r.case_id; end if;
 select owner_id into target from snoozer.profiles where id=r.profile_id;
 insert into snoozer.moderation_cases(target_id,profile_id,category,reason,opened_by)
 values(target,r.profile_id,r.category,r.reason,actor) returning id into c;
 update snoozer.moderation_reports set case_id=c where id=p_report;
 insert into snoozer.admin_audit_events(actor_id,target_id,action,reason,details)
 values(actor,target,'moderation.triage',p_reason,jsonb_build_object('report_id',p_report,'case_id',c));
 return c;
end $$;

create function public.owner_review_appeal(p_appeal uuid,p_status text,p_response text)
returns boolean language plpgsql security definer set search_path='' as $$
declare actor uuid:=snoozer.admin_actor(true); a snoozer.moderation_appeals;
begin
 if p_status not in ('review','accepted','rejected') or length(coalesce(p_response,'')) not between 8 and 1000 then
  raise exception 'Invalid appeal response' using errcode='22023'; end if;
 select * into a from snoozer.moderation_appeals where id=p_appeal for update;
 if not found then return false; end if;
 if a.status in ('accepted','rejected') then raise exception 'Appeal already resolved' using errcode='22023'; end if;
 update snoozer.moderation_appeals set status=p_status,response=p_response,reviewed_by=actor,
  reviewed_at=case when p_status='review' then null else now() end where id=p_appeal;
 insert into snoozer.admin_audit_events(actor_id,target_id,action,reason,details)
 values(actor,a.user_id,'moderation.appeal',p_response,jsonb_build_object('appeal_id',p_appeal,'status',p_status));
 return true;
end $$;

create function public.owner_block_profile(p_case uuid,p_reason text) returns boolean
language plpgsql security definer set search_path='' as $$
declare actor uuid:=snoozer.admin_actor(true); c snoozer.moderation_cases;
begin
 if length(coalesce(p_reason,'')) not between 8 and 500 then raise exception 'Reason required' using errcode='22023'; end if;
 select * into c from snoozer.moderation_cases where id=p_case for update;
 if c.id is null or c.profile_id is null then raise exception 'Case must identify a profile' using errcode='22023'; end if;
 if exists(select 1 from snoozer.platform_owners where owner_id=c.target_id) then raise exception 'Owner profile protected' using errcode='42501'; end if;
 insert into snoozer.moderated_profiles(profile_id,case_id,reason,blocked_by)
 values(c.profile_id,p_case,p_reason,actor)
 on conflict(profile_id) do update set case_id=p_case,reason=p_reason,blocked_by=actor,
  blocked_at=now(),unblocked_at=null,unblocked_by=null;
 update snoozer.moderation_cases set status='actioned',updated_at=now() where id=p_case;
 insert into snoozer.admin_audit_events(actor_id,target_id,action,reason,details)
 values(actor,c.target_id,'profile.block',p_reason,jsonb_build_object('case_id',p_case,'profile_id',c.profile_id));
 return true;
end $$;
create function public.owner_unblock_profile(p_case uuid,p_reason text) returns boolean
language plpgsql security definer set search_path='' as $$
declare actor uuid:=snoozer.admin_actor(true); c snoozer.moderation_cases;
begin
 if length(coalesce(p_reason,'')) not between 8 and 500 then raise exception 'Reason required' using errcode='22023'; end if;
 select * into c from snoozer.moderation_cases where id=p_case for update;
 if not found or c.profile_id is null then return false; end if;
 update snoozer.moderated_profiles set unblocked_at=now(),unblocked_by=actor
 where profile_id=c.profile_id and unblocked_at is null;
 if not found then return false; end if;
 insert into snoozer.admin_audit_events(actor_id,target_id,action,reason,details)
 values(actor,c.target_id,'profile.unblock',p_reason,jsonb_build_object('case_id',p_case,'profile_id',c.profile_id));
 return true;
end $$;
create function public.owner_takedown_gallery(p_case uuid,p_image uuid,p_reason text) returns text
language plpgsql security definer set search_path='' as $$
declare actor uuid:=snoozer.admin_actor(true); c snoozer.moderation_cases; n text; result text;
begin
 if length(coalesce(p_reason,'')) not between 8 and 500 then raise exception 'Reason required' using errcode='22023'; end if;
 select * into c from snoozer.moderation_cases where id=p_case for update;
 if not found or c.profile_id is null then raise exception 'Profile-linked case required' using errcode='22023'; end if;
 select username into n from snoozer.profiles where id=c.profile_id and owner_id=c.target_id;
 if n is null then raise exception 'Case target mismatch' using errcode='42501'; end if;
 select public.take_down_gallery_image(n,p_image,p_case::text) into result;
 if result='blocked' then
  insert into snoozer.admin_audit_events(actor_id,target_id,action,reason,details)
  values(actor,c.target_id,'media.takedown',p_reason,jsonb_build_object('case_id',p_case,'image_id',p_image));
 end if;
 return result;
end $$;

do $$
declare name text; args text;
begin
 for name,args in select p.proname,pg_get_function_identity_arguments(p.oid)
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in
 ('submit_profile_report','submit_moderation_appeal','owner_reports','owner_appeals',
  'owner_triage_report','owner_review_appeal','owner_block_profile','owner_unblock_profile','owner_takedown_gallery') loop
 execute format('revoke all on function public.%I(%s) from public,anon,authenticated,service_role',name,args);
 execute format('grant execute on function public.%I(%s) to authenticated',name,args);
 end loop;
end $$;
