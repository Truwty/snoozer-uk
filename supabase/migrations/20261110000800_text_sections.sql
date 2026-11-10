create table snoozer.sections (
  owner_id uuid not null references snoozer.profiles(owner_id) on delete cascade,
  position smallint not null check (position between 1 and 6),
  heading text not null check (char_length(heading) between 1 and 80 and heading ~ '[^[:space:]]'),
  body text not null check (char_length(body) between 1 and 800 and body ~ '[^[:space:]]'),
  primary key (owner_id, position)
);

create table snoozer.published_sections (
  owner_id uuid not null,
  revision integer not null,
  position smallint not null check (position between 1 and 6),
  heading text not null check (char_length(heading) between 1 and 80 and heading ~ '[^[:space:]]'),
  body text not null check (char_length(body) between 1 and 800 and body ~ '[^[:space:]]'),
  primary key (owner_id, revision, position),
  foreign key (owner_id, revision) references snoozer.published_profiles(owner_id, revision) on delete cascade
);

alter table snoozer.sections enable row level security;
alter table snoozer.published_sections enable row level security;

-- Preserve the established revision, validation and publication transactions.
alter function public.save_profile(integer,text,text,text,boolean,jsonb,boolean,boolean) set schema snoozer;
alter function public.restore_publication(integer,integer) set schema snoozer;
alter function public.get_draft() set schema snoozer;
alter function public.get_published_profile(text) set schema snoozer;
alter function public.get_publication(integer) set schema snoozer;

revoke execute on function snoozer.save_profile(integer,text,text,text,boolean,jsonb,boolean,boolean),
  snoozer.restore_publication(integer,integer), snoozer.get_draft(),
  snoozer.get_published_profile(text), snoozer.get_publication(integer)
  from public, anon, authenticated, service_role;

create function public.save_profile(
  p_expected integer, p_name text, p_bio text, p_theme text,
  p_indexable boolean, p_links jsonb, p_publish boolean, p_remove_avatar boolean,
  p_sections jsonb default null
) returns integer
language plpgsql security definer set search_path = '' as $$
declare actor uuid := snoozer.verified_user();
declare saved_revision integer;
begin
  if p_sections is not null then
    if jsonb_typeof(p_sections) <> 'array' then
      raise exception 'Invalid text sections' using errcode = '22023';
    end if;
    if jsonb_array_length(p_sections) > 6 or exists (
      select 1 from jsonb_array_elements(p_sections) s
      where jsonb_typeof(s->'heading') is distinct from 'string'
         or jsonb_typeof(s->'body') is distinct from 'string'
         or char_length(btrim(s->>'heading', E' \t\r\n')) not between 1 and 80
         or char_length(btrim(s->>'body', E' \t\r\n')) not between 1 and 800
         or (s->>'heading') !~ '[^[:space:]]' or (s->>'body') !~ '[^[:space:]]'
    ) then
      raise exception 'Invalid text sections' using errcode = '22023';
    end if;
  end if;

  saved_revision := snoozer.save_profile(p_expected, p_name, p_bio, p_theme,
    p_indexable, p_links, p_publish, p_remove_avatar);
  -- Older callers omit p_sections. Preserve their draft sections in that case.
  if p_sections is not null then
    delete from snoozer.sections where owner_id = actor;
    insert into snoozer.sections(owner_id, position, heading, body)
      select actor, position, btrim(section->>'heading', E' \t\r\n'), btrim(section->>'body', E' \t\r\n')
      from jsonb_array_elements(p_sections) with ordinality as items(section, position);
  end if;
  if p_publish then
    insert into snoozer.published_sections (owner_id, revision, position, heading, body)
      select actor, saved_revision, position, heading, body from snoozer.sections where owner_id = actor;
  end if;
  return saved_revision;
end $$;

create function public.restore_publication(p_revision integer, p_expected integer) returns void
language plpgsql security definer set search_path = '' as $$
declare actor uuid := snoozer.verified_user();
begin
  perform snoozer.restore_publication(p_revision, p_expected);
  delete from snoozer.sections where owner_id = actor;
  insert into snoozer.sections (owner_id, position, heading, body)
    select actor, position, heading, body from snoozer.published_sections
    where owner_id = actor and revision = p_revision;
end $$;

create function snoozer.section_snapshot(p_owner uuid, p_revision integer) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('sections', coalesce(jsonb_agg(
    jsonb_build_object('heading', heading, 'body', body) order by position), '[]'::jsonb))
  from snoozer.published_sections where owner_id = p_owner and revision = p_revision
$$;

create function public.get_draft() returns jsonb
language sql stable security definer set search_path = '' as $$
  select snoozer.get_draft() || jsonb_build_object('sections', coalesce(jsonb_agg(
    jsonb_build_object('heading', heading, 'body', body) order by position), '[]'::jsonb))
  from snoozer.sections where owner_id = snoozer.verified_user()
$$;

create function public.get_published_profile(p_name text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select snoozer.get_published_profile(p_name) || snoozer.section_snapshot(owner_id, published_revision)
  from snoozer.profiles where username = p_name and published_revision is not null
$$;

create function public.get_publication(p_revision integer) returns jsonb
language sql stable security definer set search_path = '' as $$
  select snoozer.get_publication(p_revision) || snoozer.section_snapshot(snoozer.verified_user(), p_revision)
$$;

revoke execute on function snoozer.section_snapshot(uuid,integer) from public, anon, authenticated, service_role;
revoke execute on function public.save_profile(integer,text,text,text,boolean,jsonb,boolean,boolean,jsonb),
  public.restore_publication(integer,integer), public.get_draft(), public.get_publication(integer),
  public.get_published_profile(text) from public, anon, authenticated, service_role;
grant execute on function public.save_profile(integer,text,text,text,boolean,jsonb,boolean,boolean,jsonb),
  public.restore_publication(integer,integer), public.get_draft(), public.get_publication(integer) to authenticated;
grant execute on function public.get_published_profile(text) to anon, authenticated;
