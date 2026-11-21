begin;

-- Lifetime view counters are independent of plan-specific daily analytics retention.
-- Every new, consented, verified view event still passes through existing receipt
-- deduplication, owner-exclusion and bot filtering before reaching this trigger.
create table snoozer.profile_view_leaderboard (
  profile_id uuid primary key references snoozer.profiles(id) on delete cascade,
  total_views bigint not null default 0 check (total_views >= 0),
  month_start date not null,
  month_views bigint not null default 0 check (month_views >= 0)
);
create index profile_view_leaderboard_total_rank on snoozer.profile_view_leaderboard (total_views desc, profile_id);
create index profile_view_leaderboard_month_rank on snoozer.profile_view_leaderboard (month_start, month_views desc, profile_id);
alter table snoozer.profile_view_leaderboard enable row level security;
revoke all on snoozer.profile_view_leaderboard from public, anon, authenticated, service_role;

-- Backfill only the daily totals that have survived existing retention limits.
-- Older purged activity is irretrievable: do not present the historic total as
-- an exact count for activity before leaderboard launch.
insert into snoozer.profile_view_leaderboard(profile_id, total_views, month_start, month_views)
select d.profile_id, sum(d.views)::bigint,
       date_trunc('month', now() at time zone 'UTC')::date,
       sum(case when d.day >= date_trunc('month', now() at time zone 'UTC')::date
                   and d.day <= (now() at time zone 'UTC')::date
                then d.views else 0 end)::bigint
from snoozer.profile_view_days d
where d.views > 0
group by d.profile_id;

create function snoozer.accumulate_profile_leaderboard_view()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  delta bigint;
  observed_month date := date_trunc('month', new.day::timestamp)::date;
begin
  delta := case when tg_op = 'INSERT'
    then new.views::bigint
    else greatest(new.views::bigint - old.views::bigint, 0) end;
  if delta <= 0 then return new; end if;

  insert into snoozer.profile_view_leaderboard as tally
    (profile_id, total_views, month_start, month_views)
    values (new.profile_id, delta, observed_month, delta)
  on conflict (profile_id) do update set
    total_views = tally.total_views + excluded.total_views,
    month_views = case
      when excluded.month_start > tally.month_start then excluded.month_views
      when excluded.month_start = tally.month_start then tally.month_views + excluded.month_views
      else tally.month_views end,
    month_start = greatest(tally.month_start, excluded.month_start);
  return new;
end
$$;

create trigger accumulate_profile_leaderboard_view
after insert or update of views on snoozer.profile_view_days
for each row execute function snoozer.accumulate_profile_leaderboard_view();
revoke execute on function snoozer.accumulate_profile_leaderboard_view()
  from public, anon, authenticated, service_role;

-- Never expose underlying private daily analytics, browser keys, or owner IDs.
-- Only active, discoverable public profiles may appear in this directory.
create function public.get_views_leaderboard(p_period text default 'all')
returns table(username text, display_name text, avatar text, views bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_period is null or p_period not in ('all', 'month') then
    raise exception 'Invalid leaderboard period' using errcode = '22023';
  end if;

  return query
    select p.username, v.display_name, v.avatar::text,
      case when p_period = 'month' then t.month_views else t.total_views end
    from snoozer.profile_view_leaderboard t
    join snoozer.profiles p on p.id = t.profile_id
    join snoozer.published_profiles v
      on v.profile_id = p.id and v.revision = p.published_revision
    where p.published_revision is not null and v.indexable
      and v.activated_at is not null
      and (case when p_period = 'month'
        then t.month_start = date_trunc('month', now() at time zone 'UTC')::date and t.month_views > 0
        else t.total_views > 0 end)
    order by 4 desc, p.username asc
    limit 50;
end
$$;
revoke all on function public.get_views_leaderboard(text)
  from public, anon, authenticated, service_role;
grant execute on function public.get_views_leaderboard(text)
  to anon, authenticated;

-- Make the new real application route unavailable as a username or alias.
insert into snoozer.reserved_names(name) values ('leaderboard') on conflict do nothing;

commit;
