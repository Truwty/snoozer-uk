
-- Owner administration: private data, narrowly scoped RPCs, MFA-gated writes.
create table snoozer.admin_audit_events (
 id bigint generated always as identity primary key,
 actor_id uuid not null references auth.users(id),
 target_id uuid,
 action text not null check(length(action) between 3 and 72),
 reason text,
 details jsonb not null default '{}'::jsonb,
 occurred_at timestamptz not null default now()
);
create index admin_audit_recent on snoozer.admin_audit_events(occurred_at desc,id desc);
create table snoozer.account_restrictions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id),
 kind text not null check(kind in ('suspension','ban')),
 reason text not null check(length(reason) between 8 and 500),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 ends_at timestamptz,
 revoked_at timestamptz,
 revoked_by uuid references auth.users(id),
 check(kind='ban' or ends_at is not null)
);
create index active_restrictions_user on snoozer.account_restrictions(user_id,ends_at) where revoked_at is null;
create table snoozer.admin_notes (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id),
 actor_id uuid not null references auth.users(id),
 note text not null check(length(note) between 5 and 2000),
 created_at timestamptz not null default now()
);
create table snoozer.moderation_cases (
 id uuid primary key default gen_random_uuid(),
 target_id uuid references auth.users(id),
 profile_id uuid references snoozer.profiles(id),
 category text not null check(category in ('spam','phishing','impersonation','harassment','malware','copyright','other')),
 status text not null default 'open' check(status in ('open','review','actioned','closed','appealed')),
 reason text not null check(length(reason) between 8 and 1000),
 opened_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index moderation_cases_queue on snoozer.moderation_cases(status,created_at desc);
create table snoozer.admin_grant_records (
 grant_id uuid primary key references snoozer.entitlement_grants(id),
 actor_id uuid not null references auth.users(id),
 reason text not null check(length(reason) between 8 and 500),
 created_at timestamptz not null default now()
);
create table snoozer.platform_settings (
 name text primary key check(name in ('registrations_enabled')),
 value boolean not null,
 revision integer not null default 1,
 updated_at timestamptz not null default now(),
 updated_by uuid references auth.users(id)
);
insert into snoozer.platform_settings(name,value) values('registrations_enabled',true);
alter table snoozer.admin_audit_events enable row level security;
alter table snoozer.account_restrictions enable row level security;
alter table snoozer.admin_notes enable row level security;
alter table snoozer.moderation_cases enable row level security;
alter table snoozer.admin_grant_records enable row level security;
alter table snoozer.platform_settings enable row level security;
revoke all on snoozer.admin_audit_events,snoozer.account_restrictions,snoozer.admin_notes,snoozer.moderation_cases,snoozer.admin_grant_records,snoozer.platform_settings from public,anon,authenticated,service_role;
revoke all on sequence snoozer.admin_audit_events_id_seq from public,anon,authenticated,service_role;

create function snoozer.admin_actor(p_write boolean default false) returns uuid
language plpgsql stable security definer set search_path='' as $$
declare actor uuid := snoozer.verified_user();
begin
 if not exists(select 1 from snoozer.platform_owners where owner_id=actor) then
  raise exception 'Owner access required' using errcode='42501';
 end if;
 if p_write and coalesce(auth.jwt()->>'aal','') <> 'aal2' then
  raise exception 'Owner administration requires MFA (AAL2)' using errcode='42501';
 end if;
 return actor;
end $$;
revoke all on function snoozer.admin_actor(boolean) from public,anon,authenticated,service_role;

-- Server-side checks include account restrictions even for existing sessions.
-- The Owner registry is deliberately exempt from account bans to avoid lockouts.
create or replace function snoozer.verified_user() returns uuid
language plpgsql stable set search_path='' as $$
declare actor uuid := auth.uid();
begin
 if actor is null or not exists(select 1 from auth.users where id=actor and email_confirmed_at is not null) then
   raise exception 'Verified account required' using errcode='42501';
 end if;
 if not exists(select 1 from snoozer.platform_owners where owner_id=actor)
   and exists(select 1 from snoozer.account_restrictions r where r.user_id=actor
     and r.revoked_at is null and (r.ends_at is null or r.ends_at>now())) then
   raise exception 'Account temporarily restricted' using errcode='42501';
 end if;
 return actor;
end $$;

create function public.owner_user_search(p_query text default '', p_limit integer default 30)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid := snoozer.admin_actor();
begin
 if char_length(coalesce(p_query,''))>120 then raise exception 'Search too long' using errcode='22023'; end if;
 return coalesce((select jsonb_agg(to_jsonb(a)) from (
  select u.id, u.email, u.email_confirmed_at is not null as verified, u.created_at,
     (select count(*) from snoozer.profiles p where p.owner_id=u.id) as profile_count,
     exists(select 1 from snoozer.account_restrictions r where r.user_id=u.id and r.revoked_at is null and (r.ends_at is null or r.ends_at>now())) as restricted,
     exists(select 1 from snoozer.platform_owners o where o.owner_id=u.id) as is_owner
  from auth.users u
  where p_query='' or u.id::text=p_query or u.email ilike '%'||replace(replace(p_query,'%','\%'),'_','\_')||'%' escape '\'
   or exists(select 1 from snoozer.profiles p where p.owner_id=u.id and p.username ilike '%'||replace(replace(p_query,'%','\%'),'_','\_')||'%' escape '\')
  order by u.created_at desc,u.id desc limit least(greatest(coalesce(p_limit,30),1),100)
 ) a),'[]'::jsonb);
end $$;

create function public.owner_user_detail(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid := snoozer.admin_actor();
begin
 return (select jsonb_build_object('id',u.id,'email',u.email,'created_at',u.created_at,
  'verified',u.email_confirmed_at is not null,
  'is_owner',exists(select 1 from snoozer.platform_owners where owner_id=u.id),
  'profiles',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'username',p.username,'published',p.published_revision is not null)),'[]'::jsonb) from snoozer.profiles p where p.owner_id=u.id),
  'restrictions',(select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'kind',r.kind,'reason',r.reason,'ends_at',r.ends_at,'revoked_at',r.revoked_at,'created_at',r.created_at) order by r.created_at desc),'[]'::jsonb) from snoozer.account_restrictions r where r.user_id=u.id),
  'grants',(select coalesce(jsonb_agg(jsonb_build_object('id',g.id,'plan',g.plan,'source',g.source,'expires_at',g.expires_at,'revoked_at',g.revoked_at) order by g.starts_at desc),'[]'::jsonb) from snoozer.entitlement_grants g where g.owner_id=u.id),
  'notes',(select coalesce(jsonb_agg(jsonb_build_object('note',n.note,'created_at',n.created_at) order by n.created_at desc),'[]'::jsonb) from snoozer.admin_notes n where n.user_id=u.id)
 ) from auth.users u where u.id=p_user);
