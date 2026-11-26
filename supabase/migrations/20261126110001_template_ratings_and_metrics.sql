begin;

create table snoozer.template_use_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  template_key text not null check (template_key ~ '^[A-Za-z0-9-]{1,120}$'),
  used_at timestamptz not null default now()
);
create index template_use_events_key_time on snoozer.template_use_events(template_key, used_at desc);
create index template_use_events_owner_time on snoozer.template_use_events(owner_id, used_at desc);

create table snoozer.template_ratings (
  owner_id uuid not null references auth.users(id) on delete cascade,
  template_key text not null check (template_key ~ '^[A-Za-z0-9-]{1,120}$'),
  rating smallint not null check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner_id, template_key)
);
create index template_ratings_key on snoozer.template_ratings(template_key, rating);

alter table snoozer.template_use_events enable row level security;
alter table snoozer.template_ratings enable row level security;
revoke all on snoozer.template_use_events, snoozer.template_ratings from public, anon, authenticated, service_role;

create or replace function public.record_my_template_use(p_key text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor uuid := snoozer.verified_user();
begin
  if actor is null or p_key is null or not snoozer.valid_template_activity_key(p_key) then
    raise exception 'Template is not available' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from snoozer.template_activity
    where owner_id = actor and template_key = p_key
  ) then
    perform 1 from auth.users where id = actor for update;
    if (select count(*) from snoozer.template_activity where owner_id = actor) >= 200 then
      raise exception 'Template activity limit reached' using errcode = 'P1201';
    end if;
  end if;

  insert into snoozer.template_activity(owner_id, template_key, last_used_at)
    values (actor, p_key, now())
    on conflict (owner_id, template_key) do update
      set last_used_at = excluded.last_used_at;

  insert into snoozer.template_use_events(owner_id, template_key)
    values (actor, p_key);

  return true;
end
$function$;

create function public.set_my_template_rating(p_key text, p_rating integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor uuid := snoozer.verified_user();
begin
  if actor is null or p_key is null or not snoozer.valid_template_activity_key(p_key)
    or p_rating is null or p_rating not between 1 and 5 then
    raise exception 'Invalid template rating' using errcode = '22023';
  end if;

  insert into snoozer.template_ratings(owner_id, template_key, rating)
    values (actor, p_key, p_rating)
    on conflict (owner_id, template_key) do update
      set rating = excluded.rating, updated_at = now();

  return true;
end
$function$;

create function public.get_template_catalogue_metrics(p_keys text[])
returns table (
  template_key text,
  uses bigint,
  weekly_uses bigint,
  rating_count bigint,
  rating_average numeric,
  my_rating smallint
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;

  if p_keys is null or cardinality(p_keys) > 200
    or exists (
      select 1
      from unnest(p_keys) as requested_key(value)
      where value !~ '^[A-Za-z0-9-]{1,120}$'
        or not snoozer.valid_template_activity_key(value)
    ) then
    raise exception 'Invalid template selection' using errcode = '22023';
  end if;

  return query
  with requested as (
    select distinct requested_key.value
    from unnest(p_keys) as requested_key(value)
  ),
  usage as (
    select e.template_key,
      count(*)::bigint as uses,
      count(*) filter (where e.used_at >= now() - interval '7 days')::bigint as weekly_uses
    from snoozer.template_use_events e
    join requested r on r.value = e.template_key
    group by e.template_key
  ),
  ratings as (
    select r.template_key,
      count(*)::bigint as rating_count,
      round(avg(r.rating)::numeric, 1) as rating_average,
      max(r.rating) filter (where r.owner_id = auth.uid())::smallint as my_rating
    from snoozer.template_ratings r
    join requested q on q.value = r.template_key
    group by r.template_key
  )
  select q.value,
    coalesce(community.usage_count::bigint, u.uses, 0),
    coalesce(u.weekly_uses, 0),
    coalesce(r.rating_count, 0),
    coalesce(r.rating_average, 0),
    r.my_rating
  from requested q
  left join usage u on u.template_key = q.value
  left join ratings r on r.template_key = q.value
  left join snoozer.community_templates community
    on community.id::text = q.value and community.status = 'approved';
end
$function$;

create or replace function public.list_community_templates(
  p_query text default '',
  p_sort text default 'newest',
  p_page integer default 1
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  actor uuid := snoozer.verified_user();
  needle text := lower(btrim(coalesce(p_query, '')));
  total integer;
  page_count integer;
  actual_page integer;
  items jsonb;
begin
  if actor is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;
  if p_query is null or char_length(p_query) > 80
    or p_sort is null or p_sort not in ('newest', 'popular')
    or p_page is null or p_page not between 1 and 100000 then
    raise exception 'Invalid community template filters' using errcode = '22023';
  end if;

  select count(*)::integer into total
  from snoozer.community_templates c
  where c.status = 'approved'
    and (needle = '' or position(needle in lower(c.title || ' ' || c.description)) > 0);

  page_count := greatest(1, ceil(total::numeric / 12)::integer);
  actual_page := least(p_page, page_count);

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', t.id,
        'title', t.title,
        'description', t.description,
        'created_at', t.created_at,
        'usage_count', t.usage_count,
        'config', t.config,
        'creator_username', coalesce(p.username, 'Snoozer creator'),
        'rating_count', coalesce(r.rating_count, 0),
        'rating_average', coalesce(r.rating_average, 0),
        'weekly_uses', coalesce(u.weekly_uses, 0)
      )
      order by
        case when p_sort = 'popular' then t.usage_count end desc nulls last,
        t.created_at desc,
        t.id
    ),
    '[]'::jsonb
  )
  into items
  from (
    select c.*
    from snoozer.community_templates c
    where c.status = 'approved'
      and (needle = '' or position(needle in lower(c.title || ' ' || c.description)) > 0)
    order by
      case when p_sort = 'popular' then c.usage_count end desc nulls last,
      c.created_at desc,
      c.id
    limit 12 offset (actual_page - 1) * 12
  ) t
  left join lateral (
    select pr.username
    from snoozer.profiles pr
    where pr.owner_id = t.owner_id
      and pr.published_revision is not null
    order by pr.created_at desc, pr.id
    limit 1
  ) p on true
  left join lateral (
    select count(*)::bigint as rating_count,
      round(avg(rt.rating)::numeric, 1) as rating_average
    from snoozer.template_ratings rt
    where rt.template_key = t.id::text
  ) r on true
  left join lateral (
    select count(*)::bigint as weekly_uses
    from snoozer.template_use_events ev
    where ev.template_key = t.id::text
      and ev.used_at >= now() - interval '7 days'
  ) u on true;

  return jsonb_build_object(
    'items', items,
    'total', total,
    'page', actual_page,
    'pageCount', page_count
  );
end
$function$;

revoke all on function public.record_my_template_use(text),
  public.set_my_template_rating(text, integer),
  public.get_template_catalogue_metrics(text[]),
  public.list_community_templates(text, text, integer)
  from public, anon, authenticated, service_role;

grant execute on function public.record_my_template_use(text),
  public.set_my_template_rating(text, integer),
  public.get_template_catalogue_metrics(text[]),
  public.list_community_templates(text, text, integer)
  to authenticated;

commit;
