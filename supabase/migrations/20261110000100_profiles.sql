create schema snoozer;
revoke all on schema snoozer from public;

create table snoozer.reserved_names (
  name text primary key
);

insert into snoozer.reserved_names values
  ('admin'), ('api'), ('auth'), ('studio'), ('dashboard'), ('health'), ('account'),
  ('assets'), ('media'), ('billing'), ('pricing'), ('support'), ('help'), ('docs'),
  ('about'), ('status'), ('login'), ('logout'), ('register'), ('signup'), ('signin'),
  ('sign-in'), ('sign-up'), ('forgot-password'), ('reset-password'), ('settings'),
  ('terms'), ('privacy'), ('legal'), ('contact'), ('snoozer'), ('www'), ('root'),
  ('templates'), ('examples'), ('changelog'), ('teams'), ('discover'), ('features'),
  ('products'), ('store'), ('notifications'), ('report'), ('security'), ('onboarding');

create table snoozer.profiles (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (username ~ '^[a-z][a-z0-9-]{1,28}[a-z0-9]$'),
  display_name text not null check (char_length(display_name) between 1 and 60),
  bio text not null default '' check (char_length(bio) <= 280),
  theme text not null default 'midnight' check (theme in ('midnight', 'daybreak', 'lagoon')),
  indexable boolean not null default false,
  avatar uuid,
  revision integer not null default 0 check (revision >= 0),
  published_revision integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table snoozer.published_profiles (
  owner_id uuid not null references snoozer.profiles(owner_id) on delete cascade,
  revision integer not null,
  display_name text not null,
  bio text not null,
  theme text not null,
  indexable boolean not null,
  avatar uuid,
  published_at timestamptz not null default now(),
  primary key (owner_id, revision)
);

alter table snoozer.profiles add constraint active_publication
  foreign key (owner_id, published_revision) references snoozer.published_profiles(owner_id, revision);

create table snoozer.links (
  owner_id uuid not null references snoozer.profiles(owner_id) on delete cascade,
  position integer not null check (position between 1 and 20),
  label text not null check (char_length(label) between 1 and 80),
  url text not null check (char_length(url) <= 2048),
  primary key (owner_id, position)
);

create table snoozer.published_links (
  owner_id uuid not null,
  revision integer not null,
  position integer not null,
  label text not null,
  url text not null,
  primary key (owner_id, revision, position),
  foreign key (owner_id, revision) references snoozer.published_profiles(owner_id, revision) on delete cascade
);

alter table snoozer.reserved_names enable row level security;
alter table snoozer.profiles enable row level security;
alter table snoozer.links enable row level security;
alter table snoozer.published_profiles enable row level security;
alter table snoozer.published_links enable row level security;

create function snoozer.verified_user() returns uuid
language plpgsql stable set search_path = '' as $$
declare actor uuid := auth.uid();
begin
  if not exists (select 1 from auth.users where id = actor and email_confirmed_at is not null) then
    raise exception 'Verified account required' using errcode = '42501';
  end if;
  return actor;
end $$;

create function public.username_available(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(p_name ~ '^[a-z][a-z0-9-]{1,28}[a-z0-9]$', false)
    and not exists (select 1 from snoozer.reserved_names where name = p_name)
    and not exists (select 1 from snoozer.profiles where username = p_name)
$$;

create function public.claim_profile(p_name text) returns void
language plpgsql security definer set search_path = '' as $$
declare actor uuid := snoozer.verified_user();
begin
  if not public.username_available(p_name) then
    raise exception 'Username unavailable' using errcode = '23505';
  end if;
  insert into snoozer.profiles(owner_id, username, display_name)
    values (actor, p_name, p_name);
end $$;

create function public.get_draft() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'username', p.username, 'display_name', p.display_name, 'bio', p.bio,
    'theme', p.theme, 'indexable', p.indexable, 'avatar', p.avatar,
    'revision', p.revision, 'published_revision', p.published_revision,
    'links', coalesce((select jsonb_agg(jsonb_build_object('label', label, 'url', url) order by position)
      from snoozer.links where owner_id = p.owner_id), '[]'::jsonb))
  from snoozer.profiles p where p.owner_id = snoozer.verified_user()
$$;

create function public.get_published_profile(p_name text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'username', p.username, 'display_name', v.display_name, 'bio', v.bio,
    'theme', v.theme, 'indexable', v.indexable, 'avatar', v.avatar,
    'links', coalesce((select jsonb_agg(jsonb_build_object('label', label, 'url', url) order by position)
      from snoozer.published_links where owner_id = v.owner_id and revision = v.revision), '[]'::jsonb))
  from snoozer.profiles p join snoozer.published_profiles v
    on (p.owner_id, p.published_revision) = (v.owner_id, v.revision)
  where p.username = p_name
$$;

create function public.save_profile(
  p_expected integer, p_name text, p_bio text, p_theme text,
  p_indexable boolean, p_links jsonb, p_publish boolean, p_remove_avatar boolean
) returns integer
language plpgsql security definer set search_path = '' as $$
declare actor uuid := snoozer.verified_user();
declare current snoozer.profiles;
declare item jsonb;
declare address text;
declare hostname text;
begin
  if p_expected is null or p_name is null or p_bio is null or p_theme is null
    or p_indexable is null or p_publish is null or p_remove_avatar is null
    or jsonb_typeof(p_links) is distinct from 'array' then
    raise exception 'Invalid profile fields' using errcode = '22023';
  end if;
  if jsonb_array_length(p_links) > 20 then
    raise exception 'Too many links' using errcode = '22023';
  end if;
  for item in select value from jsonb_array_elements(p_links) loop
    address := item->>'url';
    hostname := substring(address from '^https?://([a-z0-9.-]+)');
    if jsonb_typeof(item->'url') is distinct from 'string'
      or jsonb_typeof(item->'label') is distinct from 'string'
      or address !~ '^https?://[a-z0-9.-]+(:[0-9]{1,5})?([/?#][^[:space:]\\]*)?$'
      or hostname !~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$'
      or hostname ~ '\.(local|localhost|internal|test|invalid|example|onion)$'
      or coalesce(substring(address from '^https?://[a-z0-9.-]+:([0-9]+)')::integer, 0) > 65535 then
      raise exception 'Invalid link' using errcode = '22023';
    end if;
  end loop;

  select * into current from snoozer.profiles where owner_id = actor for update;
  if not found or current.revision <> p_expected then
    raise exception 'Profile revision conflict' using errcode = '40001';
  end if;
  update snoozer.profiles set
    display_name = btrim(p_name), bio = btrim(p_bio), theme = p_theme, indexable = p_indexable,
    avatar = case when p_remove_avatar then null else avatar end,
    revision = revision + 1, updated_at = now()
  where owner_id = actor returning * into current;

  delete from snoozer.links where owner_id = actor;
  insert into snoozer.links(owner_id, position, label, url)
    select actor, position, btrim(value->>'label'), value->>'url'
    from jsonb_array_elements(p_links) with ordinality as items(value, position);
  if p_publish then
    -- Keep a bounded publication history until plan-based retention is available.
    insert into snoozer.published_profiles(owner_id, revision, display_name, bio, theme, indexable, avatar)
      values (actor, current.revision, current.display_name, current.bio, current.theme, current.indexable, current.avatar);
    insert into snoozer.published_links
      select actor, current.revision, position, label, url from snoozer.links where owner_id = actor;
    update snoozer.profiles set published_revision = current.revision where owner_id = actor;
    delete from snoozer.published_profiles where owner_id = actor and revision in (
      select revision from snoozer.published_profiles where owner_id = actor
      order by revision desc offset 20
    );
  end if;
  return current.revision;
end $$;

create function public.unpublish_profile(p_expected integer) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update snoozer.profiles set published_revision = null, revision = revision + 1, updated_at = now()
  where owner_id = snoozer.verified_user() and revision = p_expected;
  if not found then
    raise exception 'Profile revision conflict' using errcode = '40001';
  end if;
end $$;

revoke execute on function public.username_available(text), public.get_published_profile(text) from public, anon, authenticated, service_role;
grant execute on function public.username_available(text), public.get_published_profile(text) to anon, authenticated;
revoke execute on function public.claim_profile(text), public.get_draft(),
  public.save_profile(integer,text,text,text,boolean,jsonb,boolean,boolean),
  public.unpublish_profile(integer) from public, anon, authenticated, service_role;
grant execute on function public.claim_profile(text), public.get_draft(),
  public.save_profile(integer,text,text,text,boolean,jsonb,boolean,boolean),
  public.unpublish_profile(integer) to authenticated;
