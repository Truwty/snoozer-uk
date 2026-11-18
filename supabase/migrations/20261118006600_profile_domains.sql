begin;
create function snoozer.valid_domain(p_host text) returns boolean language sql immutable set search_path='' as $$
 select coalesce(char_length(p_host) between 4 and 220
  and p_host ~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$'
  and p_host !~ '\.(local|localhost|internal|test|invalid|example|onion|onrender\.com|supabase\.co)$'
  and p_host not in ('snoozer.uk','www.snoozer.uk'),false)
$$;
create table snoozer.domain_requests (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 profile_id uuid not null references snoozer.profiles(id) on delete cascade,
 hostname text not null check(snoozer.valid_domain(hostname)),
 challenge uuid not null default gen_random_uuid(),
 created_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '24 hours',
 used_at timestamptz, retired_at timestamptz,
 check_lease uuid, check_until timestamptz, retry_after timestamptz not null default '-infinity'
);
create index domain_requests_owner on snoozer.domain_requests(owner_id,created_at);
create table snoozer.profile_domains (
 hostname text primary key check(snoozer.valid_domain(hostname)),
 owner_id uuid not null references auth.users(id) on delete cascade,
 profile_id uuid not null references snoozer.profiles(id) on delete cascade,
 request_id uuid not null references snoozer.domain_requests(id) on delete cascade,
 state text not null check(state in ('provisioning','active','disconnecting','removed')),
 verified_until timestamptz, removed_at timestamptz, created_at timestamptz not null default now()
);
create unique index profile_domains_one_per_profile on snoozer.profile_domains(profile_id) where state<>'removed';
alter table snoozer.domain_requests enable row level security;
alter table snoozer.profile_domains enable row level security;
revoke all on snoozer.domain_requests,snoozer.profile_domains from public,anon,authenticated,service_role;
revoke execute on function snoozer.valid_domain(text) from public,anon,authenticated,service_role;

