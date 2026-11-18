-- Operator-only setup for an existing authorised Supabase project after migration 59.
-- This is not an application migration: pg_cron is not available on embedded PG.
-- No HTTP calls, external worker, secrets, new service or paid plan.
begin;
do $$
begin
  if to_regprocedure('public.record_profile_event_with_browser(text,uuid,text,uuid,integer,text,text,uuid,text,text)') is null then
    raise exception 'Apply migration 59 before scheduling analytics cleanup';
  end if;
end;
$$;
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('snoozer-analytics-cleanup-v1', '*/5 * * * *', $job$
  select public.purge_profile_analytics();
  delete from cron.job_run_details where runid in (
    select r.runid from cron.job_run_details r join cron.job j on j.jobid=r.jobid
    where j.jobname='snoozer-analytics-cleanup-v1' and r.end_time < now()-interval '7 days'
    order by r.runid limit 500
  );
$job$);
commit;

-- Verify a naturally scheduled run actually succeeded; registration is not execution.
-- select j.jobname,j.schedule,j.active,r.status,r.return_message,r.start_time,r.end_time
-- from cron.job j left join lateral
-- (select * from cron.job_run_details where jobid=j.jobid order by runid desc limit 1) r on true
-- where j.jobname='snoozer-analytics-cleanup-v1';
-- Rollback scheduling without dropping the extension or unrelated jobs:
-- select cron.unschedule('snoozer-analytics-cleanup-v1');
