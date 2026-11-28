create table snoozer.discord_bot_security_events (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null check(guild_id ~ '^[1-9][0-9]{16,19}$'),
  action text not null check(char_length(action) between 3 and 100),
  actor_discord_id text check(actor_discord_id is null or actor_discord_id ~ '^[1-9][0-9]{16,19}$'),
  target_discord_id text check(target_discord_id is null or target_discord_id ~ '^[1-9][0-9]{16,19}$'),
  severity text not null default 'warning' check(severity in ('info','warning','critical')),
  metadata jsonb not null default '{}'::jsonb check(jsonb_typeof(metadata)='object' and octet_length(metadata::text)<=16384),
  created_at timestamptz not null default now()
);
create index discord_bot_security_events_recent on snoozer.discord_bot_security_events(guild_id,created_at desc);
create index discord_bot_security_events_actor on snoozer.discord_bot_security_events(guild_id,actor_discord_id,created_at desc);

create table snoozer.discord_bot_scheduled_events (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null check(guild_id ~ '^[1-9][0-9]{16,19}$'),
  discord_event_id text unique check(discord_event_id is null or discord_event_id ~ '^[1-9][0-9]{16,19}$'),
  channel_id text check(channel_id is null or channel_id ~ '^[1-9][0-9]{16,19}$'),
  created_by text not null check(created_by ~ '^[1-9][0-9]{16,19}$'),
  name text not null check(char_length(name) between 4 and 100),
  description text not null check(char_length(description) between 10 and 1000),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'scheduled' check(status in ('scheduled','active','completed','cancelled')),
  reminder_sent_at timestamptz,
  created_at timestamptz not null default now(),
  check(ends_at>starts_at)
);
create index discord_bot_scheduled_events_due on snoozer.discord_bot_scheduled_events(guild_id,starts_at) where status='scheduled';

alter table snoozer.discord_bot_jobs drop constraint if exists discord_bot_jobs_job_type_check;
alter table snoozer.discord_bot_jobs add constraint discord_bot_jobs_job_type_check
  check(job_type in ('premium_role_sync','creator_role_sync','announcement','ticket_reminder','scheduled_event','giveaway_finish','backup','health_check','role_reconcile','tempban_unban'));

create or replace function public.discord_bot_record_security_event(
  p_guild_id text,p_action text,p_actor text default null,p_target text default null,
  p_severity text default 'warning',p_metadata jsonb default '{}'::jsonb
) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
  if p_guild_id !~ '^[1-9][0-9]{16,19}$' or length(coalesce(p_action,'')) not between 3 and 100
    or (p_actor is not null and p_actor !~ '^[1-9][0-9]{16,19}$')
    or (p_target is not null and p_target !~ '^[1-9][0-9]{16,19}$')
    or p_severity not in ('info','warning','critical')
    or jsonb_typeof(coalesce(p_metadata,'{}'::jsonb))<>'object'
    or octet_length(coalesce(p_metadata,'{}'::jsonb)::text)>16384 then raise exception 'Invalid Discord security event'; end if;
  insert into snoozer.discord_bot_security_events(guild_id,action,actor_discord_id,target_discord_id,severity,metadata)
    values(p_guild_id,p_action,p_actor,p_target,p_severity,coalesce(p_metadata,'{}'::jsonb)) returning id into result;
  return result;
end $$;

create or replace function public.discord_bot_latest_backup(p_guild_id text)
returns jsonb language sql stable security definer set search_path='' as $$
  select to_jsonb(b) from snoozer.discord_bot_server_backups b where b.guild_id=p_guild_id order by b.created_at desc limit 1
$$;

create or replace function public.discord_bot_creator_queue(p_limit integer default 25)
returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) from (
    select id,discord_user_id,profile_url,reason,status,created_at from snoozer.discord_bot_creator_verifications
    where status='pending' order by created_at limit least(greatest(coalesce(p_limit,25),1),100)
  ) q
$$;

create or replace function public.discord_bot_active_warning_points(p_guild_id text,p_target text)
returns integer language sql stable security definer set search_path='' as $$
  select coalesce(sum(warning_points),0)::integer from snoozer.discord_bot_moderation_cases
  where guild_id=p_guild_id and target_discord_id=p_target and action='warn' and status='active'
    and warning_points>0 and (expires_at is null or expires_at>now())
$$;

