begin;
-- Project targets are outbound addresses only; never fetched by the server.
create function snoozer.valid_project_url(p_url text) returns boolean
language sql immutable set search_path = '' as $$
 select coalesce(char_length(p_url) between 1 and 2048
   and p_url ~* '^https?://[a-z0-9.-]+(:[0-9]{1,5})?([/?#][^[:space:]\\]*)?$'
   and substring(lower(p_url) from '^https?://([a-z0-9.-]+)') ~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$'
   and substring(lower(p_url) from '^https?://([a-z0-9.-]+)') !~ '\.(local|localhost|internal|test|invalid|example|onion)$'
   and coalesce(substring(lower(p_url) from '^https?://[a-z0-9.-]+:([0-9]{1,5})')::integer,0) <= 65535, false)
$$;
revoke execute on function snoozer.valid_project_url(text) from public, anon, authenticated, service_role;
alter table snoozer.sections drop constraint sections_kind_check, drop constraint sections_target_check,
 add constraint sections_kind_check check (kind in ('text','callout','quote','countdown','project')),
 add constraint sections_target_check check (
   (kind='countdown' and snoozer.valid_countdown_target(target))
   or (kind='project' and snoozer.valid_project_url(target))
   or (kind not in ('countdown','project') and target is null));
alter table snoozer.published_sections drop constraint published_sections_kind_check, drop constraint published_sections_target_check,
 add constraint published_sections_kind_check check (kind in ('text','callout','quote','countdown','project')),
 add constraint published_sections_target_check check (
   (kind='countdown' and snoozer.valid_countdown_target(target))
   or (kind='project' and snoozer.valid_project_url(target))
   or (kind not in ('countdown','project') and target is null));
-- The renderer maps the entrance choice to a built-in motion preset.
create or replace function snoozer.valid_profile_appearance(p_value jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(p_value) = 'object' then coalesce(
    p_value - array['layout','accent','entrance'] = jsonb_build_object('density', p_value->'density', 'corners', p_value->'corners')
    and p_value->>'density' in ('compact','balanced','airy')
    and p_value->>'corners' in ('square','soft','round')
    and (not p_value ? 'layout' or p_value->>'layout' in ('centred','editorial','portfolio'))
    and (not p_value ? 'accent' or p_value->>'accent' in ('theme','mint','rose','ink'))
    and (not p_value ? 'entrance' or p_value->>'entrance' in ('none','fade')), false) else false end
$$;
create or replace function snoozer.section_item(p_heading text, p_body text, p_kind text, p_target text, p_hidden boolean, p_locked boolean) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object('heading', p_heading, 'body', p_body) ||
    case when p_kind = 'text' then '{}'::jsonb else jsonb_build_object('kind', p_kind) end ||
    case when p_kind in ('countdown','project') then jsonb_build_object('target', p_target) else '{}'::jsonb end ||
    case when p_locked then '{"locked":true}'::jsonb else '{}'::jsonb end ||
    case when p_hidden then '{"hidden":true}'::jsonb else '{}'::jsonb end
$$;

create or replace function snoozer.save_profile_sections_for_id(
  p_profile uuid,
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
      where (s ? 'kind' and (jsonb_typeof(s->'kind') is distinct from 'string' or s->>'kind' not in ('text','callout','quote','countdown','project')))
         or (s->>'kind' = 'countdown' and
            (jsonb_typeof(s->'target') is distinct from 'string' or not snoozer.valid_countdown_target(s->>'target')))
         or (s->>'kind' = 'project' and (jsonb_typeof(s->'target') is distinct from 'string' or not snoozer.valid_project_url(s->>'target')))
         or (coalesce(s->>'kind','text') not in ('countdown','project') and s ? 'target')
         or (s ? 'hidden' and jsonb_typeof(s->'hidden') is distinct from 'boolean')
         or (s ? 'locked' and jsonb_typeof(s->'locked') is distinct from 'boolean')
         or jsonb_typeof(s->'heading') is distinct from 'string'
         or jsonb_typeof(s->'body') is distinct from 'string'
         or char_length(btrim(s->>'heading', E' \t\r\n')) not between 1 and 80
         or char_length(btrim(s->>'body', E' \t\r\n')) not between 1 and 800
         or (s->>'heading') !~ '[^[:space:]]' or (s->>'body') !~ '[^[:space:]]'
    ) then
      raise exception 'Invalid text sections' using errcode = '22023';
    end if;
  end if;

  saved_revision := snoozer.save_profile_for_id(p_profile, p_expected, p_name, p_bio, p_theme,
    p_indexable, p_links, p_publish, p_remove_avatar);
  -- Older callers omit p_sections. Preserve their draft sections in that case.
  if p_sections is not null then
    -- Older editors strip unknown fields. Require an explicit choice when a draft contains hidden content.
    if exists (select 1 from snoozer.sections where profile_id = p_profile and hidden)
      and exists (select 1 from jsonb_array_elements(p_sections) s where not s ? 'hidden') then
      raise exception 'Explicit section visibility required' using errcode = '22023';
    end if;
    if exists (select 1 from snoozer.sections where profile_id = p_profile and locked)
      and exists (select 1 from jsonb_array_elements(p_sections) s where not s ? 'locked') then
      raise exception 'Explicit section lock required' using errcode = '22023';
    end if;
    delete from snoozer.sections where profile_id = p_profile;
    insert into snoozer.sections(owner_id, position, heading, body, kind, target, hidden, locked, profile_id)
      select actor, position, btrim(section->>'heading', E' \t\r\n'), btrim(section->>'body', E' \t\r\n'), coalesce(section->>'kind', 'text'), section->>'target', coalesce((section->>'hidden')::boolean, false),
        coalesce((section->>'locked')::boolean, false), p_profile
      from jsonb_array_elements(p_sections) with ordinality as items(section, position);
  end if;
  if p_publish then
    insert into snoozer.published_sections (owner_id, revision, position, heading, body, kind, target, hidden, locked, profile_id)
      select actor, saved_revision, position, heading, body, kind, target, hidden, locked, profile_id from snoozer.sections where profile_id = p_profile;
  end if;
  return saved_revision;
end $$;


commit;