create function public.request_profile_domain(p_profile uuid,p_host text) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=snoozer.verified_user();
declare request uuid;
begin
 if not snoozer.valid_domain(p_host) then raise exception 'Invalid public hostname' using errcode='22023'; end if;
 perform 1 from auth.users where id=actor for update;
 if not exists(select 1 from snoozer.profiles where id=p_profile and owner_id=actor) then raise exception 'Profile unavailable' using errcode='42501'; end if;
 if coalesce((select (plan).domains from snoozer.effective_plan(actor)),0)<1 then raise exception 'Custom domains require an eligible plan' using errcode='P1011'; end if;
 select id into request from snoozer.domain_requests where profile_id=p_profile and owner_id=actor and hostname=p_host and retired_at is null and used_at is null and expires_at>now() order by created_at desc limit 1;
 if found then return request; end if;
 if (select count(*) from snoozer.domain_requests where owner_id=actor and created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC')>=5 then raise exception 'Daily domain request limit reached' using errcode='P1001'; end if;
 insert into snoozer.domain_requests(owner_id,profile_id,hostname) values(actor,p_profile,p_host) returning id into request;
 return request;
end $$;

create function public.list_my_domains(p_profile uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=snoozer.verified_user();
begin
 if not exists(select 1 from snoozer.profiles where id=p_profile and owner_id=actor) then raise exception 'Profile unavailable' using errcode='42501'; end if;
 return jsonb_build_object('quota',coalesce((select (plan).domains from snoozer.effective_plan(actor)),0),
  'used',(select count(*) from snoozer.profile_domains where owner_id=actor and state<>'removed'),
  'items',(select coalesce(jsonb_agg(item order by created_at desc),'[]'::jsonb) from (
   select r.created_at,jsonb_build_object('id',r.id,'hostname',r.hostname,'challenge','snoozer-domain='||r.challenge::text,'expiresAt',r.expires_at,
    'verifiedUntil',case when b.request_id=r.id then b.verified_until end,
    'state',case when b.request_id=r.id and b.state<>'removed' then b.state when r.retired_at is not null then 'retired' when r.used_at is not null then 'transferred' when r.expires_at<=now() then 'expired' else 'pending' end) as item
   from snoozer.domain_requests r left join snoozer.profile_domains b on b.hostname=r.hostname
   where r.profile_id=p_profile and r.owner_id=actor order by (b.request_id=r.id and b.state<>'removed') desc nulls last,r.created_at desc limit 100) rows));
end $$;

create function public.disconnect_profile_domain(p_request uuid) returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=snoozer.verified_user();
declare request snoozer.domain_requests;
begin
 select * into request from snoozer.domain_requests where id=p_request and owner_id=actor;
 if not found then raise exception 'Domain request unavailable' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('profile-domain:'||request.hostname,0));
 update snoozer.profile_domains set state='disconnecting',verified_until=null where request_id=p_request and owner_id=actor and state<>'removed';
 if not found then update snoozer.domain_requests set retired_at=now(),check_lease=null,check_until=null where id=p_request; end if;
end $$;

-- Operator calls this before adding a DNS-proven domain to Render; it never provisions a provider resource.
create function public.reserve_domain_provisioning(p_request uuid) returns void language plpgsql security definer set search_path='' as $$
declare request snoozer.domain_requests;
declare quota integer;
begin
 select * into request from snoozer.domain_requests where id=p_request and retired_at is null and used_at is null and expires_at>now();
 if not found then raise exception 'Domain request unavailable' using errcode='22023'; end if;
 perform 1 from auth.users where id=request.owner_id and email_confirmed_at is not null for update;
 if not found or not exists(select 1 from snoozer.profiles where id=request.profile_id and owner_id=request.owner_id) then raise exception 'Owner unavailable' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('profile-domain:'||request.hostname,0));
 select (plan).domains into quota from snoozer.effective_plan(request.owner_id);
 if exists(select 1 from snoozer.profile_domains where hostname=request.hostname and request_id=p_request and state='provisioning') then return; end if;
 if exists(select 1 from snoozer.profile_domains where (hostname=request.hostname or profile_id=request.profile_id) and state<>'removed') then raise exception 'Domain or profile already reserved' using errcode='23505'; end if;
 if (select count(*) from snoozer.profile_domains where owner_id=request.owner_id and state<>'removed')>=coalesce(quota,0) then raise exception 'Domain allowance reached' using errcode='P1011'; end if;
 insert into snoozer.profile_domains(hostname,owner_id,profile_id,request_id,state) values(request.hostname,request.owner_id,request.profile_id,request.id,'provisioning')
 on conflict(hostname) do update set owner_id=excluded.owner_id,profile_id=excluded.profile_id,request_id=excluded.request_id,state='provisioning',verified_until=null,removed_at=null,created_at=now();
end $$;