create or replace function public.discord_bot_create_case(
  p_guild_id text,p_target text,p_moderator text,p_action text,p_reason text,
  p_duration_seconds integer default null,p_warning_points integer default 0,p_metadata jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare item snoozer.discord_bot_moderation_cases;
declare points integer:=0;
begin
  if p_guild_id !~ '^[1-9][0-9]{16,19}$' or p_target !~ '^[1-9][0-9]{16,19}$'
    or p_moderator !~ '^[1-9][0-9]{16,19}$'
    or p_action not in ('warn','timeout','kick','ban','tempban','unban','note','automod','anti_raid','anti_nuke')
    or length(coalesce(p_reason,'')) not between 3 and 1000
    or coalesce(p_warning_points,0) not between 0 and 100
    or jsonb_typeof(coalesce(p_metadata,'{}'::jsonb))<>'object' then raise exception 'Invalid moderation case'; end if;
  insert into snoozer.discord_bot_moderation_cases(guild_id,target_discord_id,moderator_discord_id,action,reason,duration_seconds,warning_points,expires_at,metadata)
  values(p_guild_id,p_target,p_moderator,p_action,p_reason,p_duration_seconds,p_warning_points,
    case when p_duration_seconds is not null then now()+make_interval(secs=>p_duration_seconds)
      when p_action='warn' then now()+interval '30 days' else null end,coalesce(p_metadata,'{}'::jsonb))
  returning * into item;
  if p_action='warn' then
    select coalesce(sum(warning_points),0)::integer into points from snoozer.discord_bot_moderation_cases
    where guild_id=p_guild_id and target_discord_id=p_target and action='warn' and status='active'
      and (expires_at is null or expires_at>now());
  end if;
  return to_jsonb(item)||jsonb_build_object('active_warning_points',points);
end $$;

create or replace function public.discord_bot_activity_increment(
 p_guild_id text,p_user text,p_messages integer default 0,p_voice_minutes integer default 0,p_date date default current_date
) returns boolean language plpgsql security definer set search_path='' as $$
begin
  if p_guild_id !~ '^[1-9][0-9]{16,19}$' or p_user !~ '^[1-9][0-9]{16,19}$'
    or coalesce(p_messages,0) not between 0 and 1000 or coalesce(p_voice_minutes,0) not between 0 and 1440
    or p_date is null or p_date>current_date then raise exception 'Invalid Discord activity increment'; end if;
  insert into snoozer.discord_bot_activity_daily(guild_id,discord_user_id,activity_date,message_count,voice_minutes)
  values(p_guild_id,p_user,p_date,p_messages,p_voice_minutes)
  on conflict(guild_id,discord_user_id,activity_date) do update set
    message_count=least(100000,snoozer.discord_bot_activity_daily.message_count+excluded.message_count),
    voice_minutes=least(1440,snoozer.discord_bot_activity_daily.voice_minutes+excluded.voice_minutes);
  return true;
end $$;

create or replace function public.discord_bot_activity_leaderboard(p_guild_id text,p_days integer default 30,p_limit integer default 25)
returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) from (
    select discord_user_id,sum(message_count)::integer as messages,sum(voice_minutes)::integer as voice_minutes,
      (sum(message_count)+sum(voice_minutes)*2)::integer as score
    from snoozer.discord_bot_activity_daily
    where guild_id=p_guild_id and activity_date>=current_date-least(greatest(coalesce(p_days,30),1),365)
    group by discord_user_id order by score desc,messages desc,discord_user_id
    limit least(greatest(coalesce(p_limit,25),1),50)
  ) q
$$;

create or replace function public.discord_bot_create_scheduled_event(
 p_guild_id text,p_discord_event_id text,p_channel_id text,p_actor text,p_name text,p_description text,
 p_starts_at timestamptz,p_ends_at timestamptz
) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
  if p_guild_id !~ '^[1-9][0-9]{16,19}$' or p_discord_event_id !~ '^[1-9][0-9]{16,19}$'
    or (p_channel_id is not null and p_channel_id !~ '^[1-9][0-9]{16,19}$')
    or p_actor !~ '^[1-9][0-9]{16,19}$' or length(coalesce(p_name,'')) not between 4 and 100
    or length(coalesce(p_description,'')) not between 10 and 1000
    or p_starts_at<=now() or p_starts_at>now()+interval '365 days'
    or p_ends_at<=p_starts_at or p_ends_at>p_starts_at+interval '7 days' then raise exception 'Invalid Discord scheduled event'; end if;
  insert into snoozer.discord_bot_scheduled_events(guild_id,discord_event_id,channel_id,created_by,name,description,starts_at,ends_at)
  values(p_guild_id,p_discord_event_id,p_channel_id,p_actor,p_name,p_description,p_starts_at,p_ends_at) returning id into result;
  return result;
end $$;

create or replace function public.discord_bot_scheduled_event_queue(p_guild_id text,p_limit integer default 25)
returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) from (
    select id,discord_event_id,channel_id,name,description,starts_at,ends_at,status from snoozer.discord_bot_scheduled_events
    where guild_id=p_guild_id and status='scheduled' order by starts_at limit least(greatest(coalesce(p_limit,25),1),50)
  ) q
$$;

