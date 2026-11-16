create function snoozer.save_profile_for_id(
  p_profile uuid,
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
  if jsonb_array_length(p_links) > 2000 then
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

  if p_publish then
    perform pg_advisory_xact_lock(hashtextextended('profile-publication:' || actor::text, 0));
  end if;
  select * into current from snoozer.profiles where id = p_profile and owner_id = actor for update;
  if not found or current.revision <> p_expected then
    raise exception 'Profile revision conflict' using errcode = '40001';
  end if;
  if p_publish and
    (select count(*) from snoozer.profiles where owner_id = actor and published_revision is not null)
      + (case when current.published_revision is null then 1 else 0 end)
      > coalesce((select (plan).profiles from snoozer.effective_plan(actor)), 0) then
    raise exception 'Published profile limit reached' using errcode = 'P1005';
  end if;
  if jsonb_array_length(p_links) > snoozer.current_link_limit() and (
    p_publish or p_links is distinct from (
      select coalesce(jsonb_agg(jsonb_build_object('label', label, 'url', url) order by position), '[]'::jsonb)
      from snoozer.links where profile_id = p_profile
    )
  ) then
    raise exception 'Draft exceeds the current link allowance' using errcode = 'P1004';
  end if;

  update snoozer.profiles set
    display_name = btrim(p_name), bio = btrim(p_bio), theme = p_theme, indexable = p_indexable,
    avatar = case when p_remove_avatar then null else avatar end,
    revision = revision + 1, updated_at = now()
  where id = p_profile returning * into current;

  delete from snoozer.links where profile_id = p_profile;
  insert into snoozer.links(owner_id, position, label, url, profile_id)
    select actor, position, btrim(value->>'label'), value->>'url', p_profile
    from jsonb_array_elements(p_links) with ordinality as items(value, position);
  if p_publish then
    -- Keep a bounded publication history until plan-based retention is available.
    insert into snoozer.published_profiles(owner_id, revision, display_name, bio, theme, indexable, avatar, profile_id)
      values (actor, current.revision, current.display_name, current.bio, current.theme, current.indexable, current.avatar, p_profile);
    insert into snoozer.published_links(owner_id, revision, position, label, url, profile_id)
      select actor, current.revision, position, label, url, p_profile from snoozer.links where profile_id = p_profile;
    update snoozer.profiles set published_revision = current.revision where id = p_profile;
    delete from snoozer.published_profiles where profile_id = p_profile and revision in (
      select revision from snoozer.published_profiles where profile_id = p_profile
      order by revision desc offset 20
    );
  end if;
  return current.revision;
end $$;

create function snoozer.restore_publication_for_id(p_profile uuid, p_revision integer, p_expected integer) returns void
language plpgsql security definer set search_path = '' as $$
declare actor uuid := snoozer.verified_user();
declare current_revision integer;
declare source snoozer.published_profiles;
begin
  select revision into current_revision from snoozer.profiles where id = p_profile and owner_id = actor for update;
  if not found or current_revision is distinct from p_expected then
    raise exception 'Profile revision conflict' using errcode = '40001';
  end if;

  select * into source from snoozer.published_profiles where profile_id = p_profile and revision = p_revision;
  if not found then
    raise exception 'Publication unavailable' using errcode = 'P1002';
  end if;

  if (select count(*) from snoozer.published_links where profile_id = p_profile and revision = p_revision)
      > snoozer.current_link_limit() then
    raise exception 'Publication exceeds the current link allowance' using errcode = 'P1004';
  end if;

  update snoozer.profiles set
    display_name = source.display_name, bio = source.bio, theme = source.theme,
    indexable = source.indexable, avatar = source.avatar,
    revision = revision + 1, updated_at = now()
  where id = p_profile;

  delete from snoozer.links where profile_id = p_profile;
  insert into snoozer.links (owner_id, position, label, url, profile_id)
    select owner_id, position, label, url, profile_id from snoozer.published_links
    where profile_id = p_profile and revision = p_revision;
end $$;

create function snoozer.save_profile_sections_for_id(
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
      where (s ? 'kind' and (jsonb_typeof(s->'kind') is distinct from 'string' or s->>'kind' not in ('text','callout','quote','countdown')))
         or (s->>'kind' = 'countdown' and
            (jsonb_typeof(s->'target') is distinct from 'string' or not snoozer.valid_countdown_target(s->>'target')))
         or (s->>'kind' is distinct from 'countdown' and s ? 'target')
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

create function snoozer.restore_profile_sections_for_id(p_profile uuid, p_revision integer, p_expected integer) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform snoozer.restore_publication_for_id(p_profile, p_revision, p_expected);
  delete from snoozer.sections where profile_id = p_profile;
  insert into snoozer.sections (owner_id, position, heading, body, kind, target, hidden, locked, profile_id)
    select owner_id, position, heading, body, kind, target, hidden, locked, profile_id from snoozer.published_sections
    where profile_id = p_profile and revision = p_revision;
end $$;

create function public.save_profile(
  p_profile uuid,
  p_expected integer, p_name text, p_bio text, p_theme text, p_indexable boolean,
  p_links jsonb, p_publish boolean, p_remove_avatar boolean, p_sections jsonb default null,
  p_appearance jsonb default null
) returns integer
language plpgsql security definer set search_path = '' as $$
declare actor uuid := snoozer.verified_user();
declare saved integer;
begin
  if p_appearance is not null and not snoozer.valid_profile_appearance(p_appearance) then
    raise exception 'Invalid appearance' using errcode = '22023';
  end if;
  saved := snoozer.save_profile_sections_for_id(p_profile, p_expected, p_name, p_bio, p_theme,
    p_indexable, p_links, p_publish, p_remove_avatar, p_sections);
  if p_appearance is not null then
    update snoozer.profiles set appearance = nullif(p_appearance, '{"density":"balanced","corners":"soft"}'::jsonb)
      where id = p_profile;
  end if;
  if p_publish then
    update snoozer.published_profiles v set appearance = p.appearance
      from snoozer.profiles p where v.profile_id = p_profile and v.revision = saved and p.id = p_profile;
    insert into snoozer.published_gallery(owner_id, revision, position, item, profile_id)
      select actor, saved, position, id, profile_id from snoozer.gallery_items where profile_id = p_profile and position is not null;
  end if;
  return saved;
end $$;

create function public.restore_publication(p_profile uuid, p_revision integer, p_expected integer) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform snoozer.restore_profile_sections_for_id(p_profile, p_revision, p_expected);
  update snoozer.gallery_items set position = null where profile_id = p_profile and position is not null;
  with visible_items as (
    select g.id, row_number() over (order by s.position) as position
    from snoozer.published_gallery s join snoozer.gallery_items g on g.profile_id = s.profile_id and g.id = s.item
    where s.profile_id = p_profile and s.revision = p_revision and g.blocked_at is null
  )
  update snoozer.gallery_items g set position = v.position
    from visible_items v where g.profile_id = p_profile and g.id = v.id;
  update snoozer.profiles p set appearance = v.appearance
    from snoozer.published_profiles v
    where p.id = p_profile and v.profile_id = p_profile and v.revision = p_revision;
end $$;

create function public.unpublish_profile(p_profile uuid, p_expected integer) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update snoozer.profiles set published_revision = null, revision = revision + 1, updated_at = now()
  where id = p_profile and owner_id = snoozer.verified_user() and revision = p_expected;
  if not found then
    raise exception 'Profile revision conflict' using errcode = '40001';
  end if;
end $$;

-- Existing callers use the only profile until Studio exposes profile selection.
create or replace function public.get_draft() returns jsonb
language sql stable security definer set search_path = '' as $$
  select snoozer.profile_draft(p.id) || jsonb_build_object('profile_id', p.id)
  from snoozer.profiles p where p.owner_id = snoozer.verified_user()
$$;

create or replace function public.get_draft(p_profile uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select snoozer.profile_draft(p.id) || jsonb_build_object('profile_id', p.id)
  from snoozer.profiles p where p.id = p_profile and p.owner_id = snoozer.verified_user()
$$;

create or replace function public.save_profile(
  p_expected integer, p_name text, p_bio text, p_theme text, p_indexable boolean,
  p_links jsonb, p_publish boolean, p_remove_avatar boolean, p_sections jsonb default null,
  p_appearance jsonb default null
) returns integer
language sql security definer set search_path = '' as $$
  select public.save_profile((select id from snoozer.profiles where owner_id = snoozer.verified_user()),
    p_expected, p_name, p_bio, p_theme, p_indexable, p_links, p_publish, p_remove_avatar, p_sections, p_appearance)
$$;

create or replace function public.restore_publication(p_revision integer, p_expected integer) returns void
language sql security definer set search_path = '' as $$
  select public.restore_publication((select id from snoozer.profiles where owner_id = snoozer.verified_user()),
    p_revision, p_expected)
$$;

create or replace function public.unpublish_profile(p_expected integer) returns void
language sql security definer set search_path = '' as $$
  select public.unpublish_profile((select id from snoozer.profiles where owner_id = snoozer.verified_user()), p_expected)
$$;

revoke execute on function snoozer.save_profile_for_id(uuid,integer,text,text,text,boolean,jsonb,boolean,boolean),
  snoozer.save_profile_sections_for_id(uuid,integer,text,text,text,boolean,jsonb,boolean,boolean,jsonb),
  snoozer.restore_publication_for_id(uuid,integer,integer),
  snoozer.restore_profile_sections_for_id(uuid,integer,integer),
  public.save_profile(uuid,integer,text,text,text,boolean,jsonb,boolean,boolean,jsonb,jsonb),
  public.restore_publication(uuid,integer,integer), public.unpublish_profile(uuid,integer)
from public, anon, authenticated, service_role;
grant execute on function public.save_profile(uuid,integer,text,text,text,boolean,jsonb,boolean,boolean,jsonb,jsonb),
  public.restore_publication(uuid,integer,integer), public.unpublish_profile(uuid,integer) to authenticated;