create function public.claim_domain_check(p_host text,p_request uuid default null,p_actor uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare request snoozer.domain_requests;
declare lease uuid:=gen_random_uuid();
begin
 if p_actor is null then
  select r.* into request from snoozer.profile_domains b join snoozer.domain_requests r on r.id=b.request_id where b.hostname=p_host and b.state='active' and coalesce(b.verified_until,'-infinity')<=now();
 else select * into request from snoozer.domain_requests where id=p_request and hostname=p_host and owner_id=p_actor; end if;
 if not found then return jsonb_build_object('state','unavailable'); end if;
 select * into request from snoozer.domain_requests where id=request.id for update;
 if request.retired_at is not null or (request.used_at is null and request.expires_at<=now())
  or (request.used_at is not null and not exists(select 1 from snoozer.profile_domains where request_id=request.id and state='active')) then return jsonb_build_object('state','unavailable'); end if;
 if request.retry_after>now() or request.check_until>now() then return jsonb_build_object('state','busy'); end if;
 update snoozer.domain_requests set check_lease=lease,check_until=now()+interval '30 seconds',retry_after=now()+interval '1 minute' where id=request.id;
 return jsonb_build_object('state','check','id',request.id,'hostname',request.hostname,'challenge','snoozer-domain='||request.challenge::text,'lease',lease);
end $$;

create function public.complete_domain_check(p_request uuid,p_lease uuid,p_ok boolean) returns boolean language plpgsql security definer set search_path='' as $$
declare request snoozer.domain_requests;
declare bound snoozer.profile_domains;
declare quota integer;
begin
 select * into request from snoozer.domain_requests where id=p_request;
 if not found then return false; end if;
 perform 1 from auth.users where id=request.owner_id for update;
 perform pg_advisory_xact_lock(hashtextextended('profile-domain:'||request.hostname,0));
 select * into request from snoozer.domain_requests where id=p_request for update;
 if request.check_lease is distinct from p_lease or p_lease is null or (request.check_until is null or request.check_until<now()) or request.retired_at is not null then return false; end if;
 update snoozer.domain_requests set check_lease=null,check_until=null where id=p_request;
 select * into bound from snoozer.profile_domains where hostname=request.hostname for update;
 if p_ok is distinct from true then
  update snoozer.profile_domains set verified_until=null where request_id=p_request;
  return false;
 end if;
 if bound.state='disconnecting' or (request.used_at is null and request.expires_at<=now())
  or (request.used_at is not null and bound.request_id is distinct from request.id)
  or not exists(select 1 from auth.users where id=request.owner_id and email_confirmed_at is not null)
  or not exists(select 1 from snoozer.profiles where id=request.profile_id and owner_id=request.owner_id) then return false; end if;
 select (plan).domains into quota from snoozer.effective_plan(request.owner_id);
 if coalesce(quota,0)<1 or (select count(*) from snoozer.profile_domains where owner_id=request.owner_id and state<>'removed' and hostname<>request.hostname)>=quota
  or exists(select 1 from snoozer.profile_domains where profile_id=request.profile_id and hostname<>request.hostname and state<>'removed') then return false; end if;
 insert into snoozer.profile_domains(hostname,owner_id,profile_id,request_id,state,verified_until) values(request.hostname,request.owner_id,request.profile_id,request.id,'active',now()+interval '1 hour')
 on conflict(hostname) do update set owner_id=excluded.owner_id,profile_id=excluded.profile_id,request_id=excluded.request_id,state='active',verified_until=excluded.verified_until,removed_at=null,
  created_at=case when profile_domains.request_id=excluded.request_id then profile_domains.created_at else now() end;
 update snoozer.domain_requests set used_at=coalesce(used_at,now()) where id=p_request;
 return true;
end $$;

-- The operator must first confirm Render removal/404 for this exact binding.
create function public.complete_domain_disconnect(p_host text,p_request uuid) returns boolean language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended('profile-domain:'||p_host,0));
 update snoozer.profile_domains set state='removed',verified_until=null,removed_at=now() where hostname=p_host and request_id=p_request and state='disconnecting';
 if not found then return false; end if;
 update snoozer.domain_requests set retired_at=now(),check_lease=null,check_until=null where id=p_request;
 return true;
end $$;

create function public.cleanup_domain_requests(p_limit integer default 100) returns integer language plpgsql security definer set search_path='' as $$
declare removed integer;
declare total integer;
begin
 if p_limit is null or p_limit not between 1 and 500 then raise exception 'Invalid cleanup limit' using errcode='22023'; end if;
 delete from snoozer.profile_domains where hostname in (select hostname from snoozer.profile_domains where state='removed' and removed_at<now()-interval '30 days' order by removed_at,hostname limit p_limit);
 get diagnostics total=row_count;
 delete from snoozer.domain_requests where id in (
  select r.id from snoozer.domain_requests r where not exists(select 1 from snoozer.profile_domains b where b.request_id=r.id)
   and ((r.used_at is null and r.expires_at<now()-interval '7 days') or coalesce(r.retired_at,r.used_at)<now()-interval '30 days')
  order by r.created_at,r.id limit p_limit);
 get diagnostics removed=row_count;
 return total+removed;
