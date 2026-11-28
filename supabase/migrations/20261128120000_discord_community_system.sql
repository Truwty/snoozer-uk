-- Persistent Discord community system: resources, tickets, moderation, automation and role sync.
-- All objects live in the private snoozer schema. Only narrowly-scoped service-role RPCs are exposed.

create table snoozer.discord_bot_resources (
  guild_id text not null check (guild_id ~ '^[1-9][0-9]{16,19}$'),
  resource_key text not null check (resource_key ~ '^[a-z][a-z0-9_]{1,79}$'),
  resource_type text not null check (resource_type in ('category','text','voice','role')),
  discord_id text not null check (discord_id ~ '^[1-9][0-9]{16,19}$'),
  name text not null check (char_length(name) between 1 and 100),
  updated_at timestamptz not null default now(),
  primary key (guild_id,resource_key),
  unique (guild_id,discord_id)
);
create index discord_bot_resources_type on snoozer.discord_bot_resources(guild_id,resource_type);

create table snoozer.discord_bot_config (
  guild_id text not null check (guild_id ~ '^[1-9][0-9]{16,19}$'),
  config_key text not null check (config_key ~ '^[a-z][a-z0-9_]{1,79}$'),
  config jsonb not null default '{}'::jsonb check (jsonb_typeof(config)='object' and octet_length(config::text)<=16384),
  updated_at timestamptz not null default now(),
  primary key(guild_id,config_key)
);

create table snoozer.discord_bot_tickets (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null check (guild_id ~ '^[1-9][0-9]{16,19}$'),
  channel_id text not null unique check (channel_id ~ '^[1-9][0-9]{16,19}$'),
  owner_discord_id text not null check (owner_discord_id ~ '^[1-9][0-9]{16,19}$'),
  owner_user_id uuid references auth.users(id) on delete set null,
  category text not null check (category in ('account','billing','technical','bug','report','general')),
  subject text not null check (char_length(subject) between 4 and 100),
  details text not null check (char_length(details) between 10 and 3000),
  status text not null default 'open' check (status in ('open','claimed','waiting_member','waiting_staff','resolved','closed')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  assigned_to text check (assigned_to is null or assigned_to ~ '^[1-9][0-9]{16,19}$'),
  claimed_by text check (claimed_by is null or claimed_by ~ '^[1-9][0-9]{16,19}$'),
  transcript jsonb check (transcript is null or (jsonb_typeof(transcript)='array' and octet_length(transcript::text)<=524288)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz
);
create unique index discord_bot_one_active_ticket_per_owner
  on snoozer.discord_bot_tickets(guild_id,owner_discord_id)
  where status in ('open','claimed','waiting_member','waiting_staff');
create index discord_bot_ticket_queue on snoozer.discord_bot_tickets(guild_id,status,priority,created_at);

create table snoozer.discord_bot_ticket_events (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references snoozer.discord_bot_tickets(id) on delete cascade,
  actor_discord_id text check (actor_discord_id is null or actor_discord_id ~ '^[1-9][0-9]{16,19}$'),
  event_type text not null check (event_type in ('opened','claimed','assigned','priority','status','closed','reopened','note','transcript','rating','reminder','escalated')),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload)='object' and octet_length(payload::text)<=16384),
  created_at timestamptz not null default now()
);
create index discord_bot_ticket_events_ticket on snoozer.discord_bot_ticket_events(ticket_id,created_at);

create table snoozer.discord_bot_staff_notes (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references snoozer.discord_bot_tickets(id) on delete cascade,
  author_discord_id text not null check (author_discord_id ~ '^[1-9][0-9]{16,19}$'),
  body text not null check (char_length(body) between 1 and 3000),
  created_at timestamptz not null default now()
);
create index discord_bot_staff_notes_ticket on snoozer.discord_bot_staff_notes(ticket_id,created_at);

create table snoozer.discord_bot_moderation_cases (
  id uuid primary key default gen_random_uuid(),
  case_number bigint generated always as identity unique,
  guild_id text not null check (guild_id ~ '^[1-9][0-9]{16,19}$'),
  target_discord_id text not null check (target_discord_id ~ '^[1-9][0-9]{16,19}$'),
  moderator_discord_id text not null check (moderator_discord_id ~ '^[1-9][0-9]{16,19}$'),
  action text not null check (action in ('warn','timeout','kick','ban','tempban','unban','note','automod','anti_raid','anti_nuke')),
  reason text not null check (char_length(reason) between 3 and 1000),
  duration_seconds integer check (duration_seconds is null or duration_seconds between 1 and 31536000),
  warning_points integer not null default 0 check (warning_points between 0 and 100),
  status text not null default 'active' check (status in ('active','expired','appealed','overturned','closed')),
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata)='object' and octet_length(metadata::text)<=16384),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index discord_bot_cases_target on snoozer.discord_bot_moderation_cases(guild_id,target_discord_id,created_at desc);
create index discord_bot_cases_expiry on snoozer.discord_bot_moderation_cases(expires_at) where expires_at is not null and status='active';

