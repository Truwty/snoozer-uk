-- Restore the worker's durable next-job timer lookup.
create or replace function public.discord_bot_next_job_due(p_guild_id text)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_run timestamptz;
begin
  if coalesce(p_guild_id, '') !~ '^[1-9][0-9]{16,19}$' then
    raise exception 'Invalid Discord guild ID';
  end if;

  select min(run_at)
    into next_run
    from snoozer.discord_bot_jobs
   where guild_id = p_guild_id
     and status = 'pending';

  return next_run;
end
$$;

revoke all on function public.discord_bot_next_job_due(text)
  from public, anon, authenticated;
grant execute on function public.discord_bot_next_job_due(text)
  to service_role;

notify pgrst, 'reload schema';
