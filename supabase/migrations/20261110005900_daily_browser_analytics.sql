-- Counts are browser/profile/UTC-day observations, never unique people.
alter table snoozer.profile_view_days
  add column unique_browsers integer not null default 0 check(unique_browsers between 0 and views),
  add column clicked_browsers integer not null default 0 check(clicked_browsers between 0 and unique_browsers and clicked_browsers <= clicks);
create table snoozer.profile_browser_days (
  profile_id uuid not null, day date not null,
  browser_key text not null check(browser_key ~ '^[0-9a-f]{64}$'),
  seen_view boolean not null, clicked boolean not null,
  primary key(profile_id,day,browser_key),
  foreign key(profile_id,day) references snoozer.profile_view_days(profile_id,day) on delete cascade
);
alter table snoozer.profile_browser_days enable row level security;
revoke all on snoozer.profile_browser_days from public,anon,authenticated,service_role;

create function public.record_profile_event_with_browser(p_username text, p_event uuid, p_kind text, p_actor uuid,
  p_position integer default null, p_url text default null, p_source text default 'direct', p_campaign uuid default null, p_device text default 'unknown', p_browser_key text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  target uuid;
  campaign_bucket uuid := '00000000-0000-0000-0000-000000000000';
  owner uuid;
  prior_seen boolean;
  prior_clicked boolean;
  add_browser integer := 0;
  add_clicker integer := 0;
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

  delete from snoozer.profile_browser_days where profile_id=target and day<utc_day;

  insert into snoozer.profile_view_days(profile_id, day) values (target, utc_day)
    on conflict do nothing;
  perform 1 from snoozer.profile_view_days
    where profile_id = target and day = utc_day
      and case when p_kind = 'view' then views < 10000 else clicks < 10000 end for update;
  if not found then return; end if;

  insert into snoozer.profile_view_receipts(profile_id, day, event_id, kind)
    values (target, utc_day, p_event, p_kind) on conflict do nothing;
  if found then
    if p_browser_key ~ '^[0-9a-f]{64}$' then
      select seen_view,clicked into prior_seen,prior_clicked from snoozer.profile_browser_days
        where profile_id=target and day=utc_day and browser_key=p_browser_key;
      if p_kind='view' and not coalesce(prior_seen,false) then
        add_browser := 1;
        add_clicker := case when coalesce(prior_clicked,false) then 1 else 0 end;
      elsif p_kind='click' and coalesce(prior_seen,false) and not coalesce(prior_clicked,false) then
        add_clicker := 1;
      end if;
      insert into snoozer.profile_browser_days(profile_id,day,browser_key,seen_view,clicked)
        values(target,utc_day,p_browser_key,p_kind='view',p_kind='click')
        on conflict(profile_id,day,browser_key) do update
          set seen_view=snoozer.profile_browser_days.seen_view or excluded.seen_view,
            clicked=snoozer.profile_browser_days.clicked or excluded.clicked;
    end if;
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
      clicks = clicks + case when p_kind = 'click' then 1 else 0 end,
      unique_browsers=unique_browsers+add_browser, clicked_browsers=clicked_browsers+add_clicker
      where profile_id = target and day = utc_day;
  end if;
end;
$$;


-- Preserve both prior RPC contracts during a rolling deployment.
create or replace function public.record_profile_event_with_context(p_username text,p_event uuid,p_kind text,p_actor uuid,
  p_position integer default null,p_url text default null,p_source text default 'direct',p_campaign uuid default null,p_device text default 'unknown')
returns void language sql security definer set search_path = '' as $$
  select public.record_profile_event_with_browser(p_username,p_event,p_kind,p_actor,p_position,p_url,p_source,p_campaign,p_device,null);
$$;
create function public.get_my_profile_browser_days(p_profile uuid)
returns table(day date,unique_browsers integer,clicked_browsers integer)
language sql stable security definer set search_path = '' as $$
  select d.day,d.unique_browsers,d.clicked_browsers from snoozer.profiles p
  join snoozer.profile_view_days d on d.profile_id=p.id
  cross join lateral snoozer.effective_plan(p.owner_id) e
  where p.id=p_profile and p.owner_id=snoozer.verified_user()
    and d.day > (now() at time zone 'UTC')::date - (e.plan).analytics_days
  order by d.day desc;
$$;
revoke execute on function public.record_profile_event_with_browser(text,uuid,text,uuid,integer,text,text,uuid,text,text),
  public.get_my_profile_browser_days(uuid) from public,anon,authenticated,service_role;
grant execute on function public.record_profile_event_with_browser(text,uuid,text,uuid,integer,text,text,uuid,text,text) to service_role;
grant execute on function public.get_my_profile_browser_days(uuid) to authenticated;
create or replace function public.purge_profile_analytics() returns integer
language plpgsql security definer set search_path = '' as $$
declare removed integer;
begin
  delete from snoozer.profile_browser_days where (profile_id,day,browser_key) in (
    select profile_id,day,browser_key from snoozer.profile_browser_days
    where day < (now() at time zone 'UTC')::date limit 5000
  );
  delete from snoozer.profile_view_receipts where (profile_id,day,event_id,kind) in (
    select profile_id,day,event_id,kind from snoozer.profile_view_receipts
    where day < (now() at time zone 'UTC')::date limit 5000
  );
  delete from snoozer.profile_view_days where (profile_id,day) in (
    select d.profile_id,d.day from snoozer.profile_view_days d
    join snoozer.profiles p on p.id=d.profile_id
    cross join lateral snoozer.effective_plan(p.owner_id) e
    where d.day <= (now() at time zone 'UTC')::date - (e.plan).analytics_days limit 100
  );
  get diagnostics removed = row_count;
  return removed;
end;
$$;

