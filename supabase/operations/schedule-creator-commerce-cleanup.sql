-- Operator-only activation after migration76 and retention review. No paid worker or HTTP credential.
begin;
do $$ begin
 if to_regprocedure('public.purge_creator_sandbox_history(integer)') is null then raise exception 'Apply migration76 before scheduling creator retention'; end if;
end $$;
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('snoozer-creator-retention-v1','17,47 * * * *',$job$
 select public.purge_creator_sandbox_history(100);
 delete from cron.job_run_details where runid in (select r.runid from cron.job_run_details r join cron.job j on j.jobid=r.jobid
  where j.jobname='snoozer-creator-retention-v1' and r.end_time<now()-interval '7 days' order by r.runid limit 500);
$job$);
commit;
-- Registration is not proof of execution: inspect a natural successful job_run_details entry and actual removed fixture.
-- Rollback only this job: select cron.unschedule('snoozer-creator-retention-v1');
