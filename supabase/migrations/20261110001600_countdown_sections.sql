-- Minute precision, UTC by contract. Validate calendar dates rather than normalising them.
create function snoozer.valid_countdown_target(p_target text) returns boolean
language plpgsql immutable set search_path = '' as $$
begin
  if p_target is null or p_target !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T([01][0-9]|2[0-3]):[0-5][0-9]$' or left(p_target, 4) = '0000' then
    return false;
  end if;
  perform make_date(substring(p_target, 1, 4)::integer, substring(p_target, 6, 2)::integer,
    substring(p_target, 9, 2)::integer);
  return true;
exception when datetime_field_overflow then
  return false;
end $$;

alter table snoozer.sections add column target text,
  drop constraint sections_kind_check,
  add constraint sections_kind_check check (kind in ('text','callout','quote','countdown')),
  add constraint sections_target_check check (
    (kind = 'countdown' and snoozer.valid_countdown_target(target)) or (kind <> 'countdown' and target is null)
  );

alter table snoozer.published_sections add column target text,
  drop constraint published_sections_kind_check,
  add constraint published_sections_kind_check check (kind in ('text','callout','quote','countdown')),
  add constraint published_sections_target_check check (
    (kind = 'countdown' and snoozer.valid_countdown_target(target)) or (kind <> 'countdown' and target is null)
  );

create function snoozer.section_item(p_heading text, p_body text, p_kind text, p_target text) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object('heading', p_heading, 'body', p_body) ||
    case when p_kind = 'text' then '{}'::jsonb else jsonb_build_object('kind', p_kind) end ||
    case when p_kind = 'countdown' then jsonb_build_object('target', p_target) else '{}'::jsonb end
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
      where (s ? 'kind' and (jsonb_typeof(s->'kind') is distinct from 'string' or s->>'kind' not in ('text','callout','quote','countdown')))
         or (s->>'kind' = 'countdown' and
            (jsonb_typeof(s->'target') is distinct from 'string' or not snoozer.valid_countdown_target(s->>'target')))
         or (s->>'kind' is distinct from 'countdown' and s ? 'target')
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
    insert into snoozer.sections(owner_id, position, heading, body, kind, target)
      select actor, position, btrim(section->>'heading', E' \t\r\n'), btrim(section->>'body', E' \t\r\n'), coalesce(section->>'kind', 'text'), section->>'target'
      from jsonb_array_elements(p_sections) with ordinality as items(section, position);
  end if;
  if p_publish then
    insert into snoozer.published_sections (owner_id, revision, position, heading, body, kind, target)
      select actor, saved_revision, position, heading, body, kind, target from snoozer.sections where owner_id = actor;
  end if;
  return saved_revision;
end $$;

create or replace function snoozer.restore_publication_with_sections(p_revision integer, p_expected integer) returns void
language plpgsql security definer set search_path = '' as $$
declare actor uuid := snoozer.verified_user();
begin
  perform snoozer.restore_publication(p_revision, p_expected);
  delete from snoozer.sections where owner_id = actor;
  insert into snoozer.sections (owner_id, position, heading, body, kind, target)
    select actor, position, heading, body, kind, target from snoozer.published_sections
    where owner_id = actor and revision = p_revision;
end $$;

create or replace function snoozer.get_draft_with_sections() returns jsonb
language sql stable security definer set search_path = '' as $$
  select snoozer.get_draft() || jsonb_build_object('sections', coalesce(jsonb_agg(
    snoozer.section_item(heading, body, kind, target) order by position), '[]'::jsonb))
  from snoozer.sections where owner_id = snoozer.verified_user()
$$;

create or replace function snoozer.section_snapshot(p_owner uuid, p_revision integer) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('sections', coalesce(jsonb_agg(
    snoozer.section_item(heading, body, kind, target) order by position), '[]'::jsonb))
  from snoozer.published_sections where owner_id = p_owner and revision = p_revision
$$;

drop function snoozer.section_item(text,text,text);
revoke execute on function snoozer.valid_countdown_target(text), snoozer.section_item(text,text,text,text) from public, anon, authenticated, service_role;
