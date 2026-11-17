-- Click totals preserve the creator's published label/destination, not visitor data.
create table snoozer.profile_link_days (
  profile_id uuid not null,
  day date not null,
  revision integer not null,
  position integer not null check (position between 1 and 2000),
  label text not null check (char_length(label) between 1 and 80),
  url text not null check (char_length(url) between 1 and 2048),
  clicks integer not null check (clicks between 1 and 10000),
  primary key (profile_id, day, revision, position),
  foreign key (profile_id, day) references snoozer.profile_view_days(profile_id,day) on delete cascade
);
alter table snoozer.profile_link_days enable row level security;
revoke all on snoozer.profile_link_days from public, anon, authenticated, service_role;

create or replace function public.record_profile_event(p_username text, p_event uuid, p_kind text, p_actor uuid,
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
    where username = p_username and published_revision is not null for share;
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

create function public.get_my_profile_link_totals(p_profile uuid)
returns table(label text, url text, clicks integer)
language sql stable security definer set search_path = '' as $$
  select d.label, d.url, sum(d.clicks)::integer as clicks
  from snoozer.profiles p join snoozer.profile_link_days d on d.profile_id=p.id
  cross join lateral snoozer.effective_plan(p.owner_id) e
  where p.id=p_profile and p.owner_id=snoozer.verified_user()
    and d.day > (now() at time zone 'UTC')::date - (e.plan).analytics_days
  group by d.label,d.url order by clicks desc,d.label,d.url limit 100;
$$;
revoke execute on function public.get_my_profile_link_totals(uuid) from public, anon, authenticated, service_role;
grant execute on function public.get_my_profile_link_totals(uuid) to authenticated;
