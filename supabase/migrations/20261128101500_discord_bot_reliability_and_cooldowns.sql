-- Discord community reliability: durable ticket deletion, atomic ticket cooldowns and Creator throttling.
-- All RPCs remain service-role-only; no client role receives direct table access.

alter table snoozer.discord_bot_jobs
  drop constraint if exists discord_bot_jobs_job_type_check;

alter table snoozer.discord_bot_jobs
  add constraint discord_bot_jobs_job_type_check
  check(job_type in (
    'premium_role_sync','creator_role_sync','announcement','ticket_reminder',
    'scheduled_event','giveaway_finish','backup','health_check','role_reconcile',
    'tempban_unban','ticket_delete'
  ));

create or replace function public.discord_bot_ticket_preflight(
  p_guild_id text,
  p_owner_discord_id text
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare active_ticket snoozer.discord_bot_tickets;
declare latest_ticket snoozer.discord_bot_tickets;
declare retry_seconds integer;
begin
  if coalesce(p_guild_id,'') !~ '^[1-9][0-9]{16,19}$'
    or coalesce(p_owner_discord_id,'') !~ '^[1-9][0-9]{16,19}$' then
    raise exception 'Invalid Discord ticket preflight identity';
  end if;

  select * into active_ticket
  from snoozer.discord_bot_tickets
  where guild_id=p_guild_id
    and owner_discord_id=p_owner_discord_id
    and status in ('open','claimed','waiting_member','waiting_staff')
  order by created_at desc
  limit 1;

  if found then
    return jsonb_build_object(
      'allowed',false,'reason','active','ticket_id',active_ticket.id,
      'channel_id',active_ticket.channel_id,'status',active_ticket.status
    );
  end if;

  select * into latest_ticket
  from snoozer.discord_bot_tickets
  where guild_id=p_guild_id and owner_discord_id=p_owner_discord_id
  order by created_at desc
  limit 1;

  if found and latest_ticket.created_at>now()-interval '60 seconds' then
    retry_seconds:=greatest(1,ceil(extract(epoch from (latest_ticket.created_at+interval '60 seconds'-now())))::integer);
    return jsonb_build_object('allowed',false,'reason','cooldown','retry_after_seconds',retry_seconds);
  end if;

  return jsonb_build_object('allowed',true);
end
$$;

create or replace function public.discord_bot_open_ticket(
  p_guild_id text,
  p_channel_id text,
  p_owner_discord_id text,
  p_category text,
  p_subject text,
  p_details text
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare ticket snoozer.discord_bot_tickets;
declare latest_ticket snoozer.discord_bot_tickets;
declare retry_seconds integer;
begin
  if coalesce(p_guild_id,'') !~ '^[1-9][0-9]{16,19}$'
    or coalesce(p_channel_id,'') !~ '^[1-9][0-9]{16,19}$'
    or coalesce(p_owner_discord_id,'') !~ '^[1-9][0-9]{16,19}$'
    or coalesce(p_category,'') not in ('account','billing','technical','bug','report','general')
    or length(coalesce(p_subject,'')) not between 4 and 100
    or length(coalesce(p_details,'')) not between 10 and 3000 then
    raise exception 'Invalid ticket submission';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_guild_id||':'||p_owner_discord_id,7441));

  select * into ticket
  from snoozer.discord_bot_tickets
  where guild_id=p_guild_id and owner_discord_id=p_owner_discord_id
    and status in ('open','claimed','waiting_member','waiting_staff')
  order by created_at desc
  limit 1
  for update;

  if found then
    return jsonb_build_object(
      'created',false,'reason','active','ticket_id',ticket.id,
      'channel_id',ticket.channel_id,'status',ticket.status
    );
  end if;

  select * into latest_ticket
  from snoozer.discord_bot_tickets
  where guild_id=p_guild_id and owner_discord_id=p_owner_discord_id
  order by created_at desc
  limit 1;

  if found and latest_ticket.created_at>now()-interval '60 seconds' then
    retry_seconds:=greatest(1,ceil(extract(epoch from (latest_ticket.created_at+interval '60 seconds'-now())))::integer);
    return jsonb_build_object('created',false,'reason','cooldown','retry_after_seconds',retry_seconds);
  end if;

  insert into snoozer.discord_bot_tickets(
    guild_id,channel_id,owner_discord_id,category,subject,details
  ) values(
    p_guild_id,p_channel_id,p_owner_discord_id,p_category,p_subject,p_details
  ) returning * into ticket;

  insert into snoozer.discord_bot_ticket_events(ticket_id,actor_discord_id,event_type,payload)
  values(
    ticket.id,p_owner_discord_id,'opened',
    jsonb_build_object('category',p_category,'subject',p_subject)
  );

  return jsonb_build_object(
    'created',true,'ticket_id',ticket.id,'channel_id',ticket.channel_id,'status',ticket.status
  );