create table snoozer.discord_bot_appeals (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references snoozer.discord_bot_moderation_cases(id) on delete cascade,
  appellant_discord_id text not null check (appellant_discord_id ~ '^[1-9][0-9]{16,19}$'),
  reason text not null check (char_length(reason) between 15 and 2000),
  status text not null default 'open' check (status in ('open','review','accepted','rejected')),
  response text check (response is null or char_length(response)<=2000),
  reviewed_by text check (reviewed_by is null or reviewed_by ~ '^[1-9][0-9]{16,19}$'),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create index discord_bot_appeals_queue on snoozer.discord_bot_appeals(status,created_at);

create table snoozer.discord_bot_creator_verifications (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  discord_user_id text not null check (discord_user_id ~ '^[1-9][0-9]{16,19}$'),
  profile_url text not null check (char_length(profile_url) between 8 and 300),
  reason text not null check (char_length(reason) between 15 and 1500),
  status text not null default 'pending' check (status in ('pending','approved','rejected','withdrawn')),
  reviewed_by text check (reviewed_by is null or reviewed_by ~ '^[1-9][0-9]{16,19}$'),
  review_note text check (review_note is null or char_length(review_note)<=1000),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create unique index discord_bot_creator_one_pending
  on snoozer.discord_bot_creator_verifications(discord_user_id) where status='pending';
create index discord_bot_creator_queue on snoozer.discord_bot_creator_verifications(status,created_at);

create table snoozer.discord_bot_jobs (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null check (guild_id ~ '^[1-9][0-9]{16,19}$'),
  job_type text not null check (job_type in ('premium_role_sync','creator_role_sync','announcement','ticket_reminder','scheduled_event','giveaway_finish','backup','health_check','role_reconcile','tempban_unban')),
  dedupe_key text not null unique check (char_length(dedupe_key) between 1 and 200),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload)='object' and octet_length(payload::text)<=32768),
  status text not null default 'pending' check (status in ('pending','processing','done','failed')),
  attempts integer not null default 0 check (attempts between 0 and 100),
  run_at timestamptz not null default now(),
  locked_at timestamptz,
  last_error text check (last_error is null or char_length(last_error)<=1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index discord_bot_jobs_ready on snoozer.discord_bot_jobs(status,run_at) where status in ('pending','processing');

create table snoozer.discord_bot_submissions (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null check (guild_id ~ '^[1-9][0-9]{16,19}$'),
  kind text not null check (kind in ('suggestion','bug','poll','event')),
  author_discord_id text not null check (author_discord_id ~ '^[1-9][0-9]{16,19}$'),
  title text not null check (char_length(title) between 4 and 120),
  body text not null check (char_length(body) between 10 and 5000),
  status text not null default 'open' check (status in ('open','approved','rejected','closed','scheduled')),
  message_id text check (message_id is null or message_id ~ '^[1-9][0-9]{16,19}$'),
  channel_id text check (channel_id is null or channel_id ~ '^[1-9][0-9]{16,19}$'),
  scheduled_at timestamptz,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata)='object' and octet_length(metadata::text)<=32768),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index discord_bot_submissions_queue on snoozer.discord_bot_submissions(guild_id,kind,status,created_at desc);

create table snoozer.discord_bot_votes (
  submission_id uuid not null references snoozer.discord_bot_submissions(id) on delete cascade,
  voter_discord_id text not null check (voter_discord_id ~ '^[1-9][0-9]{16,19}$'),
  choice text not null check (char_length(choice) between 1 and 100),
  created_at timestamptz not null default now(),
  primary key(submission_id,voter_discord_id)
);

create table snoozer.discord_bot_giveaways (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null check (guild_id ~ '^[1-9][0-9]{16,19}$'),
  channel_id text not null check (channel_id ~ '^[1-9][0-9]{16,19}$'),
  message_id text check (message_id is null or message_id ~ '^[1-9][0-9]{16,19}$'),
  title text not null check (char_length(title) between 4 and 140),
  prize text not null check (char_length(prize) between 2 and 300),
  winner_count integer not null default 1 check (winner_count between 1 and 20),
  ends_at timestamptz not null,
  minimum_role_id text check (minimum_role_id is null or minimum_role_id ~ '^[1-9][0-9]{16,19}$'),
  status text not null default 'active' check (status in ('active','ended','cancelled')),
  winners jsonb not null default '[]'::jsonb check (jsonb_typeof(winners)='array' and octet_length(winners::text)<=4096),
  created_by text not null check (created_by ~ '^[1-9][0-9]{16,19}$'),
  created_at timestamptz not null default now()
);
create index discord_bot_giveaways_due on snoozer.discord_bot_giveaways(ends_at) where status='active';

create table snoozer.discord_bot_giveaway_entries (
  giveaway_id uuid not null references snoozer.discord_bot_giveaways(id) on delete cascade,
  discord_user_id text not null check (discord_user_id ~ '^[1-9][0-9]{16,19}$'),
  created_at timestamptz not null default now(),
  primary key(giveaway_id,discord_user_id)
);

create table snoozer.discord_bot_server_backups (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null check (guild_id ~ '^[1-9][0-9]{16,19}$'),
  snapshot jsonb not null check (jsonb_typeof(snapshot)='object' and octet_length(snapshot::text)<=1048576),
  created_by text not null check (created_by ~ '^[1-9][0-9]{16,19}$'),
  created_at timestamptz not null default now()
);
create index discord_bot_backups_recent on snoozer.discord_bot_server_backups(guild_id,created_at desc);

create table snoozer.discord_bot_activity_daily (
  guild_id text not null check (guild_id ~ '^[1-9][0-9]{16,19}$'),
  discord_user_id text not null check (discord_user_id ~ '^[1-9][0-9]{16,19}$'),
  activity_date date not null,
  message_count integer not null default 0 check (message_count between 0 and 100000),
  voice_minutes integer not null default 0 check (voice_minutes between 0 and 1440),
  primary key(guild_id,discord_user_id,activity_date)
);

create table snoozer.discord_bot_interaction_receipts (
  interaction_id text primary key check (interaction_id ~ '^[1-9][0-9]{16,19}$'),
  interaction_type text not null check (char_length(interaction_type) between 1 and 80),
  processed_at timestamptz not null default now()
);
create index discord_bot_interaction_receipts_retention on snoozer.discord_bot_interaction_receipts(processed_at);

do $$
declare t text;
begin
  foreach t in array array[
    'discord_bot_resources','discord_bot_config','discord_bot_tickets','discord_bot_ticket_events',
    'discord_bot_staff_notes','discord_bot_moderation_cases','discord_bot_appeals',
    'discord_bot_creator_verifications','discord_bot_jobs','discord_bot_submissions','discord_bot_votes',
    'discord_bot_giveaways','discord_bot_giveaway_entries','discord_bot_server_backups',
    'discord_bot_activity_daily','discord_bot_interaction_receipts'
  ] loop
    execute format('alter table snoozer.%I enable row level security',t);
    execute format('revoke all on snoozer.%I from public,anon,authenticated,service_role',t);
  end loop;
end $$;

create or replace function public.discord_bot_register_resources(p_guild_id text,p_resources jsonb)
returns boolean language plpgsql security definer set search_path='' as $$
declare item jsonb;
declare seen text[] := '{}';
declare k text;
declare rt text;
declare did text;
declare nm text;
begin
  if p_guild_id !~ '^[1-9][0-9]{16,19}$' or jsonb_typeof(p_resources)<>'array'
    or jsonb_array_length(p_resources)>250 then return false; end if;
  delete from snoozer.discord_bot_resources where guild_id=p_guild_id;
  for item in select value from jsonb_array_elements(p_resources) loop
    k:=item->>'resource_key'; rt:=item->>'resource_type'; did:=item->>'discord_id'; nm:=item->>'name';
    if k !~ '^[a-z][a-z0-9_]{1,79}$' or rt not in ('category','text','voice','role')
      or did !~ '^[1-9][0-9]{16,19}$' or length(coalesce(nm,'')) not between 1 and 100
      or k=any(seen) then raise exception 'Invalid Discord resource registry'; end if;
    seen:=array_append(seen,k);
    insert into snoozer.discord_bot_resources(guild_id,resource_key,resource_type,discord_id,name)
      values(p_guild_id,k,rt,did,nm);
  end loop;
  insert into snoozer.discord_bot_config(guild_id,config_key,config)
    values(p_guild_id,'server_layout',jsonb_build_object('version',2,'registered_at',now()))
    on conflict(guild_id,config_key) do update set config=excluded.config,updated_at=now();
  return true;
end $$;

create or replace function public.discord_bot_get_resources(p_guild_id text)
returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object('resource_key',resource_key,'resource_type',resource_type,
    'discord_id',discord_id,'name',name) order by resource_type,resource_key),'[]'::jsonb)
  from snoozer.discord_bot_resources where guild_id=p_guild_id
