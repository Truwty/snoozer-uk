create table snoozer.profile_view_days (
  profile_id uuid not null references snoozer.profiles(id) on delete cascade,
  day date not null,
  views integer not null default 0 check (views between 0 and 10000),
  clicks integer not null default 0 check (clicks between 0 and 10000),
  primary key (profile_id, day)
);

create table snoozer.profile_view_receipts (
  profile_id uuid not null,
  day date not null,
  event_id uuid not null,
  kind text not null check (kind in ('view','click')),
  primary key (profile_id, day, event_id, kind),
  foreign key (profile_id, day) references snoozer.profile_view_days(profile_id, day) on delete cascade
);

alter table snoozer.profile_view_days enable row level security;
create index profile_view_days_expiry on snoozer.profile_view_days(day);
create index profile_view_receipts_expiry on snoozer.profile_view_receipts(day);
alter table snoozer.profile_view_receipts enable row level security;
revoke all on snoozer.profile_view_days, snoozer.profile_view_receipts from public, anon, authenticated, service_role;

-- p_actor comes only from server-verified Auth, never from the event payload.
create function public.record_profile_event(p_username text, p_event uuid, p_kind text, p_actor uuid,
  p_position integer default null, p_url text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  target uuid;
  owner uuid;
  published integer;
  keep_days integer;
  utc_day date := (now() at time zone 'UTC')::date;
begin
  if p_event is null or p_kind is null or p_kind not in ('view','click') then return; end if;
  select id, owner_id, published_revision into target, owner, published from snoozer.profiles
    where username = p_username and published_revision is not null;
  if target is null or owner = p_actor then return; end if;
  if p_kind = 'click' and not exists (
    select 1 from snoozer.published_links where profile_id = target and revision = published
      and position = p_position and url = p_url
  ) then return; end if;

  select (e.plan).analytics_days into keep_days from snoozer.effective_plan(owner) e;
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
    update snoozer.profile_view_days set views = views + case when p_kind = 'view' then 1 else 0 end,
      clicks = clicks + case when p_kind = 'click' then 1 else 0 end
      where profile_id = target and day = utc_day;
  end if;
end;
$$;

create function public.get_my_profile_view_days(p_profile uuid)
returns table(day date, views integer, clicks integer)
language sql stable security definer set search_path = '' as $$
  select d.day, d.views, d.clicks
  from snoozer.profiles p
  join snoozer.profile_view_days d on d.profile_id = p.id
  cross join lateral snoozer.effective_plan(p.owner_id) e
  where p.id = p_profile and p.owner_id = snoozer.verified_user()
    and d.day > (now() at time zone 'UTC')::date - (e.plan).analytics_days
  order by d.day desc;
$$;

-- Bounded manual/scheduled maintenance also purges inactive profiles. A late run
-- does not expose expired aggregates: the owner reader enforces retention too.
create function public.purge_profile_analytics() returns integer
language plpgsql security definer set search_path = '' as $$
declare removed integer;
begin
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

revoke execute on function public.record_profile_event(text,uuid,text,uuid,integer,text),
  public.purge_profile_analytics(), public.get_my_profile_view_days(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.record_profile_event(text,uuid,text,uuid,integer,text), public.purge_profile_analytics() to service_role;
grant execute on function public.get_my_profile_view_days(uuid) to authenticated;
