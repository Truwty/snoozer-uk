
-- Owner security: session registry validation, safe session revocation and operational metrics.
create or replace function snoozer.verified_user() returns uuid
language plpgsql stable set search_path='' as $$
declare actor uuid:=auth.uid(); sid text:=auth.jwt()->>'session_id';
begin
 if actor is null or not exists(select 1 from auth.users where id=actor and email_confirmed_at is not null) then
  raise exception 'Verified account required' using errcode='42501';
 end if;
 if sid is not null and (sid !~ '^[0-9a-f-]{36}$'
   or not exists(select 1 from auth.sessions where id=sid::uuid and user_id=actor and (not_after is null or not_after>now()))) then
  raise exception 'Session revoked or expired' using errcode='42501';
 end if;
 if not exists(select 1 from snoozer.platform_owners where owner_id=actor)
  and exists(select 1 from snoozer.account_restrictions r where r.user_id=actor
   and r.revoked_at is null and (r.ends_at is null or r.ends_at>now())) then
  raise exception 'Account temporarily restricted' using errcode='42501';
 end if;
 return actor;
end $$;

create or replace function snoozer.admin_actor(p_write boolean default false) returns uuid
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=snoozer.verified_user(); sid text:=auth.jwt()->>'session_id';
begin
 if not exists(select 1 from snoozer.platform_owners where owner_id=actor) then
  raise exception 'Owner access required' using errcode='42501';
 end if;
 if p_write and (coalesce(auth.jwt()->>'aal','')<>'aal2' or sid is null or sid !~ '^[0-9a-f-]{36}$'
   or not exists(select 1 from auth.sessions where id=sid::uuid and user_id=actor and (not_after is null or not_after>now()))) then
  raise exception 'Active Owner MFA session required' using errcode='42501';
 end if;
 return actor;
end $$;

create function public.my_account_restriction() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid();
begin
 if actor is null or not exists(select 1 from auth.users where id=actor and email_confirmed_at is not null) then
  raise exception 'Verified account required' using errcode='42501';
 end if;
 if exists(select 1 from snoozer.platform_owners where owner_id=actor) then return null; end if;
 return (select jsonb_build_object('kind',r.kind,'reason',r.reason,'ends_at',r.ends_at,
  'appealable_cases',(select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'category',c.category,'status',c.status)),'[]'::jsonb)
   from snoozer.moderation_cases c where c.target_id=actor and c.status in ('actioned','closed','appealed')))
 from snoozer.account_restrictions r where r.user_id=actor and r.revoked_at is null and (r.ends_at is null or r.ends_at>now())
 order by r.created_at desc limit 1);
end $$;
revoke all on function public.my_account_restriction() from public,anon,authenticated,service_role;
grant execute on function public.my_account_restriction() to authenticated;

create function public.owner_revoke_sessions(p_user uuid,p_reason text) returns integer
language plpgsql security definer set search_path='' as $$
declare actor uuid:=snoozer.admin_actor(true); removed integer;
begin
 if p_user=actor or exists(select 1 from snoozer.platform_owners where owner_id=p_user) then
  raise exception 'Owner session protected' using errcode='42501';
 end if;
 if not exists(select 1 from auth.users where id=p_user) or length(coalesce(p_reason,'')) not between 8 and 500 then
  raise exception 'Invalid account or reason' using errcode='22023';
 end if;
 delete from auth.sessions where user_id=p_user;
 get diagnostics removed=row_count;
 insert into snoozer.admin_audit_events(actor_id,target_id,action,reason,details)
 values(actor,p_user,'session.revoke',p_reason,jsonb_build_object('sessions',removed));
 return removed;
end $$;
revoke all on function public.owner_revoke_sessions(uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.owner_revoke_sessions(uuid,text) to authenticated;

create function public.owner_session_summary(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=snoozer.admin_actor();
begin
 return (select jsonb_build_object('active_sessions',count(*),'latest_login',max(created_at))
 from auth.sessions where user_id=p_user);
end $$;
revoke all on function public.owner_session_summary(uuid) from public,anon,authenticated,service_role;
grant execute on function public.owner_session_summary(uuid) to authenticated;

create function public.owner_analytics_days(p_days integer default 30) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=snoozer.admin_actor();
begin
 return coalesce((select jsonb_agg(to_jsonb(r)) from (
  select day,sum(views)::bigint as views,sum(clicks)::bigint as clicks
  from snoozer.profile_view_days where day >= (now() at time zone 'utc')::date - least(greatest(coalesce(p_days,30),1),90)
  group by day order by day desc
 ) r),'[]'::jsonb);
end $$;
revoke all on function public.owner_analytics_days(integer) from public,anon,authenticated,service_role;
grant execute on function public.owner_analytics_days(integer) to authenticated;

create function public.owner_system_health() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=snoozer.admin_actor();
begin
 return jsonb_build_object(
 'active_sessions',(select count(*) from auth.sessions),
 'verified_accounts',(select count(*) from auth.users where email_confirmed_at is not null),
 'new_accounts_24h',(select count(*) from auth.users where created_at>=now()-interval '24 hours'),
 'active_restrictions',(select count(*) from snoozer.account_restrictions where revoked_at is null and (ends_at is null or ends_at>now())),
 'open_cases',(select count(*) from snoozer.moderation_cases where status in ('open','review','appealed')),
 'latest_admin_action',(select max(occurred_at) from snoozer.admin_audit_events)
 );
end $$;
revoke all on function public.owner_system_health() from public,anon,authenticated,service_role;
grant execute on function public.owner_system_health() to authenticated;

create function public.owner_audit_page(p_before bigint default null,p_limit integer default 50) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=snoozer.admin_actor();
begin
 return coalesce((select jsonb_agg(to_jsonb(r)) from (
 select id,actor_id,target_id,action,reason,details,occurred_at
 from snoozer.admin_audit_events where p_before is null or id<p_before
 order by id desc limit least(greatest(coalesce(p_limit,50),1),100)
 ) r),'[]'::jsonb);
end $$;
revoke all on function public.owner_audit_page(bigint,integer) from public,anon,authenticated,service_role;
grant execute on function public.owner_audit_page(bigint,integer) to authenticated;
