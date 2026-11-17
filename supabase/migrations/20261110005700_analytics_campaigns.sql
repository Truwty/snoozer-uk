-- Campaign labels are creator data. Visitor input can select only a generated,
-- active code belonging to the published profile, never an arbitrary dimension.
create table snoozer.analytics_campaigns (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references snoozer.profiles(id) on delete cascade,
  label text not null check (char_length(btrim(label)) between 1 and 80),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(profile_id,label)
);
create index analytics_campaigns_profile on snoozer.analytics_campaigns(profile_id,created_at,id);
create table snoozer.profile_traffic_days (
  profile_id uuid not null,
  day date not null,
  campaign_id uuid not null,
  source text not null check (source in ('direct','search','social','video','developer','email','other')),
  device text not null check (device in ('mobile','tablet','desktop','unknown')),
  views integer not null check (views between 0 and 10000),
  clicks integer not null check (clicks between 0 and 10000),
  primary key (profile_id,day,campaign_id,source,device),
  foreign key (profile_id,day) references snoozer.profile_view_days(profile_id,day) on delete cascade
);
-- The nil UUID is a no-campaign bucket, not an account or visitor identifier.
alter table snoozer.analytics_campaigns enable row level security;
alter table snoozer.profile_traffic_days enable row level security;
revoke all on snoozer.analytics_campaigns, snoozer.profile_traffic_days from public,anon,authenticated,service_role;

