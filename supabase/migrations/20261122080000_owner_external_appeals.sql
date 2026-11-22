-- Email-verified independent appeals for people who cannot obtain an Auth session.
create table snoozer.external_appeal_challenges (
 id uuid primary key default gen_random_uuid(),
 case_id uuid not null references snoozer.moderation_cases(id),
 user_id uuid not null references auth.users(id),
 token_hash text not null unique check(token_hash ~ '^[a-f0-9]{64}$'),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '15 minutes',
 consumed_at timestamptz
);
create index external_appeal_rate on snoozer.external_appeal_challenges(user_id,created_at desc);
alter table snoozer.external_appeal_challenges enable row level security;
revoke all on snoozer.external_appeal_challenges from public,anon,authenticated,service_role;

create function public.service_start_external_appeal(p_case uuid,p_email text,p_hash text)
returns boolean language plpgsql security definer set search_path='' as $$
declare target uuid;
begin
 if auth.jwt()->>'role' is distinct from 'service_role' then
  raise exception 'Service access required' using errcode='42501';
 end if;
 if p_hash !~ '^[a-f0-9]{64}$' or char_length(coalesce(p_email,''))>254 then return false; end if;
 select c.target_id into target from snoozer.moderation_cases c
 join auth.users u on u.id=c.target_id
 where c.id=p_case and c.status in ('actioned','closed','appealed')
   and u.email_confirmed_at is not null and lower(u.email)=lower(p_email);
 if target is null then return false; end if;
 perform pg_advisory_xact_lock(hashtextextended(target::text,7481));
 if exists(select 1 from snoozer.external_appeal_challenges
   where user_id=target and created_at>now()-interval '30 minutes')
 then return false; end if;
 insert into snoozer.external_appeal_challenges(case_id,user_id,token_hash)
 values(p_case,target,p_hash);
 return true;
end $$;

create function public.service_cancel_external_appeal(p_hash text) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 if auth.jwt()->>'role' is distinct from 'service_role' then
  raise exception 'Service access required' using errcode='42501'; end if;
 delete from snoozer.external_appeal_challenges
 where token_hash=p_hash and consumed_at is null;
 return found;
end $$;

create function public.service_submit_external_appeal(p_hash text,p_reason text) returns boolean
language plpgsql security definer set search_path='' as $$
declare challenge snoozer.external_appeal_challenges; result uuid;
begin
 if auth.jwt()->>'role' is distinct from 'service_role' then
  raise exception 'Service access required' using errcode='42501'; end if;
 if p_hash !~ '^[a-f0-9]{64}$' or char_length(btrim(coalesce(p_reason,''))) not between 15 and 1000 then return false; end if;
 select * into challenge from snoozer.external_appeal_challenges
 where token_hash=p_hash and expires_at>now() and consumed_at is null for update;
 if not found then return false; end if;
 perform pg_advisory_xact_lock(hashtextextended(challenge.user_id::text,528));
 if not exists(select 1 from snoozer.moderation_cases where id=challenge.case_id
    and target_id=challenge.user_id and status in ('actioned','closed','appealed'))
   or exists(select 1 from snoozer.moderation_appeals where case_id=challenge.case_id
       and user_id=challenge.user_id and status in ('open','review'))
   or (select count(*) from snoozer.moderation_appeals
       where user_id=challenge.user_id and created_at>now()-interval '24 hours')>=2
 then return false; end if;
 insert into snoozer.moderation_appeals(case_id,user_id,reason)
 values(challenge.case_id,challenge.user_id,btrim(p_reason)) returning id into result;
 update snoozer.moderation_cases set status='appealed',updated_at=now() where id=challenge.case_id;
 update snoozer.external_appeal_challenges set consumed_at=now() where id=challenge.id;
 insert into snoozer.admin_audit_events(actor_id,target_id,action,details)
 values(challenge.user_id,challenge.user_id,'moderation.appeal.external',
 jsonb_build_object('case_id',challenge.case_id,'appeal_id',result));
 return true;
end $$;

revoke all on function public.service_start_external_appeal(uuid,text,text),
public.service_cancel_external_appeal(text),public.service_submit_external_appeal(text,text)
from public,anon,authenticated,service_role;
grant execute on function public.service_start_external_appeal(uuid,text,text),
public.service_cancel_external_appeal(text),public.service_submit_external_appeal(text,text) to service_role;
