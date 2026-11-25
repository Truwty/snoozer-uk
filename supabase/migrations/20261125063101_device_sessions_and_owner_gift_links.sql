-- Device sessions and single-use Owner issued Premium links.
begin;
create table snoozer.owner_gift_links(
 id uuid primary key default gen_random_uuid(),
 token_hash bytea not null unique check(octet_length(token_hash)=32),
 plan text not null, plan_version integer not null,
 duration_days integer not null check(duration_days between 1 and 366),
 created_by uuid not null references auth.users(id),
 reason text not null check(char_length(reason) between 8 and 500),
 created_at timestamptz not null default now(), expires_at timestamptz not null,
 claimed_by uuid references auth.users(id) on delete set null, claimed_at timestamptz,
 entitlement_id uuid references snoozer.entitlement_grants(id) on delete set null,
 revoked_at timestamptz,
 foreign key(plan,plan_version) references snoozer.plan_versions(plan,version),
 check(expires_at>created_at), check((claimed_by is null)=(claimed_at is null))
);
create index owner_gift_links_owner_recent on snoozer.owner_gift_links(created_by,created_at desc);
alter table snoozer.owner_gift_links enable row level security;
revoke all on snoozer.owner_gift_links from public,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.list_my_device_sessions()
 RETURNS TABLE(session_id uuid, created_at timestamp with time zone, refreshed_at timestamp with time zone, last_active_at timestamp with time zone, user_agent text, tag text, aal text, is_current boolean, expires_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare actor uuid:=snoozer.verified_user(); current_session text:=auth.jwt()->>'session_id';
begin
 return query
 select s.id,s.created_at,s.refreshed_at,coalesce(s.refreshed_at,s.updated_at,s.created_at),
  left(coalesce(s.user_agent,''),600),left(coalesce(s.tag,''),80),s.aal::text,
  s.id::text=current_session,s.not_after
 from auth.sessions s where s.user_id=actor and (s.not_after is null or s.not_after>now())
 order by (s.id::text=current_session) desc,coalesce(s.refreshed_at,s.updated_at,s.created_at) desc
 limit 50;
end $function$

CREATE OR REPLACE FUNCTION public.revoke_my_device_session(p_session uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare actor uuid:=snoozer.verified_user(); current_session text:=auth.jwt()->>'session_id';
begin
 if p_session is null or p_session::text=current_session then return false; end if;
 delete from auth.sessions where id=p_session and user_id=actor;
 return found;
end $function$

CREATE OR REPLACE FUNCTION public.owner_create_gift_link(p_plan text, p_version integer, p_duration_days integer, p_expiry_days integer, p_reason text)
 RETURNS TABLE(gift_id uuid, token text, expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare actor uuid:=snoozer.admin_actor(true); secret text; issued uuid; expiry timestamptz;
begin
 if p_plan not in('plus','pro','studio') or p_duration_days not between 1 and 366 or p_expiry_days not between 1 and 365
  or length(btrim(coalesce(p_reason,''))) not between 8 and 500
  or not exists(select 1 from snoozer.plan_versions where plan=p_plan and version=p_version)
 then raise exception 'Invalid gift parameters' using errcode='22023'; end if;
 if (select count(*) from snoozer.owner_gift_links where created_by=actor and created_at>now()-interval '1 day')>=25
 then raise exception 'Daily gift-link limit reached' using errcode='54000'; end if;
 secret:=replace(gen_random_uuid()::text,'-',''); expiry:=now()+make_interval(days=>p_expiry_days);
 insert into snoozer.owner_gift_links(token_hash,plan,plan_version,duration_days,created_by,reason,expires_at)
 values(sha256(convert_to(secret,'UTF8')),p_plan,p_version,p_duration_days,actor,btrim(p_reason),expiry) returning id into issued;
 insert into snoozer.admin_audit_events(actor_id,action,reason,details)
 values(actor,'gift_link.create',btrim(p_reason),jsonb_build_object('gift_id',issued,'plan',p_plan,'duration_days',p_duration_days,'expires_at',expiry));
 gift_id:=issued; token:=secret; expires_at:=expiry; return next;
end $function$

CREATE OR REPLACE FUNCTION public.owner_list_gift_links()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare actor uuid:=snoozer.admin_actor();
begin
 return coalesce((select jsonb_agg(jsonb_build_object('id',g.id,'plan',g.plan,'plan_version',g.plan_version,
 'duration_days',g.duration_days,'created_at',g.created_at,'expires_at',g.expires_at,'claimed_at',g.claimed_at,
 'claimed_by',g.claimed_by,'revoked_at',g.revoked_at,'reason',g.reason,
 'status',case when g.revoked_at is not null then 'revoked' when g.claimed_at is not null then 'claimed'
 when g.expires_at<=now() then 'expired' else 'ready' end) order by g.created_at desc)
 from snoozer.owner_gift_links g),'[]'::jsonb);
end $function$

CREATE OR REPLACE FUNCTION public.owner_revoke_gift_link(p_gift uuid, p_reason text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare actor uuid:=snoozer.admin_actor(true); link snoozer.owner_gift_links;
begin
 if length(btrim(coalesce(p_reason,''))) not between 8 and 500 then raise exception 'Reason required' using errcode='22023'; end if;
 update snoozer.owner_gift_links set revoked_at=now() where id=p_gift and revoked_at is null and claimed_at is null returning * into link;
 if not found then return false; end if;
 insert into snoozer.admin_audit_events(actor_id,action,reason,details)
 values(actor,'gift_link.revoke',btrim(p_reason),jsonb_build_object('gift_id',p_gift));
 return true;
end $function$

CREATE OR REPLACE FUNCTION public.claim_gift_link(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare actor uuid:=snoozer.verified_user(); gift snoozer.owner_gift_links; grant_id uuid;
begin
 if p_token is null or p_token !~ '^[a-f0-9]{32}$' then return null; end if;
 select * into gift from snoozer.owner_gift_links where token_hash=sha256(convert_to(lower(p_token),'UTF8')) for update;
 if not found or gift.claimed_at is not null or gift.revoked_at is not null or gift.expires_at<=now() then return null; end if;
 insert into snoozer.entitlement_grants(owner_id,plan,plan_version,source,source_ref,starts_at,expires_at)
 values(actor,gift.plan,gift.plan_version,'gift','owner-link:'||gift.id::text,now(),now()+gift.duration_days*interval '24 hours')
 returning id into grant_id;
 update snoozer.owner_gift_links set claimed_by=actor,claimed_at=now(),entitlement_id=grant_id where id=gift.id;
 return jsonb_build_object('plan',gift.plan,'duration_days',gift.duration_days,'expires_at',now()+gift.duration_days*interval '24 hours');
end $function$

revoke all on function public.list_my_device_sessions() from public,anon,authenticated,service_role;
grant execute on function public.list_my_device_sessions() to authenticated;
revoke all on function public.revoke_my_device_session(uuid) from public,anon,authenticated,service_role;
grant execute on function public.revoke_my_device_session(uuid) to authenticated;
revoke all on function public.owner_create_gift_link(text,integer,integer,integer,text) from public,anon,authenticated,service_role;
grant execute on function public.owner_create_gift_link(text,integer,integer,integer,text) to authenticated;
revoke all on function public.owner_list_gift_links() from public,anon,authenticated,service_role;
grant execute on function public.owner_list_gift_links() to authenticated;
revoke all on function public.owner_revoke_gift_link(uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.owner_revoke_gift_link(uuid,text) to authenticated;
revoke all on function public.claim_gift_link(text) from public,anon,authenticated,service_role;
grant execute on function public.claim_gift_link(text) to authenticated;
commit;