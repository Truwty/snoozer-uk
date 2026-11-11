-- Older sections and publications retain their original plain-text rendering.
alter table snoozer.sections add column kind text not null default 'text' check (kind in ('text','callout','quote'));
alter table snoozer.published_sections add column kind text not null default 'text' check (kind in ('text','callout','quote'));

create function snoozer.section_item(p_heading text, p_body text, p_kind text) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object('heading', p_heading, 'body', p_body) ||
    case when p_kind = 'text' then '{}'::jsonb else jsonb_build_object('kind', p_kind) end
$$;

create or replace function snoozer.save_profile_with_sections(
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
      where (s ? 'kind' and (jsonb_typeof(s->'kind') is distinct from 'string' or s->>'kind' not in ('text','callout','quote')))
         or jsonb_typeof(s->'heading') is distinct from 'string'
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
    insert into snoozer.sections(owner_id, position, heading, body, kind)
      select actor, position, btrim(section->>'heading', E' \t\r\n'), btrim(section->>'body', E' \t\r\n'), coalesce(section->>'kind', 'text')
      from jsonb_array_elements(p_sections) with ordinality as items(section, position);
  end if;
  if p_publish then
    insert into snoozer.published_sections (owner_id, revision, position, heading, body, kind)
      select actor, saved_revision, position, heading, body, kind from snoozer.sections where owner_id = actor;
  end if;
  return saved_revision;
end $$;

create or replace function snoozer.restore_publication_with_sections(p_revision integer, p_expected integer) returns void
language plpgsql security definer set search_path = '' as $$
declare actor uuid := snoozer.verified_user();
begin
  perform snoozer.restore_publication(p_revision, p_expected);
  delete from snoozer.sections where owner_id = actor;
  insert into snoozer.sections (owner_id, position, heading, body, kind)
    select actor, position, heading, body, kind from snoozer.published_sections
    where owner_id = actor and revision = p_revision;
end $$;

create or replace function snoozer.get_draft_with_sections() returns jsonb
language sql stable security definer set search_path = '' as $$
  select snoozer.get_draft() || jsonb_build_object('sections', coalesce(jsonb_agg(
    snoozer.section_item(heading, body, kind) order by position), '[]'::jsonb))
  from snoozer.sections where owner_id = snoozer.verified_user()
$$;

create or replace function snoozer.section_snapshot(p_owner uuid, p_revision integer) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('sections', coalesce(jsonb_agg(
    snoozer.section_item(heading, body, kind) order by position), '[]'::jsonb))
  from snoozer.published_sections where owner_id = p_owner and revision = p_revision
$$;

revoke execute on function snoozer.section_item(text,text,text) from public, anon, authenticated, service_role;