$$;

create or replace function public.discord_bot_save_backup(p_guild_id text,p_actor text,p_snapshot jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
  if p_guild_id !~ '^[1-9][0-9]{16,19}$' or p_actor !~ '^[1-9][0-9]{16,19}$'
    or jsonb_typeof(p_snapshot)<>'object' or octet_length(p_snapshot::text)>1048576 then
    raise exception 'Invalid Discord backup';
  end if;
  insert into snoozer.discord_bot_server_backups(guild_id,created_by,snapshot)
    values(p_guild_id,p_actor,p_snapshot) returning id into result;
  return result;
end $$;

create or replace function public.discord_bot_open_ticket(
  p_guild_id text,p_channel_id text,p_owner_discord_id text,p_category text,p_subject text,p_details text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare ticket snoozer.discord_bot_tickets;
begin
  if p_guild_id !~ '^[1-9][0-9]{16,19}$' or p_channel_id !~ '^[1-9][0-9]{16,19}$'
    or p_owner_discord_id !~ '^[1-9][0-9]{16,19}$'
    or p_category not in ('account','billing','technical','bug','report','general')
    or length(coalesce(p_subject,'')) not between 4 and 100
    or length(coalesce(p_details,'')) not between 10 and 3000 then
    raise exception 'Invalid ticket submission';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_guild_id||':'||p_owner_discord_id,7441));
  select * into ticket from snoozer.discord_bot_tickets
    where guild_id=p_guild_id and owner_discord_id=p_owner_discord_id
      and status in ('open','claimed','waiting_member','waiting_staff')
    order by created_at desc limit 1 for update;
  if found then
    return jsonb_build_object('created',false,'ticket_id',ticket.id,'channel_id',ticket.channel_id,'status',ticket.status);
  end if;
  insert into snoozer.discord_bot_tickets(guild_id,channel_id,owner_discord_id,category,subject,details)
    values(p_guild_id,p_channel_id,p_owner_discord_id,p_category,p_subject,p_details)
    returning * into ticket;
  insert into snoozer.discord_bot_ticket_events(ticket_id,actor_discord_id,event_type,payload)
    values(ticket.id,p_owner_discord_id,'opened',jsonb_build_object('category',p_category,'subject',p_subject));
  return jsonb_build_object('created',true,'ticket_id',ticket.id,'channel_id',ticket.channel_id,'status',ticket.status);
end $$;

create or replace function public.discord_bot_ticket_action(
  p_ticket_id uuid,p_actor text,p_action text,p_payload jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare ticket snoozer.discord_bot_tickets;
declare event_type text;
begin
  if p_ticket_id is null or p_actor !~ '^[1-9][0-9]{16,19}$'
    or p_action not in ('claim','assign','priority','close','reopen','waiting_member','waiting_staff','resolve','note','rating','escalate','transcript')
    or jsonb_typeof(coalesce(p_payload,'{}'::jsonb))<>'object' then raise exception 'Invalid ticket action'; end if;
  select * into ticket from snoozer.discord_bot_tickets where id=p_ticket_id for update;
  if not found then raise exception 'Ticket not found'; end if;
  event_type:=p_action;
  if p_action='claim' then
    update snoozer.discord_bot_tickets set claimed_by=p_actor,assigned_to=p_actor,status='claimed',updated_at=now() where id=p_ticket_id;
  elsif p_action='assign' then
    if coalesce(p_payload->>'assigned_to','') !~ '^[1-9][0-9]{16,19}$' then raise exception 'Invalid assignee'; end if;
    update snoozer.discord_bot_tickets set assigned_to=p_payload->>'assigned_to',updated_at=now() where id=p_ticket_id;
  elsif p_action='priority' then
    if p_payload->>'priority' not in ('low','normal','high','urgent') then raise exception 'Invalid priority'; end if;
    update snoozer.discord_bot_tickets set priority=p_payload->>'priority',updated_at=now() where id=p_ticket_id;
  elsif p_action='close' or p_action='resolve' then
    update snoozer.discord_bot_tickets set status=case when p_action='resolve' then 'resolved' else 'closed' end,
      closed_at=now(),updated_at=now() where id=p_ticket_id;
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
end $$;

create or replace function public.discord_bot_ticket_queue(p_guild_id text,p_limit integer default 50)
returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) from (
    select id,channel_id,owner_discord_id,category,subject,status,priority,assigned_to,claimed_by,created_at,updated_at
    from snoozer.discord_bot_tickets where guild_id=p_guild_id
      and status in ('open','claimed','waiting_member','waiting_staff')
    order by case priority when 'urgent' then 0 when 'high' then 1 when 'normal' then 2 else 3 end,created_at
    limit least(greatest(coalesce(p_limit,50),1),100)
  ) q
