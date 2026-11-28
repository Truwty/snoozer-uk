-- Allow the delayed ticket cleanup job used by the ticket-close flow.
-- Keep the database constraint and RPC allow-list aligned.
alter table snoozer.discord_bot_jobs
  drop constraint if exists discord_bot_jobs_job_type_check;

alter table snoozer.discord_bot_jobs
  add constraint discord_bot_jobs_job_type_check
  check (job_type in (
    'premium_role_sync',
    'creator_role_sync',
    'announcement',
    'ticket_reminder',
    'scheduled_event',
    'giveaway_finish',
    'backup',
    'health_check',
    'role_reconcile',
    'tempban_unban',
    'ticket_delete'
  ));

create or replace function public.discord_bot_enqueue_job(
  p_guild_id text,
  p_job_type text,
  p_dedupe_key text,
  p_payload jsonb default '{}'::jsonb,
  p_run_at timestamptz default now()
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  result uuid;
begin
  if coalesce(p_guild_id, '') !~ '^[1-9][0-9]{16,19}$'
    or coalesce(p_job_type, '') not in (
      'premium_role_sync',
      'creator_role_sync',
      'announcement',
      'ticket_reminder',
      'scheduled_event',
      'giveaway_finish',
      'backup',
      'health_check',
      'role_reconcile',
      'tempban_unban',
      'ticket_delete'
    )
    or length(coalesce(p_dedupe_key, '')) not between 1 and 200
    or jsonb_typeof(coalesce(p_payload, '{}'::jsonb)) <> 'object'
    or octet_length(coalesce(p_payload, '{}'::jsonb)::text) > 32768 then
    raise exception 'Invalid Discord automation job';
  end if;

  insert into snoozer.discord_bot_jobs (
    guild_id, job_type, dedupe_key, payload, run_at
  ) values (
    p_guild_id, p_job_type, p_dedupe_key,
    coalesce(p_payload, '{}'::jsonb), coalesce(p_run_at, now())
  )
  on conflict (dedupe_key) do update set
    guild_id = excluded.guild_id,
    job_type = excluded.job_type,
    payload = excluded.payload,
    run_at = excluded.run_at,
    status = 'pending',
    locked_at = null,
    updated_at = now()
  returning id into result;

  return result;
end
$$;

revoke all on function public.discord_bot_enqueue_job(text, text, text, jsonb, timestamptz)
  from public, anon, authenticated;
grant execute on function public.discord_bot_enqueue_job(text, text, text, jsonb, timestamptz)
  to service_role;

notify pgrst, 'reload schema';
