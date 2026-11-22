-- Two-stage, audited Supabase Auth provider ban/unban operations.
-- Only Owner AAL2 may prepare; only the server service role may finalize.
create table snoozer.provider_ban_operations (
 id uuid primary key default gen_random_uuid(),
 actor_id uuid not null references auth.users(id),
 target_id uuid not null references auth.users(id),
 case_id uuid references snoozer.moderation_cases(id),
 operation text not null check(operation in ('ban','unban')),
 duration_hours integer,
 reason text not null check(char_length(reason) between 8 and 500),
 status text not null default 'pending' check(status in ('pending','succeeded','failed')),
 error_code text,
 created_at timestamptz not null default now(),
 completed_at timestamptz,
 check((operation='ban' and duration_hours between 1 and 876000)
   or (operation='unban' and duration_hours is null))
);
create index provider_ban_ops_recent on snoozer.provider_ban_operations(target_id,created_at desc);
alter table snoozer.provider_ban_operations enable row level security;
revoke all on snoozer.provider_ban_operations from public,anon,authenticated,service_role;

create function public.owner_prepare_auth_ban(p_user uuid,p_case uuid,p_operation text,p_hours integer,p_reason text)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid := snoozer.admin_actor(true); op uuid;
begin
 if actor=p_user or exists(select 1 from snoozer.platform_owners where owner_id=p_user)
 then raise exception 'Owner account protected' using errcode='42501'; end if;
 if p_operation not in ('ban','unban') or char_length(btrim(coalesce(p_reason,''))) not between 8 and 500 then
  raise exception 'Invalid operation' using errcode='22023'; end if;
 if (p_operation='ban' and (p_hours is null or p_hours not between 1 and 876000))
   or (p_operation='unban' and p_hours is not null) then
  raise exception 'Invalid duration' using errcode='22023'; end if;
 if not exists(select 1 from auth.users where id=p_user) then
  raise exception 'Account missing' using errcode='22023'; end if;
 if p_operation='ban' then
  if not exists(select 1 from snoozer.moderation_cases where id=p_case and target_id=p_user
    and status in ('actioned','closed','appealed')) then
    raise exception 'Case reference required' using errcode='22023'; end if;
  if not exists(select 1 from snoozer.account_restrictions where user_id=p_user
    and kind='ban' and revoked_at is null and (ends_at is null or ends_at>now())) then
    raise exception 'Internal ban must be active' using errcode='22023'; end if;
 else
  if exists(select 1 from snoozer.account_restrictions where user_id=p_user
    and revoked_at is null and (ends_at is null or ends_at>now())) then
    raise exception 'Lift internal restriction first' using errcode='22023'; end if;
 end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,9015));
 if exists(select 1 from snoozer.provider_ban_operations where target_id=p_user
   and status='pending' and created_at>now()-interval '10 minutes') then
  raise exception 'Existing provider action pending' using errcode='23505'; end if;
 insert into snoozer.provider_ban_operations(actor_id,target_id,case_id,operation,duration_hours,reason)
 values(actor,p_user,p_case,p_operation,p_hours,btrim(p_reason)) returning id into op;
 insert into snoozer.admin_audit_events(actor_id,target_id,action,reason,details)
 values(actor,p_user,'auth.ban.prepare',btrim(p_reason),
 jsonb_build_object('operation',p_operation,'operation_id',op,'case_id',p_case));
 return op;
end $$;

create function public.service_finish_auth_ban(p_operation uuid,p_success boolean,p_code text default null)
returns boolean language plpgsql security definer set search_path='' as $$
declare op snoozer.provider_ban_operations;
begin
 if auth.jwt()->>'role' is distinct from 'service_role' then
  raise exception 'Service role required' using errcode='42501'; end if;
 if p_success is null then return false; end if;
 update snoozer.provider_ban_operations
 set status=case when p_success then 'succeeded' else 'failed' end,
 completed_at=now(),error_code=case when p_success then null else left(coalesce(p_code,'provider_error'),80) end
 where id=p_operation and status='pending' returning * into op;
 if not found then return false; end if;
 insert into snoozer.admin_audit_events(actor_id,target_id,action,details)
 values(op.actor_id,op.target_id,'auth.ban.result',
 jsonb_build_object('operation',op.operation,'operation_id',op.id,'success',p_success));
 return true;
end $$;

revoke all on function public.owner_prepare_auth_ban(uuid,uuid,text,integer,text),
public.service_finish_auth_ban(uuid,boolean,text) from public,anon,authenticated,service_role;
grant execute on function public.owner_prepare_auth_ban(uuid,uuid,text,integer,text) to authenticated;
grant execute on function public.service_finish_auth_ban(uuid,boolean,text) to service_role;
