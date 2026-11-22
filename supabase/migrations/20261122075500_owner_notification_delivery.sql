-- Email delivery queue for Owner account notices. Defaults to dormant until
-- a secured dispatcher with transactional email credentials is configured.
create table snoozer.notification_email_deliveries (
 id uuid primary key default gen_random_uuid(),
 notice_id uuid not null unique references snoozer.account_notifications(id) on delete cascade,
 attempts integer not null default 0 check(attempts between 0 and 5),
 next_attempt_at timestamptz not null default now(),
 lease_until timestamptz,
 delivered_at timestamptz,
 last_error text,
 created_at timestamptz not null default now()
);
create index notification_email_due on snoozer.notification_email_deliveries(next_attempt_at)
 where delivered_at is null and attempts < 5;
alter table snoozer.notification_email_deliveries enable row level security;
revoke all on snoozer.notification_email_deliveries from public,anon,authenticated,service_role;

create function snoozer.queue_account_notice() returns trigger
 language plpgsql security definer set search_path='' as $$
begin
 insert into snoozer.notification_email_deliveries(notice_id) values(new.id)
 on conflict (notice_id) do nothing;
 return new;
end $$;
revoke all on function snoozer.queue_account_notice() from public,anon,authenticated,service_role;
create trigger queue_account_notice_email after insert on snoozer.account_notifications
 for each row execute function snoozer.queue_account_notice();

-- Only the server's Supabase service role may fetch email destinations.
create function public.service_claim_account_notices(p_limit integer default 5) returns jsonb
 language plpgsql security definer set search_path='' as $$
declare batch jsonb;
begin
 if auth.jwt()->>'role' is distinct from 'service_role' then
  raise exception 'Service role required' using errcode='42501';
 end if;
 with due as (
  select q.id from snoozer.notification_email_deliveries q
  join snoozer.account_notifications n on n.id=q.notice_id
  join auth.users u on u.id=n.user_id
  where q.delivered_at is null and q.attempts < 5
   and q.next_attempt_at <= now()
   and (q.lease_until is null or q.lease_until < now())
   and u.email is not null and u.email_confirmed_at is not null
  order by q.next_attempt_at,q.id
  limit least(greatest(coalesce(p_limit,5),1),10)
  for update of q skip locked
 ), claimed as (
  update snoozer.notification_email_deliveries q
  set lease_until=now()+interval '5 minutes',attempts=q.attempts+1
  from due where q.id=due.id
  returning q.id,q.notice_id
 )
 select coalesce(jsonb_agg(jsonb_build_object(
 'id',c.id,'email',u.email,'title',n.title,'body',n.body)),'[]'::jsonb)
 into batch
 from claimed c
 join snoozer.account_notifications n on n.id=c.notice_id
 join auth.users u on u.id=n.user_id;
 return batch;
end $$;

create function public.service_finish_account_notice(p_id uuid,p_success boolean,p_error text default null)
 returns boolean language plpgsql security definer set search_path='' as $$
declare changed integer;
begin
 if auth.jwt()->>'role' is distinct from 'service_role' then
  raise exception 'Service role required' using errcode='42501';
 end if;
 if p_success is null then raise exception 'Outcome required' using errcode='22023'; end if;
 update snoozer.notification_email_deliveries q
 set delivered_at=case when p_success then now() else null end,
     last_error=case when p_success then null else left(coalesce(p_error,'provider rejected'),120) end,
     next_attempt_at=case when p_success then q.next_attempt_at
       else now()+make_interval(mins=>least(1440,2 ^ least(q.attempts,10))) end,
     lease_until=null
 where q.id=p_id and q.delivered_at is null
   and q.lease_until >= now()
   and q.attempts between 1 and 5;
 get diagnostics changed=row_count;
 return changed=1;
end $$;

revoke all on function public.service_claim_account_notices(integer),
 public.service_finish_account_notice(uuid,boolean,text)
 from public,anon,authenticated,service_role;
grant execute on function public.service_claim_account_notices(integer),
 public.service_finish_account_notice(uuid,boolean,text) to service_role;
