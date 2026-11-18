-- Operator-only setup on the existing authorised database after migration 63.
-- No external worker, paid scheduler, HTTP calls or new credentials.
begin;
do $$ begin
 if to_regprocedure('public.run_due_publications(integer)') is null then raise exception 'Apply migration 63 before installing the publication scheduler'; end if;
end $$;
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('snoozer-publications-v1','* * * * *',$job$
 select public.run_due_publications(10);
 do $cleanup$ begin
  if to_regprocedure('public.cleanup_domain_requests(integer)') is not null then perform public.cleanup_domain_requests(100); end if;
 end $cleanup$;
 delete from cron.job_run_details where runid in (select r.runid from cron.job_run_details r join cron.job j on j.jobid=r.jobid where j.jobname='snoozer-publications-v1' and r.end_time<now()-interval '7 days' order by r.runid limit 500);
$job$);
commit;
-- Inspect a naturally scheduled run; registering a job does not prove it ran:
-- select j.jobname,j.schedule,j.active,r.status,r.start_time,r.end_time,r.return_message from cron.job j left join lateral (select * from cron.job_run_details where jobid=j.jobid order by runid desc limit 1) r on true where j.jobname='snoozer-publications-v1';
-- Roll back only this job: select cron.unschedule('snoozer-publications-v1');