$$;

create or replace function public.discord_bot_create_case(
  p_guild_id text,p_target text,p_moderator text,p_action text,p_reason text,
  p_duration_seconds integer default null,p_warning_points integer default 0,p_metadata jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare item snoozer.discord_bot_moderation_cases;
begin
  if p_guild_id !~ '^[1-9][0-9]{16,19}$' or p_target !~ '^[1-9][0-9]{16,19}$'
    or p_moderator !~ '^[1-9][0-9]{16,19}$'
    or p_action not in ('warn','timeout','kick','ban','tempban','unban','note','automod','anti_raid','anti_nuke')
    or length(coalesce(p_reason,'')) not between 3 and 1000
    or coalesce(p_warning_points,0) not between 0 and 100
    or jsonb_typeof(coalesce(p_metadata,'{}'::jsonb))<>'object' then raise exception 'Invalid moderation case'; end if;
  insert into snoozer.discord_bot_moderation_cases(guild_id,target_discord_id,moderator_discord_id,action,reason,duration_seconds,warning_points,expires_at,metadata)
  values(p_guild_id,p_target,p_moderator,p_action,p_reason,p_duration_seconds,p_warning_points,
    case when p_duration_seconds is null then null else now()+make_interval(secs=>p_duration_seconds) end,coalesce(p_metadata,'{}'::jsonb))
  returning * into item;
  return to_jsonb(item);
end $$;

create or replace function public.discord_bot_case_history(p_guild_id text,p_target text,p_limit integer default 25)
returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(to_jsonb(c)),'[]'::jsonb) from (
    select case_number,id,action,reason,duration_seconds,warning_points,status,expires_at,moderator_discord_id,created_at
    from snoozer.discord_bot_moderation_cases where guild_id=p_guild_id and target_discord_id=p_target
    order by created_at desc limit least(greatest(coalesce(p_limit,25),1),100)
  ) c
$$;

create or replace function public.discord_bot_create_appeal(p_case_id uuid,p_appellant text,p_reason text)
returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
  if p_case_id is null or p_appellant !~ '^[1-9][0-9]{16,19}$' or length(coalesce(p_reason,'')) not between 15 and 2000 then
    raise exception 'Invalid appeal';
  end if;
  if not exists(select 1 from snoozer.discord_bot_moderation_cases where id=p_case_id and target_discord_id=p_appellant and status in ('active','appealed')) then
    raise exception 'Case is not appealable';
  end if;
  if exists(select 1 from snoozer.discord_bot_appeals where case_id=p_case_id and appellant_discord_id=p_appellant and status in ('open','review')) then
    raise exception 'An appeal is already open';
  end if;
  insert into snoozer.discord_bot_appeals(case_id,appellant_discord_id,reason) values(p_case_id,p_appellant,p_reason) returning id into result;
  update snoozer.discord_bot_moderation_cases set status='appealed',updated_at=now() where id=p_case_id;
  return result;
end $$;

create or replace function public.discord_bot_creator_request(p_discord_user_id text,p_profile_url text,p_reason text)
returns uuid language plpgsql security definer set search_path='' as $$
declare owner uuid;
declare result uuid;
begin
  if p_discord_user_id !~ '^[1-9][0-9]{16,19}$' or p_profile_url !~ '^https://(www\.)?snoozer\.uk/[a-zA-Z0-9-]{2,30}/?$'
    or length(coalesce(p_reason,'')) not between 15 and 1500 then raise exception 'Invalid creator verification request'; end if;
  select provider_row.user_id into owner from auth.identities provider_row
    where provider_row.provider='discord' and provider_row.provider_id=p_discord_user_id limit 1;
  insert into snoozer.discord_bot_creator_verifications(owner_id,discord_user_id,profile_url,reason)
    values(owner,p_discord_user_id,p_profile_url,p_reason) returning id into result;
  return result;
end $$;

create or replace function public.discord_bot_creator_review(p_request_id uuid,p_reviewer text,p_decision text,p_note text default null)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  if p_reviewer !~ '^[1-9][0-9]{16,19}$' or p_decision not in ('approved','rejected') then return false; end if;
  update snoozer.discord_bot_creator_verifications set status=p_decision,reviewed_by=p_reviewer,
    review_note=left(coalesce(p_note,''),1000),reviewed_at=now()
  where id=p_request_id and status='pending';
  if not found then return false; end if;
  insert into snoozer.discord_bot_jobs(guild_id,job_type,dedupe_key,payload)
    select r.guild_id,'creator_role_sync','creator-role-sync:'||v.discord_user_id,
      jsonb_build_object('discord_user_id',v.discord_user_id,'approved',p_decision='approved')
    from snoozer.discord_bot_resources r cross join snoozer.discord_bot_creator_verifications v
    where r.resource_key='guild' and v.id=p_request_id
    on conflict(dedupe_key) do update set status='pending',payload=excluded.payload,run_at=now(),updated_at=now();
  return true;
end $$;