create function public.create_analytics_campaign(p_profile uuid,p_label text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare actor uuid := snoozer.verified_user(); campaign uuid;
begin
  if p_label is null or char_length(btrim(p_label)) not between 1 and 80 then
    raise exception 'Invalid campaign label' using errcode='22023';
  end if;
  perform 1 from snoozer.profiles where id=p_profile and owner_id=actor for update;
  if not found then raise exception 'Profile unavailable' using errcode='42501'; end if;
  select id into campaign from snoozer.analytics_campaigns where profile_id=p_profile and label=btrim(p_label);
  if campaign is not null then return campaign; end if;
  if (select count(*) from snoozer.analytics_campaigns where profile_id=p_profile) >= 20 then
    raise exception 'Campaign capacity reached' using errcode='P1006';
  end if;
  insert into snoozer.analytics_campaigns(profile_id,label) values(p_profile,btrim(p_label)) returning id into campaign;
  return campaign;
end;
$$;

create function public.set_analytics_campaign_active(p_profile uuid,p_campaign uuid,p_active boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare actor uuid := snoozer.verified_user();
begin
  if p_active is null then raise exception 'Invalid state' using errcode='22023'; end if;
  perform 1 from snoozer.profiles where id=p_profile and owner_id=actor for update;
  if not found then raise exception 'Profile unavailable' using errcode='42501'; end if;
  update snoozer.analytics_campaigns set active=p_active where id=p_campaign and profile_id=p_profile;
  if not found then raise exception 'Campaign unavailable' using errcode='42501'; end if;
end;
$$;

create function public.get_my_analytics_campaigns(p_profile uuid)
returns table(id uuid,label text,active boolean)
language sql stable security definer set search_path = '' as $$
  select c.id,c.label,c.active from snoozer.analytics_campaigns c join snoozer.profiles p on p.id=c.profile_id
  where p.id=p_profile and p.owner_id=snoozer.verified_user() order by c.created_at,c.id;
$$;

create function public.get_my_profile_traffic_totals(p_profile uuid)
returns table(campaign uuid,label text,source text,device text,views integer,clicks integer)
language sql stable security definer set search_path = '' as $$
  select nullif(d.campaign_id,'00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(c.label,'No campaign'),d.source,d.device,sum(d.views)::integer,sum(d.clicks)::integer
  from snoozer.profiles p join snoozer.profile_traffic_days d on d.profile_id=p.id
  left join snoozer.analytics_campaigns c on c.id=d.campaign_id and c.profile_id=p.id
  cross join lateral snoozer.effective_plan(p.owner_id) e
  where p.id=p_profile and p.owner_id=snoozer.verified_user()
    and d.day > (now() at time zone 'UTC')::date - (e.plan).analytics_days
  group by d.campaign_id,c.label,d.source,d.device
  order by sum(d.views) desc,sum(d.clicks) desc,d.campaign_id,d.source,d.device limit 1000;
$$;

revoke execute on function public.create_analytics_campaign(uuid,text),
  public.set_analytics_campaign_active(uuid,uuid,boolean),public.get_my_analytics_campaigns(uuid),
  public.get_my_profile_traffic_totals(uuid) from public,anon,authenticated,service_role;
grant execute on function public.create_analytics_campaign(uuid,text),
  public.set_analytics_campaign_active(uuid,uuid,boolean),public.get_my_analytics_campaigns(uuid),
  public.get_my_profile_traffic_totals(uuid) to authenticated;

create function public.record_profile_event_with_context(p_username text, p_event uuid, p_kind text, p_actor uuid,
  p_position integer default null, p_url text default null, p_source text default 'direct', p_campaign uuid default null, p_device text default 'unknown')
returns void language plpgsql security definer set search_path = '' as $$
declare
  target uuid;
  campaign_bucket uuid := '00000000-0000-0000-0000-000000000000';
  owner uuid;
  published integer;
  keep_days integer;
  utc_day date := (now() at time zone 'UTC')::date;
begin
  if p_event is null or p_kind is null or p_kind not in ('view','click') then return; end if;
  select id, owner_id, published_revision into target, owner, published from snoozer.profiles
    where username = p_username and published_revision is not null for share;
  if target is null or owner = p_actor then return; end if;
  if p_source is null or p_source not in ('direct','search','social','video','developer','email','other')
    or p_device is null or p_device not in ('mobile','tablet','desktop','unknown') then return; end if;
  select c.id into campaign_bucket from snoozer.analytics_campaigns c
    where c.id=p_campaign and c.profile_id=target and c.active;
  campaign_bucket := coalesce(campaign_bucket,'00000000-0000-0000-0000-000000000000'::uuid);
  if p_kind = 'click' and not exists (
    select 1 from snoozer.published_links where profile_id = target and revision = published
      and position = p_position and url = p_url
  ) then return; end if;

  select (e.plan).analytics_days into keep_days from snoozer.effective_plan(owner) e;
  if keep_days is null or keep_days <= 0 then return; end if;
  delete from snoozer.profile_view_days where profile_id = target and day <= utc_day - keep_days;
  -- Replay receipts carry no visitor identifier and expire after the UTC day.
  delete from snoozer.profile_view_receipts where profile_id = target and day < utc_day;

  insert into snoozer.profile_view_days(profile_id, day) values (target, utc_day)
    on conflict do nothing;
  perform 1 from snoozer.profile_view_days
    where profile_id = target and day = utc_day
      and case when p_kind = 'view' then views < 10000 else clicks < 10000 end for update;
  if not found then return; end if;

  insert into snoozer.profile_view_receipts(profile_id, day, event_id, kind)
    values (target, utc_day, p_event, p_kind) on conflict do nothing;
  if found then
    insert into snoozer.profile_traffic_days(profile_id,day,campaign_id,source,device,views,clicks)
      values(target,utc_day,campaign_bucket,p_source,p_device,
        case when p_kind='view' then 1 else 0 end,case when p_kind='click' then 1 else 0 end)
      on conflict(profile_id,day,campaign_id,source,device) do update
        set views=snoozer.profile_traffic_days.views + excluded.views,
          clicks=snoozer.profile_traffic_days.clicks + excluded.clicks;
    if p_kind = 'click' then
      insert into snoozer.profile_link_days(profile_id, day, revision, position, label, url, clicks)
        select target, utc_day, published, p_position, l.label, l.url, 1
        from snoozer.published_links l
        where l.profile_id = target and l.revision = published and l.position = p_position and l.url = p_url
        on conflict (profile_id, day, revision, position) do update
          set clicks = snoozer.profile_link_days.clicks + 1;
    end if;
    update snoozer.profile_view_days set views = views + case when p_kind = 'view' then 1 else 0 end,
      clicks = clicks + case when p_kind = 'click' then 1 else 0 end
      where profile_id = target and day = utc_day;
  end if;
end;
$$;

-- Preserve old app callers while new deployments pass coarse attribution.
create or replace function public.record_profile_event(p_username text,p_event uuid,p_kind text,p_actor uuid,
  p_position integer default null,p_url text default null) returns void
language sql security definer set search_path = '' as $$
  select public.record_profile_event_with_context(p_username,p_event,p_kind,p_actor,p_position,p_url);
$$;
revoke execute on function public.record_profile_event_with_context(text,uuid,text,uuid,integer,text,text,uuid,text)
  from public,anon,authenticated,service_role;
grant execute on function public.record_profile_event_with_context(text,uuid,text,uuid,integer,text,text,uuid,text) to service_role;