create or replace function public.discord_bot_create_giveaway(
 p_guild_id text,p_channel_id text,p_title text,p_prize text,p_winner_count integer,
 p_ends_at timestamptz,p_minimum_role_id text,p_actor text
) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
  if p_guild_id !~ '^[1-9][0-9]{16,19}$' or p_channel_id !~ '^[1-9][0-9]{16,19}$'
    or length(coalesce(p_title,'')) not between 4 and 140 or length(coalesce(p_prize,'')) not between 2 and 300
    or p_winner_count not between 1 and 20 or p_ends_at<=now()+interval '1 minute'
    or p_ends_at>now()+interval '30 days' or (p_minimum_role_id is not null and p_minimum_role_id !~ '^[1-9][0-9]{16,19}$')
    or p_actor !~ '^[1-9][0-9]{16,19}$' then raise exception 'Invalid Discord giveaway'; end if;
  insert into snoozer.discord_bot_giveaways(guild_id,channel_id,title,prize,winner_count,ends_at,minimum_role_id,created_by)
  values(p_guild_id,p_channel_id,p_title,p_prize,p_winner_count,p_ends_at,p_minimum_role_id,p_actor) returning id into result;
  return result;
end $$;

create or replace function public.discord_bot_giveaway_enter(p_id uuid,p_user text,p_eligible boolean default true)
returns jsonb language plpgsql security definer set search_path='' as $$
declare total integer;
declare inserted integer;
declare required_role text;
begin
  if p_id is null or p_user !~ '^[1-9][0-9]{16,19}$' then raise exception 'Invalid giveaway entry'; end if;
  select minimum_role_id into required_role from snoozer.discord_bot_giveaways
    where id=p_id and status='active' and ends_at>now() for update;
  if not found then raise exception 'This giveaway has ended'; end if;
  if required_role is not null and not coalesce(p_eligible,false) then raise exception 'You do not meet this giveaway role requirement'; end if;
  insert into snoozer.discord_bot_giveaway_entries(giveaway_id,discord_user_id) values(p_id,p_user) on conflict do nothing;
  get diagnostics inserted = row_count;
  select count(*) into total from snoozer.discord_bot_giveaway_entries where giveaway_id=p_id;
  return jsonb_build_object('entered',inserted=1,'entries',total);
end $$;

create or replace function public.discord_bot_finish_giveaway(p_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  with chosen as (
    select e.discord_user_id from snoozer.discord_bot_giveaway_entries e
    join snoozer.discord_bot_giveaways g on g.id=e.giveaway_id
    where e.giveaway_id=p_id and g.status='active' and g.ends_at<=now()
    order by random() limit (select winner_count from snoozer.discord_bot_giveaways where id=p_id)
  ), updated as (
    update snoozer.discord_bot_giveaways g set status='ended',
      winners=coalesce((select jsonb_agg(jsonb_build_object('discord_user_id',c.discord_user_id)) from chosen c),'[]'::jsonb)
    where g.id=p_id and g.status='active' and g.ends_at<=now() returning g.*
  ) select to_jsonb(updated) into result from updated;
  return result;
end $$;

do $$
declare t text;
begin
  foreach t in array array['discord_bot_security_events','discord_bot_scheduled_events'] loop
    execute format('alter table snoozer.%I enable row level security',t);
    execute format('revoke all on snoozer.%I from public,anon,authenticated,service_role',t);
  end loop;
end $$;

revoke all on function public.discord_bot_record_security_event(text,text,text,text,text,jsonb),
 public.discord_bot_latest_backup(text),public.discord_bot_creator_queue(integer),public.discord_bot_active_warning_points(text,text),
 public.discord_bot_activity_increment(text,text,integer,integer,date),public.discord_bot_activity_leaderboard(text,integer,integer),
 public.discord_bot_create_scheduled_event(text,text,text,text,text,text,timestamptz,timestamptz),
 public.discord_bot_scheduled_event_queue(text,integer),public.discord_bot_create_giveaway(text,text,text,text,integer,timestamptz,text,text),
 public.discord_bot_giveaway_enter(uuid,text,boolean),public.discord_bot_finish_giveaway(uuid)
from public,anon,authenticated;
grant execute on function public.discord_bot_record_security_event(text,text,text,text,text,jsonb),
 public.discord_bot_latest_backup(text),public.discord_bot_creator_queue(integer),public.discord_bot_active_warning_points(text,text),
 public.discord_bot_activity_increment(text,text,integer,integer,date),public.discord_bot_activity_leaderboard(text,integer,integer),
 public.discord_bot_create_scheduled_event(text,text,text,text,text,text,timestamptz,timestamptz),
 public.discord_bot_scheduled_event_queue(text,integer),public.discord_bot_create_giveaway(text,text,text,text,integer,timestamptz,text,text),
 public.discord_bot_giveaway_enter(uuid,text,boolean),public.discord_bot_finish_giveaway(uuid)
to service_role;