create or replace function public.discord_bot_submission_create(
  p_guild_id text,p_kind text,p_author text,p_title text,p_body text,p_metadata jsonb default '{}'::jsonb
) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
  if p_guild_id !~ '^[1-9][0-9]{16,19}$' or p_author !~ '^[1-9][0-9]{16,19}$'
    or p_kind not in ('suggestion','bug','poll','event')
    or length(coalesce(p_title,'')) not between 4 and 120 or length(coalesce(p_body,'')) not between 10 and 5000
    or jsonb_typeof(coalesce(p_metadata,'{}'::jsonb))<>'object' then raise exception 'Invalid community submission'; end if;
  insert into snoozer.discord_bot_submissions(guild_id,kind,author_discord_id,title,body,metadata)
    values(p_guild_id,p_kind,p_author,p_title,p_body,coalesce(p_metadata,'{}'::jsonb)) returning id into result;
  return result;
end $$;

create or replace function public.discord_bot_submission_vote(p_id uuid,p_voter text,p_choice text default 'up')
returns jsonb language plpgsql security definer set search_path='' as $$
declare total integer;
begin
  if p_id is null or p_voter !~ '^[1-9][0-9]{16,19}
end $$;

create or replace function public.discord_bot_role_sync_targets(p_guild_id text)
returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'discord_user_id',i.provider_id,
    'premium',exists(select 1 from snoozer.entitlement_grants e
      where e.owner_id=i.user_id and e.revoked_at is null and e.starts_at<=now()
        and (e.expires_at is null or e.expires_at>now()) and not coalesce(e.payment_held,false)
        and e.plan in ('plus','pro','studio')),
    'creator',exists(select 1 from snoozer.discord_bot_creator_verifications v
      where v.discord_user_id=i.provider_id and v.status='approved')
  )),'[]'::jsonb)
  from auth.identities i
  where i.provider='discord' and i.provider_id ~ '^[1-9][0-9]{16,19}$'
    and exists(select 1 from auth.users u where u.id=i.user_id)
$$;

create or replace function public.discord_bot_member_summary(p_discord_user_id text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare owner uuid;
declare profile_name text;
declare display_name text;
declare plan_name text;
declare premium boolean;
declare creator boolean;
begin
  if p_discord_user_id !~ '^[1-9][0-9]{16,19}$' then return null; end if;
  select user_id into owner from auth.identities where provider='discord' and provider_id=p_discord_user_id limit 1;
  if owner is null then return jsonb_build_object('linked',false); end if;
  select username,display_name into profile_name,display_name from snoozer.profiles where owner_id=owner order by created_at limit 1;
  select plan into plan_name from snoozer.entitlement_grants
    where owner_id=owner and revoked_at is null and starts_at<=now()
      and (expires_at is null or expires_at>now()) and not coalesce(payment_held,false)
      and plan in ('plus','pro','studio')
    order by case plan when 'studio' then 1 when 'pro' then 2 else 3 end limit 1;
  premium:=plan_name is not null;
  select exists(select 1 from snoozer.discord_bot_creator_verifications where discord_user_id=p_discord_user_id and status='approved') into creator;
  return jsonb_build_object('linked',true,'username',profile_name,'display_name',display_name,
    'premium',premium,'plan',plan_name,'creator',creator,'profile_url',case when profile_name is null then null else 'https://snoozer.uk/'||profile_name end);
end $$;

create or replace function public.discord_bot_claim_jobs(p_guild_id text,p_limit integer default 20)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  with picked as (
    select id from snoozer.discord_bot_jobs
    where guild_id=p_guild_id and run_at<=now()
      and (status='pending' or (status='processing' and locked_at<now()-interval '5 minutes'))
    order by run_at,created_at limit least(greatest(coalesce(p_limit,20),1),50)
    for update skip locked
  ), changed as (
    update snoozer.discord_bot_jobs j set status='processing',locked_at=now(),attempts=attempts+1,updated_at=now()
    from picked where j.id=picked.id returning j.*
  )
  select coalesce(jsonb_agg(to_jsonb(changed)),'[]'::jsonb) into result from changed;
  return result;
end $$;

create or replace function public.discord_bot_finish_job(p_id uuid,p_success boolean,p_error text default null)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  update snoozer.discord_bot_jobs set
    status=case when p_success then 'done' when attempts>=8 then 'failed' else 'pending' end,
    run_at=case when p_success then run_at else now()+make_interval(secs=>least(3600,30*(2^least(attempts,6))::integer)) end,
    locked_at=null,last_error=case when p_success then null else left(coalesce(p_error,'Failed'),1000) end,updated_at=now()
  where id=p_id and status='processing';
  return found;
end $$;

create or replace function public.discord_bot_enqueue_job(
  p_guild_id text,p_job_type text,p_dedupe_key text,p_payload jsonb default '{}'::jsonb,p_run_at timestamptz default now()
) returns uuid language plpgsql security definer set search_path='' as $discord_bot$
declare result uuid;
begin
  if p_guild_id !~ '^[1-9][0-9]{16,19}$'
    or p_job_type not in ('premium_role_sync','creator_role_sync','announcement','ticket_reminder','scheduled_event','giveaway_finish','backup','health_check','role_reconcile','tempban_unban')
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
end $discord_bot$;
create or replace function public.discord_bot_config_get(p_guild_id text)
returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_object_agg(config_key,config),'{}'::jsonb)
  from snoozer.discord_bot_config where guild_id=p_guild_id
$$;

create or replace function public.discord_bot_config_set(p_guild_id text,p_key text,p_config jsonb)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  if p_guild_id !~ '^[1-9][0-9]{16,19}$' or p_key !~ '^[a-z][a-z0-9_]{1,79}$'
    or jsonb_typeof(p_config)<>'object' or octet_length(p_config::text)>16384 then return false; end if;
  insert into snoozer.discord_bot_config(guild_id,config_key,config) values(p_guild_id,p_key,p_config)
    on conflict(guild_id,config_key) do update set config=excluded.config,updated_at=now();
  return true;
end $$;