end $$;

create function public.owner_restrict_account(p_user uuid,p_kind text,p_reason text,p_days integer default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid := snoozer.admin_actor(true); ticket uuid;
begin
 if p_user=actor or exists(select 1 from snoozer.platform_owners where owner_id=p_user) then
  raise exception 'Owner accounts cannot be restricted' using errcode='42501';
 end if;
 if not exists(select 1 from auth.users where id=p_user) then raise exception 'Account not found' using errcode='22023'; end if;
 if p_kind not in ('ban','suspension') or char_length(coalesce(p_reason,'')) not between 8 and 500
 or (p_kind='suspension' and (p_days is null or p_days not between 1 and 365)) then raise exception 'Invalid restriction' using errcode='22023'; end if;
 if exists(select 1 from snoozer.account_restrictions where user_id=p_user and revoked_at is null and (ends_at is null or ends_at>now())) then
  raise exception 'Active restriction already exists' using errcode='23505';
 end if;
 insert into snoozer.account_restrictions(user_id,kind,reason,created_by,ends_at)
 values(p_user,p_kind,p_reason,actor,case when p_kind='suspension' then now()+make_interval(days=>p_days) else null end) returning id into ticket;
 insert into snoozer.admin_audit_events(actor_id,target_id,action,reason,details)
 values(actor,p_user,'account.restrict',p_reason,jsonb_build_object('restriction_id',ticket,'kind',p_kind,'days',p_days));
 return ticket;
end $$;

create function public.owner_lift_restriction(p_id uuid,p_reason text) returns boolean
language plpgsql security definer set search_path='' as $$
declare actor uuid := snoozer.admin_actor(true); target uuid;
begin
 if length(coalesce(p_reason,'')) not between 8 and 500 then raise exception 'Reason required' using errcode='22023'; end if;
 update snoozer.account_restrictions set revoked_at=now(),revoked_by=actor where id=p_id and revoked_at is null returning user_id into target;
 if target is null then return false; end if;
 insert into snoozer.admin_audit_events(actor_id,target_id,action,reason,details)
 values(actor,target,'account.reinstate',p_reason,jsonb_build_object('restriction_id',p_id));
 return true;
end $$;

create function public.owner_add_note(p_user uuid,p_note text) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid := snoozer.admin_actor(true); note_id uuid;
begin
 if length(coalesce(p_note,'')) not between 5 and 2000 then raise exception 'Invalid note' using errcode='22023'; end if;
 insert into snoozer.admin_notes(user_id,actor_id,note) values(p_user,actor,p_note) returning id into note_id;
 insert into snoozer.admin_audit_events(actor_id,target_id,action,details) values(actor,p_user,'account.note',jsonb_build_object('note_id',note_id));
 return note_id;
end $$;

create function public.owner_grant_premium(p_user uuid,p_plan text,p_days integer,p_reason text) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid := snoozer.admin_actor(true); g uuid := gen_random_uuid(); v integer;
begin
 if p_user=actor or exists(select 1 from snoozer.platform_owners where owner_id=p_user) then raise exception 'Owner grant forbidden' using errcode='42501'; end if;
 if not exists(select 1 from auth.users where id=p_user and email_confirmed_at is not null) then raise exception 'Verified account required' using errcode='22023'; end if;
 if p_plan not in ('plus','pro','studio') or p_days not between 1 and 3650 or length(coalesce(p_reason,'')) not between 8 and 500 then raise exception 'Invalid grant' using errcode='22023'; end if;
 select max(version) into v from snoozer.plan_versions where plan=p_plan;
 if v is null then raise exception 'Unknown plan' using errcode='22023'; end if;
 insert into snoozer.entitlement_grants(id,owner_id,plan,plan_version,source,source_ref,starts_at,expires_at)
 values(g,p_user,p_plan,v,'staff','owner:'||g::text,now(),now()+make_interval(days=>p_days));
 insert into snoozer.admin_grant_records(grant_id,actor_id,reason) values(g,actor,p_reason);
 insert into snoozer.admin_audit_events(actor_id,target_id,action,reason,details)
 values(actor,p_user,'premium.grant',p_reason,jsonb_build_object('grant_id',g,'plan',p_plan,'days',p_days));
 return g;
end $$;

create function public.owner_revoke_grant(p_id uuid,p_reason text) returns boolean
language plpgsql security definer set search_path='' as $$
declare actor uuid := snoozer.admin_actor(true); target uuid;
begin
 if length(coalesce(p_reason,'')) not between 8 and 500 then raise exception 'Reason required' using errcode='22023'; end if;
 update snoozer.entitlement_grants set revoked_at=now()
 where id=p_id and source='staff' and source_ref like 'owner:%' and revoked_at is null
 returning owner_id into target;
 if target is null then return false; end if;
 insert into snoozer.admin_audit_events(actor_id,target_id,action,reason,details)
 values(actor,target,'premium.revoke',p_reason,jsonb_build_object('grant_id',p_id));
 return true;
end $$;

create function public.owner_create_case(p_user uuid,p_category text,p_reason text) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid := snoozer.admin_actor(true); c uuid;
begin
 if p_category not in ('spam','phishing','impersonation','harassment','malware','copyright','other')
 or length(coalesce(p_reason,'')) not between 8 and 1000 then raise exception 'Invalid case' using errcode='22023'; end if;
 insert into snoozer.moderation_cases(target_id,category,reason,opened_by) values(p_user,p_category,p_reason,actor) returning id into c;
 insert into snoozer.admin_audit_events(actor_id,target_id,action,details)
 values(actor,p_user,'moderation.open',jsonb_build_object('case_id',c,'category',p_category));
 return c;
end $$;

create function public.owner_update_case(p_id uuid,p_status text,p_reason text) returns boolean
language plpgsql security definer set search_path='' as $$
declare actor uuid := snoozer.admin_actor(true); target uuid;
begin
 if p_status not in ('open','review','actioned','closed','appealed') or length(coalesce(p_reason,'')) not between 8 and 500 then raise exception 'Invalid status/reason' using errcode='22023'; end if;
 update snoozer.moderation_cases set status=p_status,updated_at=now() where id=p_id returning target_id into target;
 if not found then return false; end if;
 insert into snoozer.admin_audit_events(actor_id,target_id,action,reason,details)
 values(actor,target,'moderation.status',p_reason,jsonb_build_object('case_id',p_id,'status',p_status));
 return true;
end $$;

create function public.owner_cases(p_limit integer default 30) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid := snoozer.admin_actor();
begin
 return coalesce((select jsonb_agg(to_jsonb(c)) from (
 select id,target_id,category,status,reason,created_at,updated_at from snoozer.moderation_cases
 order by created_at desc,id desc limit least(greatest(coalesce(p_limit,30),1),100)) c),'[]'::jsonb);
end $$;

create function public.owner_audit(p_limit integer default 50) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid := snoozer.admin_actor();
begin
 return coalesce((select jsonb_agg(to_jsonb(e)) from (
 select id,actor_id,target_id,action,reason,details,occurred_at from snoozer.admin_audit_events
 order by occurred_at desc,id desc limit least(greatest(coalesce(p_limit,50),1),100)) e),'[]'::jsonb);
end $$;

create function public.owner_get_settings() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid := snoozer.admin_actor();
begin
 return coalesce((select jsonb_object_agg(name,jsonb_build_object('value',value,'revision',revision,'updated_at',updated_at)) from snoozer.platform_settings),'{}'::jsonb);
end $$;
create function public.owner_set_setting(p_name text,p_value boolean,p_revision integer,p_reason text) returns boolean
language plpgsql security definer set search_path='' as $$
declare actor uuid := snoozer.admin_actor(true); old_value boolean;
begin
 if length(coalesce(p_reason,'')) not between 8 and 500 then raise exception 'Reason required' using errcode='22023'; end if;
 select value into old_value from snoozer.platform_settings where name=p_name and revision=p_revision for update;
 if not found then raise exception 'Stale or invalid setting' using errcode='40001'; end if;
 update snoozer.platform_settings set value=p_value,revision=revision+1,updated_at=now(),updated_by=actor where name=p_name;
 insert into snoozer.admin_audit_events(actor_id,action,reason,details)
 values(actor,'settings.update',p_reason,jsonb_build_object('setting',p_name,'old',old_value,'new',p_value));
 return true;
end $$;
-- Anonymous read exposes only a non-sensitive boolean; registration checks it before signUp.
create function public.registration_is_enabled() returns boolean
language sql stable security definer set search_path='' as $$
 select value from snoozer.platform_settings where name='registrations_enabled'
$$;

do $$
declare name text; args text;
begin
 for name,args in select p.proname,pg_get_function_identity_arguments(p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in (
 'owner_user_search','owner_user_detail','owner_restrict_account','owner_lift_restriction','owner_add_note',
 'owner_grant_premium','owner_revoke_grant','owner_create_case','owner_update_case','owner_cases',
 'owner_audit','owner_get_settings','owner_set_setting','registration_is_enabled'
 ) loop
 execute format('revoke all on function public.%I(%s) from public,anon,authenticated,service_role',name,args);
 if name='registration_is_enabled' then
  execute format('grant execute on function public.%I(%s) to anon,authenticated',name,args);
 else
  execute format('grant execute on function public.%I(%s) to authenticated',name,args);
 end if;
 end loop;
end $$;
