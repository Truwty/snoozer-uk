-- Country-level analytics are separately opt-in. Only two-letter country codes
-- and daily aggregates are retained; no IP addresses are stored.
create table snoozer.profile_country_days (
  profile_id uuid not null, day date not null,
  country_code text not null check(country_code ~ '^[A-Z]{2}$'),
  views integer not null default 0 check(views between 0 and 10000),
  clicks integer not null default 0 check(clicks between 0 and 10000),
  primary key(profile_id,day,country_code),
  foreign key(profile_id,day) references snoozer.profile_view_days(profile_id,day) on delete cascade
);
create table snoozer.profile_country_receipts (
  profile_id uuid not null, day date not null, event_id uuid not null,
  kind text not null check(kind in ('view','click')),
  primary key(profile_id,day,event_id),
  foreign key(profile_id,day) references snoozer.profile_view_days(profile_id,day) on delete cascade
);
alter table snoozer.profile_country_days enable row level security;
alter table snoozer.profile_country_receipts enable row level security;
revoke all on snoozer.profile_country_days from public,anon,authenticated,service_role;
revoke all on snoozer.profile_country_receipts from public,anon,authenticated,service_role;

create function public.record_profile_country_event(p_username text,p_event uuid,p_kind text,p_country text)
returns void language plpgsql security definer set search_path = ''
as $$
declare target uuid; owner_id uuid; keep_days integer; utc_day date := (now() at time zone 'UTC')::date;
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then
    raise exception 'Service role required' using errcode='42501';
  end if;
  if p_event is null or p_kind not in ('view','click') or p_country !~ '^[A-Z]{2}$' then return; end if;
  select id,owner_id into target,owner_id from snoozer.profiles
    where username=p_username and published_revision is not null;
  if target is null then return; end if;
  select (e.plan).analytics_days into keep_days from snoozer.effective_plan(owner_id) e;
  if keep_days is null or keep_days<=0 then return; end if;
  if not exists(select 1 from snoozer.profile_view_receipts
    where profile_id=target and day=utc_day and event_id=p_event and kind=p_kind) then return; end if;
  delete from snoozer.profile_country_days where profile_id=target and day<=utc_day-keep_days;
  delete from snoozer.profile_country_receipts where profile_id=target and day<=utc_day-keep_days;
  insert into snoozer.profile_country_receipts(profile_id,day,event_id,kind)
    values(target,utc_day,p_event,p_kind) on conflict do nothing;
  if not found then return; end if;
  insert into snoozer.profile_country_days(profile_id,day,country_code,views,clicks)
    values(target,utc_day,p_country,case when p_kind='view' then 1 else 0 end,case when p_kind='click' then 1 else 0 end)
    on conflict(profile_id,day,country_code) do update
      set views=snoozer.profile_country_days.views+excluded.views,
          clicks=snoozer.profile_country_days.clicks+excluded.clicks;
end
$$;

create function public.get_my_profile_country_totals(p_profile uuid,p_since date default null)
returns table(country_code text,views integer,clicks integer)
language plpgsql stable security definer set search_path = ''
as $$
declare keep_days integer; start_day date; utc_day date := (now() at time zone 'UTC')::date;
begin
  if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
  if not exists(select 1 from snoozer.profiles where id=p_profile and owner_id=auth.uid()) then
    raise exception 'Profile unavailable' using errcode='42501';
  end if;
  select (e.plan).analytics_days into keep_days from snoozer.effective_plan(auth.uid()) e;
  if keep_days is null or keep_days<=0 then return; end if;
  start_day:=greatest(coalesce(p_since,utc_day-keep_days+1),utc_day-keep_days+1);
  return query select c.country_code,sum(c.views)::integer,sum(c.clicks)::integer
    from snoozer.profile_country_days c
    where c.profile_id=p_profile and c.day>=start_day and c.day<=utc_day
    group by c.country_code having sum(c.views)>=3
    order by sum(c.views) desc,c.country_code asc;
end
$$;

revoke all on function public.record_profile_country_event(text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.record_profile_country_event(text,uuid,text,text) to service_role;
revoke all on function public.get_my_profile_country_totals(uuid,date) from public,anon;
grant execute on function public.get_my_profile_country_totals(uuid,date) to authenticated;