create or replace function public.discord_bot_record_interaction(p_id text,p_type text)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  if p_id !~ '^[1-9][0-9]{16,19}$' or length(coalesce(p_type,'')) not between 1 and 80 then return false; end if;
  insert into snoozer.discord_bot_interaction_receipts(interaction_id,interaction_type) values(p_id,p_type)
    on conflict(interaction_id) do nothing;
  return found;
end $$;

create or replace function public.discord_bot_entitlement_sync_enqueue()
returns trigger language plpgsql security definer set search_path='' as $$
declare owner uuid;
begin
  if tg_op='DELETE' then owner:=old.owner_id; else owner:=new.owner_id; end if;
  insert into snoozer.discord_bot_jobs(guild_id,job_type,dedupe_key,payload)
    select r.discord_id,'premium_role_sync','premium-role-sync:'||owner::text,
      jsonb_build_object('owner_id',owner)
    from snoozer.discord_bot_resources r
    where r.resource_key='guild' and r.resource_type='category'
    on conflict(dedupe_key) do update set
      payload=excluded.payload,status='pending',run_at=now(),locked_at=null,updated_at=now();
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;

drop trigger if exists discord_bot_entitlement_sync on snoozer.entitlement_grants;
create trigger discord_bot_entitlement_sync
after insert or update or delete on snoozer.entitlement_grants
for each row execute function public.discord_bot_entitlement_sync_enqueue();

-- Functions are exposed only as service-role operations. They must never be called from a browser.
revoke all on function public.discord_bot_register_resources(text,jsonb),
  public.discord_bot_get_resources(text),public.discord_bot_save_backup(text,text,jsonb),
  public.discord_bot_open_ticket(text,text,text,text,text,text),public.discord_bot_ticket_action(uuid,text,text,jsonb),
  public.discord_bot_ticket_queue(text,integer),public.discord_bot_create_case(text,text,text,text,text,integer,integer,jsonb),
  public.discord_bot_case_history(text,text,integer),public.discord_bot_create_appeal(uuid,text,text),
  public.discord_bot_creator_request(text,text,text),public.discord_bot_creator_review(uuid,text,text,text),
  public.discord_bot_submission_create(text,text,text,text,text,jsonb),public.discord_bot_submission_vote(uuid,text,text),
  public.discord_bot_role_sync_targets(text),public.discord_bot_member_summary(text),
  public.discord_bot_claim_jobs(text,integer),public.discord_bot_finish_job(uuid,boolean,text),
  public.discord_bot_config_get(text),public.discord_bot_config_set(text,text,jsonb),
  public.discord_bot_record_interaction(text,text),public.discord_bot_entitlement_sync_enqueue()
from public,anon,authenticated;
grant execute on function public.discord_bot_register_resources(text,jsonb),
  public.discord_bot_get_resources(text),public.discord_bot_save_backup(text,text,jsonb),
  public.discord_bot_open_ticket(text,text,text,text,text,text),public.discord_bot_ticket_action(uuid,text,text,jsonb),
  public.discord_bot_ticket_queue(text,integer),public.discord_bot_create_case(text,text,text,text,text,integer,integer,jsonb),
  public.discord_bot_case_history(text,text,integer),public.discord_bot_create_appeal(uuid,text,text),
  public.discord_bot_creator_request(text,text,text),public.discord_bot_creator_review(uuid,text,text,text),
  public.discord_bot_submission_create(text,text,text,text,text,jsonb),public.discord_bot_submission_vote(uuid,text,text),
  public.discord_bot_role_sync_targets(text),public.discord_bot_member_summary(text),
  public.discord_bot_claim_jobs(text,integer),public.discord_bot_finish_job(uuid,boolean,text),
  public.discord_bot_enqueue_job(text,text,text,jsonb,timestamptz),
  public.discord_bot_config_get(text),public.discord_bot_config_set(text,text,jsonb),
  public.discord_bot_record_interaction(text,text) to service_role;

revoke all on function public.discord_bot_entitlement_sync_enqueue() from service_role;

    or p_job_type not in ('premium_role_sync','creator_role_sync','announcement','ticket_reminder','scheduled_event','giveaway_finish','backup','health_check','role_reconcile','tempban_unban')
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
end $;

create or replace function public.discord_bot_config_get(p_guild_id text)
returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_object_agg(config_key,config),'{}'::jsonb)
  from snoozer.discord_bot_config where guild_id=p_guild_id
$$;

create or replace function public.discord_bot_config_set(p_guild_id text,p_key text,p_config jsonb)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  if p_guild_id !~ '^[1-9][0-9]{16,19}$' or p_key !~ '^[a-z][a-z0-9_]{1,79}$'
    or jsonb_typeof(p_config)<>'object' or octet_length(p_config::text)>16384 then return false; end if;
  insert into snoozer.discord_bot_config(guild_id,config_key,config) values(p_guild_id,p_key,p_config)
    on conflict(guild_id,config_key) do update set config=excluded.config,updated_at=now();
  return true;
end $$;

create or replace function public.discord_bot_record_interaction(p_id text,p_type text)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  if p_id !~ '^[1-9][0-9]{16,19}$' or length(coalesce(p_type,'')) not between 1 and 80 then return false; end if;
  insert into snoozer.discord_bot_interaction_receipts(interaction_id,interaction_type) values(p_id,p_type)
    on conflict(interaction_id) do nothing;
  return found;
end $$;

create or replace function public.discord_bot_entitlement_sync_enqueue()
returns trigger language plpgsql security definer set search_path='' as $$
declare owner uuid;
begin
  if tg_op='DELETE' then owner:=old.owner_id; else owner:=new.owner_id; end if;
  insert into snoozer.discord_bot_jobs(guild_id,job_type,dedupe_key,payload)
    select r.discord_id,'premium_role_sync','premium-role-sync:'||owner::text,
      jsonb_build_object('owner_id',owner)
    from snoozer.discord_bot_resources r
    where r.resource_key='guild' and r.resource_type='category'
    on conflict(dedupe_key) do update set
      payload=excluded.payload,status='pending',run_at=now(),locked_at=null,updated_at=now();
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;