end $$;
revoke execute on function public.cleanup_domain_requests(integer) from public,anon,authenticated,service_role;
grant execute on function public.cleanup_domain_requests(integer) to service_role;

create function snoozer.profile_domain_candidate(p_profile uuid) returns text language sql stable set search_path='' as $$
 with slots as (
  select b.*,row_number() over(order by b.created_at,b.hostname) as slot from snoozer.profile_domains b
  where b.owner_id=(select owner_id from snoozer.profiles where id=p_profile) and b.state<>'removed'
 ) select b.hostname from slots b join snoozer.profiles p on p.id=b.profile_id and p.owner_id=b.owner_id
 join auth.users u on u.id=b.owner_id and u.email_confirmed_at is not null
 where b.profile_id=p_profile and b.state='active' and p.published_revision is not null
 and b.slot<=coalesce((select (plan).domains from snoozer.effective_plan(b.owner_id)),0)
$$;
create function snoozer.ready_profile_domain(p_profile uuid) returns text language sql stable set search_path='' as $$
 select b.hostname from snoozer.profile_domains b where b.profile_id=p_profile and b.hostname=snoozer.profile_domain_candidate(p_profile) and b.verified_until>now()
$$;
revoke execute on function snoozer.profile_domain_candidate(uuid) from public,anon,authenticated,service_role;
create function public.resolve_profile_domain(p_host text) returns jsonb language sql stable security definer set search_path='' as $$
 select case when snoozer.ready_profile_domain(p.id)=b.hostname then jsonb_build_object('state','ready','username',p.username)
  when snoozer.profile_domain_candidate(p.id)=b.hostname and coalesce(b.verified_until,'-infinity')<=now() then jsonb_build_object('state','expired')
  else jsonb_build_object('state','unavailable') end
 from snoozer.profile_domains b join snoozer.profiles p on p.id=b.profile_id and p.owner_id=b.owner_id
 where b.hostname=p_host and b.state<>'removed'
$$;
create or replace function public.get_published_profile(p_name text) returns jsonb language sql stable security definer set search_path='' as $$
 select snoozer.profile_snapshot(p.id,p.published_revision,true) || case when snoozer.ready_profile_domain(p.id) is not null then jsonb_build_object('custom_domain',snoozer.ready_profile_domain(p.id)) when snoozer.profile_domain_candidate(p.id) is not null then jsonb_build_object('domain_renewal',snoozer.profile_domain_candidate(p.id)) else '{}'::jsonb end
 from snoozer.profiles p where p.username=p_name and p.published_revision is not null
$$;

create function snoozer.protect_domain_deletion() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from snoozer.profile_domains where state<>'removed' and (case when tg_table_schema='auth' then owner_id=old.id else profile_id=old.id end)) then
  raise exception 'Disconnect provider domains before deleting this resource' using errcode='P1010';
 end if;
 return old;
end $$;
create trigger protect_profile_domains before delete on snoozer.profiles for each row execute function snoozer.protect_domain_deletion();
create trigger protect_account_domains before delete on auth.users for each row execute function snoozer.protect_domain_deletion();

revoke execute on function snoozer.ready_profile_domain(uuid),snoozer.protect_domain_deletion(),public.request_profile_domain(uuid,text),public.list_my_domains(uuid),public.disconnect_profile_domain(uuid),public.reserve_domain_provisioning(uuid),public.claim_domain_check(text,uuid,uuid),public.complete_domain_check(uuid,uuid,boolean),public.complete_domain_disconnect(text,uuid),public.resolve_profile_domain(text) from public,anon,authenticated,service_role;
grant execute on function public.request_profile_domain(uuid,text),public.list_my_domains(uuid),public.disconnect_profile_domain(uuid) to authenticated;
grant execute on function public.reserve_domain_provisioning(uuid),public.claim_domain_check(text,uuid,uuid),public.complete_domain_check(uuid,uuid,boolean),public.complete_domain_disconnect(text,uuid) to service_role;
grant execute on function public.resolve_profile_domain(text) to anon,authenticated;
commit;