end
$$;

create or replace function public.discord_bot_creator_request_limited(
  p_discord_user_id text,
  p_profile_url text,
  p_reason text
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare owner uuid;
declare requested_username text;
declare profile_match text[];
declare pending_request snoozer.discord_bot_creator_verifications;
declare latest_request snoozer.discord_bot_creator_verifications;
declare result_id uuid;
declare retry_seconds integer;
begin
  profile_match:=regexp_match(
    coalesce(p_profile_url,''),
    '^https://(?:www\.)?snoozer\.uk/([A-Za-z0-9-]{2,30})/?$'
  );

  if coalesce(p_discord_user_id,'') !~ '^[1-9][0-9]{16,19}$'
    or profile_match is null
    or length(coalesce(p_reason,'')) not between 15 and 1500 then
    raise exception 'Invalid Creator verification request';
  end if;

  requested_username:=profile_match[1];

  select i.user_id into owner
  from auth.identities i
  where i.provider='discord' and i.provider_id=p_discord_user_id
  limit 1;

  if owner is null then
    raise exception 'Link your Discord account to Snoozer before requesting Creator verification';
  end if;

  if not exists(
    select 1 from snoozer.profiles p
    where p.owner_id=owner and lower(p.username)=lower(requested_username)
  ) then
    raise exception 'The submitted Snoozer profile does not belong to your linked account';
  end if;

  -- Throttle by the linked Snoozer account so linking a second Discord identity cannot bypass the limit.
  perform pg_advisory_xact_lock(hashtextextended(owner::text,7442));

  if exists(
    select 1 from snoozer.discord_bot_creator_verifications v
    where v.owner_id=owner and v.status='approved'
  ) then
    return jsonb_build_object('created',false,'reason','already_approved');
  end if;

  select * into pending_request
  from snoozer.discord_bot_creator_verifications
  where owner_id=owner and status='pending'
  order by created_at desc
  limit 1
  for update;

  if found then
    return jsonb_build_object(
      'created',false,'reason','pending','request_id',pending_request.id
    );
  end if;

  select * into latest_request
  from snoozer.discord_bot_creator_verifications
  where owner_id=owner
  order by created_at desc
  limit 1;

  if found and latest_request.created_at>now()-interval '7 days' then
    retry_seconds:=greatest(1,ceil(extract(epoch from (latest_request.created_at+interval '7 days'-now())))::integer);
    return jsonb_build_object(
      'created',false,'reason','cooldown','request_id',latest_request.id,
      'retry_after_seconds',retry_seconds
    );
  end if;

  insert into snoozer.discord_bot_creator_verifications(
    owner_id,discord_user_id,profile_url,reason
  ) values(owner,p_discord_user_id,p_profile_url,p_reason)
  returning id into result_id;

  return jsonb_build_object('created',true,'reason','created','request_id',result_id);
end
$$;

-- Translate action button names to the constrained event names used by ticket_events.
create or replace function public.discord_bot_ticket_action(
  p_ticket_id uuid,p_actor text,p_action text,p_payload jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare ticket snoozer.discord_bot_tickets;
declare event_type text;
begin
  if p_ticket_id is null or coalesce(p_actor,'') !~ '^[1-9][0-9]{16,19}$'
    or p_action not in ('claim','assign','priority','close','reopen','waiting_member','waiting_staff','resolve','note','rating','escalate','transcript')
    or jsonb_typeof(coalesce(p_payload,'{}'::jsonb))<>'object' then
    raise exception 'Invalid ticket action';
  end if;

  select * into ticket from snoozer.discord_bot_tickets where id=p_ticket_id for update;
  if not found then raise exception 'Ticket not found'; end if;

  event_type:=case p_action
    when 'claim' then 'claimed'
    when 'assign' then 'assigned'
    when 'close' then 'closed'
    when 'resolve' then 'closed'
    when 'reopen' then 'reopened'
    when 'waiting_member' then 'status'
    when 'waiting_staff' then 'status'
    when 'escalate' then 'escalated'
    else p_action
  end;

  if p_action='claim' then
    update snoozer.discord_bot_tickets set claimed_by=p_actor,assigned_to=p_actor,status='claimed',updated_at=now() where id=p_ticket_id;
  elsif p_action='assign' then
    if coalesce(p_payload->>'assigned_to','') !~ '^[1-9][0-9]{16,19}$' then raise exception 'Invalid assignee'; end if;
    update snoozer.discord_bot_tickets set assigned_to=p_payload->>'assigned_to',updated_at=now() where id=p_ticket_id;
  elsif p_action='priority' then
    if p_payload->>'priority' not in ('low','normal','high','urgent') then raise exception 'Invalid priority'; end if;
    update snoozer.discord_bot_tickets set priority=p_payload->>'priority',updated_at=now() where id=p_ticket_id;
  elsif p_action='close' or p_action='resolve' then
    update snoozer.discord_bot_tickets
    set status=case when p_action='resolve' then 'resolved' else 'closed' end,closed_at=now(),updated_at=now()
    where id=p_ticket_id;
  elsif p_action='reopen' then
    update snoozer.discord_bot_tickets set status='open',closed_at=null,updated_at=now() where id=p_ticket_id;
  elsif p_action='waiting_member' or p_action='waiting_staff' then
    update snoozer.discord_bot_tickets set status=p_action,updated_at=now() where id=p_ticket_id;
  elsif p_action='note' then
    if length(coalesce(p_payload->>'body','')) not between 1 and 3000 then raise exception 'Invalid staff note'; end if;
    insert into snoozer.discord_bot_staff_notes(ticket_id,author_discord_id,body)
      values(p_ticket_id,p_actor,p_payload->>'body');
  elsif p_action='rating' then
    if coalesce((p_payload->>'rating')::integer,0) not between 1 and 5 then raise exception 'Invalid rating'; end if;
  elsif p_action='transcript' then
    if jsonb_typeof(p_payload->'transcript')<>'array' or octet_length((p_payload->'transcript')::text)>524288 then raise exception 'Invalid transcript'; end if;
    update snoozer.discord_bot_tickets set transcript=p_payload->'transcript',updated_at=now() where id=p_ticket_id;
  end if;

  insert into snoozer.discord_bot_ticket_events(ticket_id,actor_discord_id,event_type,payload)
    values(p_ticket_id,p_actor,event_type,coalesce(p_payload,'{}'::jsonb));

  select * into ticket from snoozer.discord_bot_tickets where id=p_ticket_id;
  return to_jsonb(ticket);
end
$$;

create or replace function public.discord_bot_enqueue_job(
  p_guild_id text,p_job_type text,p_dedupe_key text,
  p_payload jsonb default '{}'::jsonb,p_run_at timestamptz default now()
) returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare result uuid;
begin
  if coalesce(p_guild_id,'') !~ '^[1-9][0-9]{16,19}$'
    or coalesce(p_job_type,'') not in (
      'premium_role_sync','creator_role_sync','announcement','ticket_reminder',
      'scheduled_event','giveaway_finish','backup','health_check','role_reconcile',
      'tempban_unban','ticket_delete'
    )
    or length(coalesce(p_dedupe_key,'')) not between 1 and 200
    or jsonb_typeof(coalesce(p_payload,'{}'::jsonb))<>'object'
    or octet_length(coalesce(p_payload,'{}'::jsonb)::text)>32768 then
    raise exception 'Invalid Discord automation job';
  end if;

  insert into snoozer.discord_bot_jobs(guild_id,job_type,dedupe_key,payload,run_at)
    values(p_guild_id,p_job_type,p_dedupe_key,coalesce(p_payload,'{}'::jsonb),coalesce(p_run_at,now()))
    on conflict(dedupe_key) do update set guild_id=excluded.guild_id,job_type=excluded.job_type,
      payload=excluded.payload,run_at=excluded.run_at,status='pending',locked_at=null,updated_at=now()
    returning id into result;
  return result;
end
$$;

revoke all on function public.discord_bot_ticket_preflight(text,text) from public,anon,authenticated;
revoke all on function public.discord_bot_open_ticket(text,text,text,text,text,text) from public,anon,authenticated;
revoke all on function public.discord_bot_creator_request_limited(text,text,text) from public,anon,authenticated;
revoke all on function public.discord_bot_ticket_action(uuid,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.discord_bot_enqueue_job(text,text,text,jsonb,timestamptz) from public,anon,authenticated;

grant execute on function public.discord_bot_ticket_preflight(text,text) to service_role;
grant execute on function public.discord_bot_open_ticket(text,text,text,text,text,text) to service_role;
grant execute on function public.discord_bot_creator_request_limited(text,text,text) to service_role;
grant execute on function public.discord_bot_ticket_action(uuid,text,text,jsonb) to service_role;
grant execute on function public.discord_bot_enqueue_job(text,text,text,jsonb,timestamptz) to service_role;

-- Expose only the earliest pending run time so workers can restore precise timers after restart.
create or replace function public.discord_bot_next_job_due(p_guild_id text)
returns timestamptz
language plpgsql
security definer
set search_path=''
as $$
declare next_run timestamptz;
begin
  if coalesce(p_guild_id,'') !~ '^[1-9][0-9]{16,19}$' then
    raise exception 'Invalid Discord guild ID';
  end if;
  select min(run_at) into next_run
  from snoozer.discord_bot_jobs
  where guild_id=p_guild_id and status='pending';
  return next_run;
end
$$;

revoke all on function public.discord_bot_next_job_due(text) from public,anon,authenticated;
grant execute on function public.discord_bot_next_job_due(text) to service_role;