drop trigger if exists discord_bot_entitlement_sync on snoozer.entitlement_grants;
create trigger discord_bot_entitlement_sync
after insert or update or delete on snoozer.entitlement_grants
for each row execute function public.discord_bot_entitlement_sync_enqueue();

-- Functions are exposed only as service-role operations. They must never be called from a browser.
revoke all on function public.discord_bot_register_resources(text,jsonb),
  public.discord_bot_get_resources(text),public.discord_bot_save_backup(text,text,jsonb),
  public.discord_bot_open_ticket(text,text,text,text,text,text),public.discord_bot_ticket_action(uuid,text,text,jsonb),
  public.discord_bot_ticket_queue(text,integer),public.discord_bot_create_case(text,text,text,text,text,integer,integer,jsonb),
  public.discord_bot_case_history(text,text,integer),public.discord_bot_create_appeal(uuid,text,text),
  public.discord_bot_creator_request(text,text,text),public.discord_bot_creator_review(uuid,text,text,text),
  public.discord_bot_submission_create(text,text,text,text,text,jsonb),public.discord_bot_submission_vote(uuid,text,text),
  public.discord_bot_role_sync_targets(text),public.discord_bot_member_summary(text),
  public.discord_bot_claim_jobs(text,integer),public.discord_bot_finish_job(uuid,boolean,text),
  public.discord_bot_config_get(text),public.discord_bot_config_set(text,text,jsonb),
  public.discord_bot_record_interaction(text,text),public.discord_bot_entitlement_sync_enqueue()
from public,anon,authenticated;
grant execute on function public.discord_bot_register_resources(text,jsonb),
  public.discord_bot_get_resources(text),public.discord_bot_save_backup(text,text,jsonb),
  public.discord_bot_open_ticket(text,text,text,text,text,text),public.discord_bot_ticket_action(uuid,text,text,jsonb),
  public.discord_bot_ticket_queue(text,integer),public.discord_bot_create_case(text,text,text,text,text,integer,integer,jsonb),
  public.discord_bot_case_history(text,text,integer),public.discord_bot_create_appeal(uuid,text,text),
  public.discord_bot_creator_request(text,text,text),public.discord_bot_creator_review(uuid,text,text,text),
  public.discord_bot_submission_create(text,text,text,text,text,jsonb),public.discord_bot_submission_vote(uuid,text,text),
  public.discord_bot_role_sync_targets(text),public.discord_bot_member_summary(text),
  public.discord_bot_claim_jobs(text,integer),public.discord_bot_finish_job(uuid,boolean,text),
  public.discord_bot_config_get(text),public.discord_bot_config_set(text,text,jsonb),
  public.discord_bot_record_interaction(text,text) to service_role;

revoke all on function public.discord_bot_entitlement_sync_enqueue() from service_role;

    or length(coalesce(p_choice,'')) not between 1 and 100 then raise exception 'Invalid vote'; end if;
  if not exists(select 1 from snoozer.discord_bot_submissions where id=p_id and status in ('open','approved')) then
    raise exception 'Submission is not open for voting';
  end if;
  insert into snoozer.discord_bot_votes(submission_id,voter_discord_id,choice) values(p_id,p_voter,p_choice)
    on conflict(submission_id,voter_discord_id) do update set choice=excluded.choice,created_at=now();
  select count(*) into total from snoozer.discord_bot_votes where submission_id=p_id;
  return jsonb_build_object('votes',total,
    'upvotes',(select count(*) from snoozer.discord_bot_votes where submission_id=p_id and choice='up'));
end $$;

create or replace function public.discord_bot_role_sync_targets(p_guild_id text)
returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'discord_user_id',i.provider_id,
    'premium',exists(select 1 from snoozer.entitlement_grants e
      where e.owner_id=i.user_id and e.revoked_at is null and e.starts_at<=now()
        and (e.expires_at is null or e.expires_at>now()) and not coalesce(e.payment_held,false)
        and e.plan in ('plus','pro','studio')),
    'creator',exists(select 1 from snoozer.discord_bot_creator_verifications v
      where v.discord_user_id=i.provider_id and v.status='approved')
  )),'[]'::jsonb)
  from auth.identities i
  where i.provider='discord' and i.provider_id ~ '^[1-9][0-9]{16,19}$'
    and exists(select 1 from auth.users u where u.id=i.user_id)
$$;

