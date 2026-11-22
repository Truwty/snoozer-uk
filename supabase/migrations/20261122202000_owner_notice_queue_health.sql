-- Service-only, personally non-identifying email-queue health snapshot.
-- A claimed batch may be empty even when jobs have exhausted retries.
create or replace function public.service_owner_notice_queue_health()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare totals jsonb;
begin
 if auth.jwt()->>'role' is distinct from 'service_role' then
  raise exception 'Service access required' using errcode='42501';
 end if;
 select jsonb_build_object(
  'undelivered',count(*) filter(where q.delivered_at is null),
  'exhausted',count(*) filter(where q.delivered_at is null and q.attempts>=5),
  'overdue',count(*) filter(where q.delivered_at is null and q.attempts<5
       and q.next_attempt_at < now()-interval '30 minutes'
       and (q.lease_until is null or q.lease_until < now()-interval '10 minutes')),
  'leased',count(*) filter(where q.delivered_at is null and q.lease_until>=now()),
  'total',count(*)
 ) into totals from snoozer.notification_email_deliveries q;
 return totals;
end $$;
revoke all on function public.service_owner_notice_queue_health()
 from public,anon,authenticated,service_role;
grant execute on function public.service_owner_notice_queue_health() to service_role;
