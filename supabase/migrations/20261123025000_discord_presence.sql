-- First-party Discord presence for published profiles.
-- Only the creator-selected fields are retained; public access is through a read-only projection.

create table snoozer.discord_presence_links (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  discord_user_id text not null unique check (discord_user_id ~ '^[1-9][0-9]{16,19}$'),
  linked_at timestamptz not null default now()
);

create table snoozer.discord_presence_settings (
  profile_id uuid primary key references snoozer.profiles(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  show_status boolean not null default true,
  show_activity boolean not null default true,
  show_custom_status boolean not null default false,
  updated_at timestamptz not null default now()
);
create index discord_presence_settings_owner on snoozer.discord_presence_settings(owner_id);

create table snoozer.discord_presence_cache (
  discord_user_id text primary key references snoozer.discord_presence_links(discord_user_id) on delete cascade
    check (discord_user_id ~ '^[1-9][0-9]{16,19}$'),
  status text check (status is null or status in ('online','idle','dnd','offline')),
  activity jsonb check (activity is null or (jsonb_typeof(activity)='object' and octet_length(activity::text)<=1024)),
  custom_status text check (custom_status is null or char_length(custom_status)<=128),
  observed_at timestamptz not null,
  expires_at timestamptz not null
);
create index discord_presence_cache_expiry on snoozer.discord_presence_cache(expires_at);

create table snoozer.discord_presence_events (
  event_id uuid primary key,
  discord_user_id text not null references snoozer.discord_presence_links(discord_user_id) on delete cascade
    check (discord_user_id ~ '^[1-9][0-9]{16,19}$'),
  created_at timestamptz not null default now()
);
create index discord_presence_events_retention on snoozer.discord_presence_events(created_at);

create table snoozer.discord_presence_worker_state (
  id boolean primary key default true check (id),
  connected boolean not null default false,
  guild_ready boolean not null default false,
  heartbeat_at timestamptz not null default now()
);

alter table snoozer.discord_presence_links enable row level security;
alter table snoozer.discord_presence_settings enable row level security;
alter table snoozer.discord_presence_cache enable row level security;
alter table snoozer.discord_presence_events enable row level security;
alter table snoozer.discord_presence_worker_state enable row level security;
revoke all on snoozer.discord_presence_links, snoozer.discord_presence_settings,
  snoozer.discord_presence_cache, snoozer.discord_presence_events,
  snoozer.discord_presence_worker_state from public, anon, authenticated, service_role;

comment on table snoozer.discord_presence_links is
  'One verified Discord identity per Snoozer account. Deleted when the creator disconnects or deletes the account.';
comment on table snoozer.discord_presence_settings is
  'Per-profile public Discord presence consent and field visibility. Disabled by default.';
comment on table snoozer.discord_presence_cache is
  'Current minimal presence snapshot only; refreshed by the Gateway worker and expires after ten minutes.';
comment on table snoozer.discord_presence_events is
  'Short-lived event IDs used to reject replayed Gateway updates; pruned after 24 hours.';
comment on table snoozer.discord_presence_worker_state is
  'Worker heartbeat only. Public presence is unavailable when the heartbeat or guild connection is stale.';

create or replace function snoozer.discord_presence_prune_owner(p_owner uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare discord_id text;
declare allow_status boolean;
declare allow_activity boolean;
declare allow_custom_status boolean;
begin
  select discord_user_id into discord_id from snoozer.discord_presence_links where owner_id=p_owner;
  if discord_id is null then return; end if;

  select bool_or(s.show_status),bool_or(s.show_activity),bool_or(s.show_custom_status)
    into allow_status,allow_activity,allow_custom_status
    from snoozer.discord_presence_settings s
    join snoozer.profiles p on p.id=s.profile_id and p.owner_id=s.owner_id
    join snoozer.published_profiles pp on pp.profile_id=p.id and pp.owner_id=p.owner_id
      and pp.revision=p.published_revision
    where s.owner_id=p_owner and s.enabled
      and (s.show_status or s.show_activity or s.show_custom_status);

  if allow_status is null then
    delete from snoozer.discord_presence_cache where discord_user_id=discord_id;
    delete from snoozer.discord_presence_events where discord_user_id=discord_id;
    return;
  end if;

  -- Purge individual fields as soon as the last published profile revokes consent.
  update snoozer.discord_presence_cache set
    status=case when allow_status then status else null end,
    activity=case when allow_activity then activity else null end,
    custom_status=case when allow_custom_status then custom_status else null end
  where discord_user_id=discord_id;
end;
$$;

create or replace function snoozer.discord_presence_prune_trigger() returns trigger
language plpgsql security definer set search_path = '' as $$
declare owner_id uuid;
begin
  if tg_op='DELETE' then owner_id:=old.owner_id; else owner_id:=new.owner_id; end if;
  perform snoozer.discord_presence_prune_owner(owner_id);
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;

create trigger discord_presence_settings_prune
  after update or delete on snoozer.discord_presence_settings
  for each row execute function snoozer.discord_presence_prune_trigger();

create trigger discord_presence_publication_prune
  after delete or update on snoozer.published_profiles
  for each row execute function snoozer.discord_presence_prune_trigger();

revoke all on function snoozer.discord_presence_prune_owner(uuid),
  snoozer.discord_presence_prune_trigger() from public,anon,authenticated,service_role;

create or replace function public.discord_presence_get_my_settings(p_profile uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := snoozer.verified_user();
declare settings snoozer.discord_presence_settings;
declare linked boolean;
declare service_ready boolean;
begin
  if p_profile is null or not exists (
    select 1 from snoozer.profiles where id=p_profile and owner_id=actor
  ) then
    raise exception 'Profile not found' using errcode='42501';
  end if;

  select exists (
    select 1 from auth.identities
    where user_id=actor and provider='discord' and provider_id ~ '^[1-9][0-9]{16,19}$'
  ) into linked;

  select * into settings from snoozer.discord_presence_settings
    where profile_id=p_profile and owner_id=actor;

  select coalesce((
    select connected and guild_ready and heartbeat_at > now()-interval '90 seconds'
    from snoozer.discord_presence_worker_state where id=true
  ), false) into service_ready;

  return jsonb_build_object(
    'connected', linked,
    'enabled', coalesce(settings.enabled,false),
    'showStatus', coalesce(settings.show_status,true),
    'showActivity', coalesce(settings.show_activity,true),
    'showCustomStatus', coalesce(settings.show_custom_status,false),
    'serviceReady', service_ready
  );
end;
$$;

create or replace function public.discord_presence_save_settings(
  p_profile uuid,
  p_enabled boolean,
  p_show_status boolean,
  p_show_activity boolean,
  p_show_custom_status boolean
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid := snoozer.verified_user();
declare discord_id text;
declare linked_row snoozer.discord_presence_links;
begin
  if p_profile is null or p_enabled is null or p_show_status is null
    or p_show_activity is null or p_show_custom_status is null then
    raise exception 'Invalid presence settings' using errcode='22023';
  end if;
  if p_enabled and not (p_show_status or p_show_activity or p_show_custom_status) then
    raise exception 'Choose at least one Discord presence field to share' using errcode='22023';
  end if;
  if not exists (select 1 from snoozer.profiles where id=p_profile and owner_id=actor) then
    raise exception 'Profile not found' using errcode='42501';
  end if;

  select provider_id into discord_id from auth.identities
    where user_id=actor and provider='discord' and provider_id ~ '^[1-9][0-9]{16,19}$'
    order by created_at desc limit 1;
  if discord_id is null then
    raise exception 'Connect a Discord account before enabling presence' using errcode='42501';
  end if;

  begin
    insert into snoozer.discord_presence_links(owner_id,discord_user_id)
      values(actor,discord_id)
      on conflict(owner_id) do update
        set discord_user_id=excluded.discord_user_id
        where snoozer.discord_presence_links.discord_user_id=excluded.discord_user_id
      returning * into linked_row;
  exception when unique_violation then
    raise exception 'This Discord account is already connected to another Snoozer account' using errcode='23505';
  end;
  if not found then
    raise exception 'Disconnect the previous Discord identity before changing accounts' using errcode='23505';
  end if;

  insert into snoozer.discord_presence_settings(
    profile_id,owner_id,enabled,show_status,show_activity,show_custom_status,updated_at
  ) values (
    p_profile,actor,p_enabled,p_show_status,p_show_activity,p_show_custom_status,now()
  )
  on conflict(profile_id) do update set
    enabled=excluded.enabled,
    show_status=excluded.show_status,
    show_activity=excluded.show_activity,
    show_custom_status=excluded.show_custom_status,
    updated_at=now()
  where snoozer.discord_presence_settings.owner_id=actor;

  if not found then
    raise exception 'Profile presence settings could not be saved' using errcode='42501';
  end if;

  if not exists (
    select 1
    from snoozer.discord_presence_settings s
    join snoozer.profiles p on p.id=s.profile_id and p.owner_id=s.owner_id
    join snoozer.published_profiles pp on pp.profile_id=p.id and pp.owner_id=p.owner_id
      and pp.revision=p.published_revision
    where s.owner_id=actor and s.enabled
      and (s.show_status or s.show_activity or s.show_custom_status)
  ) then
    delete from snoozer.discord_presence_cache where discord_user_id=discord_id;
    delete from snoozer.discord_presence_events where discord_user_id=discord_id;
  end if;

  return public.discord_presence_get_my_settings(p_profile);
end;
$$;

create or replace function public.discord_presence_disconnect() returns boolean
language plpgsql security definer set search_path = '' as $$
declare actor uuid := snoozer.verified_user();
declare discord_id text;
begin
  update snoozer.discord_presence_settings set enabled=false,updated_at=now()
    where owner_id=actor;
  delete from snoozer.discord_presence_links where owner_id=actor
    returning discord_user_id into discord_id;
  -- Cache and event rows cascade from the deleted identity mapping.
  return true;
end;
$$;

create or replace function public.discord_presence_export() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := snoozer.verified_user();
begin
  return jsonb_build_object(
    'discord_user_id',(select discord_user_id from snoozer.discord_presence_links where owner_id=actor),
    'linked_at',(select linked_at from snoozer.discord_presence_links where owner_id=actor),
    'profiles',coalesce((select jsonb_agg(jsonb_build_object(
      'profile_id',s.profile_id,'enabled',s.enabled,'show_status',s.show_status,
      'show_activity',s.show_activity,'show_custom_status',s.show_custom_status,'updated_at',s.updated_at
    ) order by s.profile_id) from snoozer.discord_presence_settings s where s.owner_id=actor),'[]'::jsonb),
    'current_presence',(select jsonb_build_object(
      'status',c.status,'activity',c.activity,'custom_status',c.custom_status,'observed_at',c.observed_at
    ) from snoozer.discord_presence_links l join snoozer.discord_presence_cache c
      on c.discord_user_id=l.discord_user_id where l.owner_id=actor)
  );
end;
$$;

create or replace function public.discord_presence_public(p_username text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'version',1,
    'state',case when coalesce(
      w.connected and w.guild_ready and w.heartbeat_at > now()-interval '90 seconds'
        and c.discord_user_id is not null and c.expires_at > now(), false
    ) then 'live' else 'unavailable' end,
    'status',case when s.show_status and coalesce(
      w.connected and w.guild_ready and w.heartbeat_at > now()-interval '90 seconds'
        and c.discord_user_id is not null and c.expires_at > now(), false
    ) then c.status else null end,
    'activity',case when s.show_activity and coalesce(
      w.connected and w.guild_ready and w.heartbeat_at > now()-interval '90 seconds'
        and c.discord_user_id is not null and c.expires_at > now(), false
    ) then c.activity else null end,
    'customStatus',case when s.show_custom_status and coalesce(
      w.connected and w.guild_ready and w.heartbeat_at > now()-interval '90 seconds'
        and c.discord_user_id is not null and c.expires_at > now(), false
    ) then c.custom_status else null end,
    'observedAt',case when coalesce(
      w.connected and w.guild_ready and w.heartbeat_at > now()-interval '90 seconds'
        and c.discord_user_id is not null and c.expires_at > now(), false
    ) then c.observed_at else null end
  )
  from snoozer.profiles p
  join snoozer.published_profiles pp on pp.profile_id=p.id and pp.owner_id=p.owner_id
    and pp.revision=p.published_revision
  join snoozer.discord_presence_settings s on s.profile_id=p.id and s.owner_id=p.owner_id and s.enabled
  join snoozer.discord_presence_links l on l.owner_id=p.owner_id
  join auth.identities i on i.user_id=l.owner_id and i.provider='discord' and i.provider_id=l.discord_user_id
  left join snoozer.discord_presence_cache c on c.discord_user_id=l.discord_user_id
  left join snoozer.discord_presence_worker_state w on w.id=true
  where p.username=p_username
    and (s.show_status or s.show_activity or s.show_custom_status)
  limit 1
$$;

create or replace function public.discord_presence_subscriptions() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare active_subscriptions jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
    'discordUserId',ids.discord_user_id,
    'showStatus',ids.show_status,
    'showActivity',ids.show_activity,
    'showCustomStatus',ids.show_custom_status
  ) order by ids.discord_user_id),'[]'::jsonb)
    into active_subscriptions
    from (
      select l.discord_user_id,
        bool_or(s.show_status) as show_status,
        bool_or(s.show_activity) as show_activity,
        bool_or(s.show_custom_status) as show_custom_status
      from snoozer.discord_presence_links l
      join auth.identities i on i.user_id=l.owner_id and i.provider='discord' and i.provider_id=l.discord_user_id
      join snoozer.discord_presence_settings s on s.owner_id=l.owner_id and s.enabled
        and (s.show_status or s.show_activity or s.show_custom_status)
      join snoozer.profiles p on p.id=s.profile_id and p.owner_id=s.owner_id and p.published_revision is not null
      join snoozer.published_profiles pp on pp.profile_id=p.id and pp.owner_id=p.owner_id
        and pp.revision=p.published_revision
      group by l.discord_user_id
    ) ids;

  delete from snoozer.discord_presence_cache where expires_at <= now();
  delete from snoozer.discord_presence_cache c
    where not exists (
      select 1 from jsonb_array_elements(active_subscriptions) a
      where a->>'discordUserId'=c.discord_user_id
    );
  delete from snoozer.discord_presence_events e
    where e.created_at < now()-interval '24 hours'
      or not exists (
        select 1 from jsonb_array_elements(active_subscriptions) a
        where a->>'discordUserId'=e.discord_user_id
      );

  return active_subscriptions;
end;
$$;

create or replace function public.discord_presence_heartbeat(p_connected boolean,p_guild_ready boolean) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if p_connected is null or p_guild_ready is null then
    raise exception 'Invalid worker heartbeat' using errcode='22023';
  end if;
  insert into snoozer.discord_presence_worker_state(id,connected,guild_ready,heartbeat_at)
    values(true,p_connected,p_connected and p_guild_ready,now())
    on conflict(id) do update set
      connected=excluded.connected,
      guild_ready=excluded.guild_ready,
      heartbeat_at=now();
  return true;
end;
$$;

create or replace function public.discord_presence_ingest(
  p_event_id uuid,
  p_discord_user_id text,
  p_status text,
  p_activity jsonb,
  p_custom_status text,
  p_observed_at timestamptz
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare allow_status boolean;
declare allow_activity boolean;
declare allow_custom_status boolean;
begin
  if p_event_id is null or p_discord_user_id is null
    or p_discord_user_id !~ '^[1-9][0-9]{16,19}$'
    or (p_status is not null and p_status not in ('online','idle','dnd','offline'))
    or p_observed_at is null
    or p_observed_at > now()+interval '30 seconds'
    or p_observed_at < now()-interval '5 minutes'
    or (p_custom_status is not null and char_length(p_custom_status)>128)
    or (p_activity is not null and (
      jsonb_typeof(p_activity)<>'object'
      or octet_length(p_activity::text)>1024
      or p_activity->>'type' is null
      or p_activity->>'type' not in ('playing','streaming','listening','watching','competing')
      or p_activity->>'name' is null
      or char_length(coalesce(p_activity->>'name','')) not between 1 and 100
      or char_length(coalesce(p_activity->>'details',''))>120
      or char_length(coalesce(p_activity->>'state',''))>120
      or exists(select 1 from jsonb_object_keys(p_activity) as keys(key) where key not in ('type','name','details','state'))
    )) then
    raise exception 'Invalid Discord presence event' using errcode='22023';
  end if;

  select bool_or(s.show_status),bool_or(s.show_activity),bool_or(s.show_custom_status)
    into allow_status,allow_activity,allow_custom_status
    from snoozer.discord_presence_links l
    join auth.identities i on i.user_id=l.owner_id and i.provider='discord' and i.provider_id=l.discord_user_id
    join snoozer.discord_presence_settings s on s.owner_id=l.owner_id and s.enabled
      and (s.show_status or s.show_activity or s.show_custom_status)
    join snoozer.profiles p on p.id=s.profile_id and p.owner_id=s.owner_id and p.published_revision is not null
    join snoozer.published_profiles pp on pp.profile_id=p.id and pp.owner_id=p.owner_id
      and pp.revision=p.published_revision
    where l.discord_user_id=p_discord_user_id;

  if allow_status is null then return true; end if;
  if (allow_status and p_status is null) or (not allow_status and p_status is not null)
    or (not allow_activity and p_activity is not null)
    or (not allow_custom_status and p_custom_status is not null) then
    raise exception 'Discord presence fields exceed the creator consent settings' using errcode='22023';
  end if;

  insert into snoozer.discord_presence_events(event_id,discord_user_id)
    values(p_event_id,p_discord_user_id) on conflict(event_id) do nothing;
  if not found then return true; end if;

  insert into snoozer.discord_presence_cache(
    discord_user_id,status,activity,custom_status,observed_at,expires_at
  ) values (
    p_discord_user_id,p_status,p_activity,p_custom_status,p_observed_at,now()+interval '10 minutes'
  )
  on conflict(discord_user_id) do update set
    status=excluded.status,
    activity=excluded.activity,
    custom_status=excluded.custom_status,
    observed_at=excluded.observed_at,
    expires_at=excluded.expires_at
  where excluded.observed_at > snoozer.discord_presence_cache.observed_at;

  return true;
end;
$$;

create or replace function public.discord_presence_clear(p_discord_user_id text,p_event_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if p_discord_user_id is null or p_discord_user_id !~ '^[1-9][0-9]{16,19}$' or p_event_id is null then
    raise exception 'Invalid Discord presence clear' using errcode='22023';
  end if;
  if not exists (
    select 1 from snoozer.discord_presence_links l
    join auth.identities i on i.user_id=l.owner_id and i.provider='discord' and i.provider_id=l.discord_user_id
    join snoozer.discord_presence_settings s on s.owner_id=l.owner_id and s.enabled
    join snoozer.profiles p on p.id=s.profile_id and p.owner_id=s.owner_id and p.published_revision is not null
    join snoozer.published_profiles pp on pp.profile_id=p.id and pp.owner_id=p.owner_id and pp.revision=p.published_revision
    where l.discord_user_id=p_discord_user_id
  ) then return true; end if;
  delete from snoozer.discord_presence_cache where discord_user_id=p_discord_user_id;
  return true;
end;
$$;

revoke all on function public.discord_presence_get_my_settings(uuid),
  public.discord_presence_save_settings(uuid,boolean,boolean,boolean,boolean),
  public.discord_presence_disconnect(),
  public.discord_presence_export(),
  public.discord_presence_public(text),
  public.discord_presence_subscriptions(),
  public.discord_presence_heartbeat(boolean,boolean),
  public.discord_presence_ingest(uuid,text,text,jsonb,text,timestamptz),
  public.discord_presence_clear(text,uuid)
  from public,anon,authenticated,service_role;

grant execute on function public.discord_presence_get_my_settings(uuid),
  public.discord_presence_save_settings(uuid,boolean,boolean,boolean,boolean),
  public.discord_presence_disconnect(),
  public.discord_presence_export()
  to authenticated;
grant execute on function public.discord_presence_public(text) to anon,authenticated;
grant execute on function public.discord_presence_subscriptions(),
  public.discord_presence_heartbeat(boolean,boolean),
  public.discord_presence_ingest(uuid,text,text,jsonb,text,timestamptz),
  public.discord_presence_clear(text,uuid)
  to service_role;