create or replace function public.discord_bot_member_summary(p_discord_user_id text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare owner uuid;
declare profile_name text;
declare display_name text;
declare plan_name text;
declare premium boolean;
declare creator boolean;
begin
  if p_discord_user_id !~ '^[1-9][0-9]{16,19}$' then return null; end if;
  select user_id into owner from auth.identities where provider='discord' and provider_id=p_discord_user_id limit 1;
  if owner is null then return jsonb_build_object('linked',false); end if;
  select username,display_name into profile_name,display_name from snoozer.profiles where owner_id=owner order by created_at limit 1;
  select plan into plan_name from snoozer.entitlement_grants
    where owner_id=owner and revoked_at is null and starts_at<=now()
      and (expires_at is null or expires_at>now()) and not coalesce(payment_held,false)
      and plan in ('plus','pro','studio')
    order by case plan when 'studio' then 1 when 'pro' then 2 else 3 end limit 1;
  premium:=plan_name is not null;
  select exists(select 1 from snoozer.discord_bot_creator_verifications where discord_user_id=p_discord_user_id and status='approved') into creator;
  return jsonb_build_object('linked',true,'username',profile_name,'display_name',display_name,
    'premium',premium,'plan',plan_name,'creator',creator,'profile_url',case when profile_name is null then null else 'https://snoozer.uk/'||profile_name end);
end $$;

create or replace function public.discord_bot_claim_jobs(p_guild_id text,p_limit integer default 20)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  with picked as (
    select id from snoozer.discord_bot_jobs
    where guild_id=p_guild_id and run_at<=now()
      and (status='pending' or (status='processing' and locked_at<now()-interval '5 minutes'))
    order by run_at,created_at limit least(greatest(coalesce(p_limit,20),1),50)
    for update skip locked
  ), changed as (
    update snoozer.discord_bot_jobs j set status='processing',locked_at=now(),attempts=attempts+1,updated_at=now()
    from picked where j.id=picked.id returning j.*
  )
  select coalesce(jsonb_agg(to_jsonb(changed)),'[]'::jsonb) into result from changed;
  return result;
end $$;

create or replace function public.discord_bot_finish_job(p_id uuid,p_success boolean,p_error text default null)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  update snoozer.discord_bot_jobs set
    status=case when p_success then 'done' when attempts>=8 then 'failed' else 'pending' end,
    run_at=case when p_success then run_at else now()+make_interval(secs=>least(3600,30*(2^least(attempts,6))::integer)) end,
    locked_at=null,last_error=case when p_success then null else left(coalesce(p_error,'Failed'),1000) end,updated_at=now()
  where id=p_id and status='processing';
  return found;
end $$;

create or replace function public.discord_bot_config_get(p_guild_id text)
returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_object_agg(config_key,config),'{}'::jsonb)
  from snoozer.discord_bot_config where guild_id=p_guild_id
$$;

create or replace function public.discord_bot_config_set(p_guild_id text,p_key text,p_config jsonb)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  if p_guild_id !~ '^[1-9][0-9]{16,19}$' or p_key !~ '^[a-z][a-z0-9_]{1,79}$'
    or jsonb_typeof(p_config)<>'object' or octet_length(p_config::text)>16384 then return false; end if;
  insert into snoozer.discord_bot_config(guild_id,config_key,config) values(p_guild_id,p_key,p_config)
    on conflict(guild_id,config_key) do update set config=excluded.config,updated_at=now();
  return true;
end $$;

create or replace function public.discord_bot_record_interaction(p_id text,p_type text)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  if p_id !~ '^[1-9][0-9]{16,19}$' or length(coalesce(p_type,'')) not between 1 and 80 then return false; end if;
  insert into snoozer.discord_bot_interaction_receipts(interaction_id,interaction_type) values(p_id,p_type)
    on conflict(interaction_id) do nothing;
  return found;
end $$;

create or replace function public.discord_bot_entitlement_sync_enqueue()
returns trigger language plpgsql security definer set search_path='' as $$
declare owner uuid;
begin
  if tg_op='DELETE' then owner:=old.owner_id; else owner:=new.owner_id; end if;
  insert into snoozer.discord_bot_jobs(guild_id,job_type,dedupe_key,payload)
    select r.discord_id,'premium_role_sync','premium-role-sync:'||owner::text,
      jsonb_build_object('owner_id',owner)
    from snoozer.discord_bot_resources r
    where r.resource_key='guild' and r.resource_type='category'
    on conflict(dedupe_key) do update set
      payload=excluded.payload,status='pending',run_at=now(),locked_at=null,updated_at=now();
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;

drop trigger if exists discord_bot_entitlement_sync on snoozer.entitlement_grants;
create trigger discord_bot_entitlement_sync
after insert or update or delete on snoozer.entitlement_grants
for each row execute function public.discord_bot_entitlement_sync_enqueue();

-- Functions are exposed only as service-role operations. They must never be called from a browser.
revoke all on function public.discord_bot_register_resources(text,jsonb),
  public.discord_bot_get_resources(text),public.discord_bot_save_backup(text,text,jsonb),
  public.discord_bot_open_ticket(text,text,text,text,text,text),public.discord_bot_ticket_action(uuid,text,text,jsonb),
  public.discord_bot_ticket_queue(text,integer),public.discord_bot_create_case(text,text,text,text,text,integer,integer,jsonb),
  public.discord_bot_case_history(text,text,integer),public.discord_bot_create_appeal(uuid,text,text),
  public.discord_bot_creator_request(text,text,text),public.discord_bot_creator_review(uuid,text,text,text),
  public.discord_bot_submission_create(text,text,text,text,text,jsonb),public.discord_bot_submission_vote(uuid,text,text),
  public.discord_bot_role_sync_targets(text),public.discord_bot_member_summary(text),
  public.discord_bot_claim_jobs(text,integer),public.discord_bot_finish_job(uuid,boolean,text),
  public.discord_bot_config_get(text),public.discord_bot_config_set(text,text,jsonb),
  public.discord_bot_record_interaction(text,text),public.discord_bot_entitlement_sync_enqueue()
from public,anon,authenticated;
grant execute on function public.discord_bot_register_resources(text,jsonb),
  public.discord_bot_get_resources(text),public.discord_bot_save_backup(text,text,jsonb),
  public.discord_bot_open_ticket(text,text,text,text,text,text),public.discord_bot_ticket_action(uuid,text,text,jsonb),
  public.discord_bot_ticket_queue(text,integer),public.discord_bot_create_case(text,text,text,text,text,integer,integer,jsonb),
  public.discord_bot_case_history(text,text,integer),public.discord_bot_create_appeal(uuid,text,text),
  public.discord_bot_creator_request(text,text,text),public.discord_bot_creator_review(uuid,text,text,text),
  public.discord_bot_submission_create(text,text,text,text,text,jsonb),public.discord_bot_submission_vote(uuid,text,text),
  public.discord_bot_role_sync_targets(text),public.discord_bot_member_summary(text),
  public.discord_bot_claim_jobs(text,integer),public.discord_bot_finish_job(uuid,boolean,text),
  public.discord_bot_config_get(text),public.discord_bot_config_set(text,text,jsonb),
  public.discord_bot_record_interaction(text,text) to service_role;

revoke all on function public.discord_bot_entitlement_sync_enqueue() from service_role;
