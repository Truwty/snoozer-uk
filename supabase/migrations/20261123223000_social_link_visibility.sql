begin;

alter table snoozer.links
  add column if not exists hidden boolean not null default false;
alter table snoozer.published_links
  add column if not exists hidden boolean not null default false;

create or replace function snoozer.profile_draft_content(p_profile uuid)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'username', p.username, 'display_name', p.display_name, 'bio', p.bio,
    'theme', p.theme, 'indexable', p.indexable, 'avatar', p.avatar,
    'revision', p.revision, 'published_revision', p.published_revision,
    'links', coalesce((select jsonb_agg(
      jsonb_build_object('label', l.label, 'url', l.url, 'hidden', l.hidden)
      order by l.position) from snoozer.links l where l.profile_id = p.id), '[]'::jsonb),
    'sections', coalesce((select jsonb_agg(
      snoozer.section_item(s.heading, s.body, s.kind, s.target, s.hidden, s.locked) order by s.position)
      from snoozer.sections s where s.profile_id = p.id), '[]'::jsonb),
    'gallery', snoozer.profile_gallery(p.id, null)
  ) || snoozer.appearance_fields(p.appearance)
  from snoozer.profiles p where p.id = p_profile
$$;

create or replace function snoozer.profile_snapshot_content(p_profile uuid, p_revision integer, p_public boolean)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'username', p.username, 'display_name', v.display_name, 'bio', v.bio,
    'theme', v.theme, 'indexable', v.indexable, 'avatar', v.avatar,
    'links', coalesce((select jsonb_agg(
      jsonb_build_object('label', l.label, 'url', l.url, 'hidden', l.hidden)
      order by l.position)
      from snoozer.published_links l
      where l.profile_id = p.id and l.revision = v.revision and (not p_public or not l.hidden)), '[]'::jsonb),
    'sections', coalesce((select jsonb_agg(
      snoozer.section_item(s.heading, s.body, s.kind, s.target, s.hidden, s.locked and not p_public)
      order by s.position)
      from snoozer.published_sections s
      where s.profile_id = p.id and s.revision = v.revision and (not p_public or not s.hidden)), '[]'::jsonb),
    'gallery', snoozer.profile_gallery(p.id, v.revision)
  ) || snoozer.appearance_fields(v.appearance) ||
    case when p_public then '{}'::jsonb else jsonb_build_object(
      'revision', v.revision, 'published_at', v.published_at, 'draft_revision', p.revision,
      'live', v.revision is not distinct from p.published_revision) end
  from snoozer.profiles p
  join snoozer.published_profiles v on v.profile_id = p.id and v.revision = p_revision
  where p.id = p_profile
$$;

create or replace function snoozer.save_profile_for_id(
  p_profile uuid, p_expected integer, p_name text, p_bio text, p_theme text,
  p_indexable boolean, p_links jsonb, p_publish boolean, p_remove_avatar boolean
) returns integer
language plpgsql security definer set search_path = '' as $$
declare actor uuid := snoozer.verified_user();
current snoozer.profiles;
item jsonb;
address text;
hostname text;
normalized_links jsonb;
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
      or (item ? 'hidden' and jsonb_typeof(item->'hidden') is distinct from 'boolean')
      or address !~ '^https?://[a-z0-9.-]+(:[0-9]{1,5})?([/?#][^[:space:]\\]*)?$'
      or hostname !~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$'
      or hostname ~ '\.(local|localhost|internal|test|invalid|example|onion)$'
      or coalesce(substring(address from '^https?://[a-z0-9.-]+:([0-9]+)')::integer, 0) > 65535 then
      raise exception 'Invalid link' using errcode = '22023';
    end if;
  end loop;

  select coalesce(jsonb_agg(jsonb_build_object(
    'label', value->>'label',
    'url', value->>'url',
    'hidden', coalesce((value->>'hidden')::boolean, false)
  ) order by ordinality), '[]'::jsonb)
  into normalized_links
  from jsonb_array_elements(p_links) with ordinality as items(value, ordinality);

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
  if jsonb_array_length(normalized_links) > snoozer.current_link_limit() and (
    p_publish or normalized_links is distinct from (
      select coalesce(jsonb_agg(jsonb_build_object(
        'label', label, 'url', url, 'hidden', hidden
      ) order by position), '[]'::jsonb)
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
  insert into snoozer.links(owner_id, position, label, url, hidden, profile_id)
    select actor, position, btrim(value->>'label'), value->>'url',
      coalesce((value->>'hidden')::boolean, false), p_profile
    from jsonb_array_elements(normalized_links) with ordinality as items(value, position);
  if p_publish then
    insert into snoozer.published_profiles(owner_id, revision, display_name, bio, theme, indexable, avatar, profile_id)
      values (actor, current.revision, current.display_name, current.bio, current.theme, current.indexable, current.avatar, p_profile);
    insert into snoozer.published_links(owner_id, revision, position, label, url, hidden, profile_id)
      select actor, current.revision, position, label, url, hidden, p_profile
      from snoozer.links where profile_id = p_profile;
    update snoozer.profiles set published_revision = current.revision where id = p_profile;
    delete from snoozer.published_profiles
    where profile_id = p_profile and revision in (
      select revision from snoozer.published_profiles
      where profile_id = p_profile order by revision desc offset 20
    )
    and revision is distinct from current.published_revision
    and not exists(
      select 1 from snoozer.publication_schedules s
      where s.profile_id=p_profile and s.revision=published_profiles.revision and s.state='pending'
    );
  end if;
  return current.revision;
end;
$$;

create or replace function public.save_profile(
  p_profile uuid, p_expected integer, p_name text, p_bio text, p_theme text,
  p_indexable boolean, p_links jsonb, p_publish boolean, p_remove_avatar boolean,
  p_sections jsonb, p_appearance jsonb, p_seo jsonb, p_widgets jsonb, p_page_layout jsonb
) returns integer
language plpgsql security definer set search_path = '' as $$
declare actor uuid := snoozer.verified_user();
saved integer;
section_count integer;
has_widgets boolean;
has_gallery boolean;
layout_section_count integer;
layout_links_count integer;
layout_widgets_count integer;
layout_gallery_count integer;
expected_links_count integer;
expected_links_layout_count integer;
expected_widgets_count integer;
expected_gallery_count integer;
has_invalid_section_reference boolean;
begin
  if not snoozer.valid_profile_page_layout(p_page_layout) then
    raise exception 'Invalid profile page layout' using errcode = '22023';
  end if;

  section_count := coalesce(jsonb_array_length(p_sections),0);
  has_widgets := coalesce(p_widgets->'guestbook'->>'enabled'='true',false)
    or coalesce(p_widgets->'testimonials'->>'enabled'='true',false)
    or coalesce(p_widgets->'poll'->>'enabled'='true',false)
    or coalesce(p_widgets->'faq'->>'enabled'='true',false);
  select exists(select 1 from snoozer.gallery_items g
    where g.profile_id=p_profile and g.position is not null) into has_gallery;

  select
    count(*) filter (where item->>'type'='section'),
    count(*) filter (where item->>'type'='links'),
    count(*) filter (where item->>'type'='widgets'),
    count(*) filter (where item->>'type'='gallery')
  into layout_section_count,layout_links_count,layout_widgets_count,layout_gallery_count
  from jsonb_array_elements(p_page_layout->'items') item;

  select count(*) into expected_links_count
  from jsonb_array_elements(p_links) item
  where coalesce(item->>'hidden','false') <> 'true';
  expected_links_layout_count := 0;
  if expected_links_count > 0 then expected_links_layout_count := 1; end if;
  expected_widgets_count := 0;
  if has_widgets then expected_widgets_count := 1; end if;
  expected_gallery_count := 0;
  if has_gallery then expected_gallery_count := 1; end if;

  select exists (
    select 1 from jsonb_array_elements(p_page_layout->'items') item
    where item->>'type'='section' and (item->>'index')::integer >= section_count
  ) into has_invalid_section_reference;

  if has_invalid_section_reference then
    raise exception 'Page layout contains an unavailable section' using errcode='22023';
  end if;
  if layout_section_count <> section_count then
    raise exception 'Page layout section count does not match profile content' using errcode='22023';
  end if;
  if layout_links_count <> expected_links_layout_count then
    raise exception 'Page layout link count does not match profile content' using errcode='22023';
  end if;
  if layout_widgets_count <> expected_widgets_count then
    raise exception 'Page layout widget count does not match profile content' using errcode='22023';
  end if;
  if layout_gallery_count <> expected_gallery_count then
    raise exception 'Page layout gallery count does not match profile content' using errcode='22023';
  end if;

  update snoozer.profiles set page_layout=p_page_layout
  where id=p_profile and owner_id=actor and revision=p_expected;
  if not found then raise exception 'Profile revision conflict' using errcode='40001'; end if;

  saved := public.save_profile_without_page_layout(
    p_profile,p_expected,p_name,p_bio,p_theme,p_indexable,p_links,p_publish,p_remove_avatar,
    p_sections,p_appearance,p_seo,p_widgets
  );
  return saved;
end;
$$;

create or replace function snoozer.restore_publication_for_id(
  p_profile uuid, p_revision integer, p_expected integer
) returns void
language plpgsql security definer set search_path = '' as $$
declare actor uuid := snoozer.verified_user();
current_revision integer;
source snoozer.published_profiles;
begin
  select revision into current_revision from snoozer.profiles
    where id = p_profile and owner_id = actor for update;
  if not found or current_revision is distinct from p_expected then
    raise exception 'Profile revision conflict' using errcode = '40001';
  end if;
  select * into source from snoozer.published_profiles
    where profile_id = p_profile and revision = p_revision;
  if not found then
    raise exception 'Publication unavailable' using errcode = 'P1002';
  end if;
  if (select count(*) from snoozer.published_links where profile_id=p_profile and revision=p_revision)
      > snoozer.current_link_limit() then
    raise exception 'Publication exceeds the current link allowance' using errcode = 'P1004';
  end if;

  update snoozer.profiles set
    display_name = source.display_name, bio = source.bio, theme = source.theme,
    indexable = source.indexable, avatar = source.avatar,
    revision = revision + 1, updated_at = now()
  where id = p_profile;
  delete from snoozer.links where profile_id = p_profile;
  insert into snoozer.links(owner_id, position, label, url, hidden, profile_id)
    select owner_id, position, label, url, hidden, profile_id
    from snoozer.published_links where profile_id = p_profile and revision = p_revision;
end;
$$;

create or replace function snoozer.restore_publication(p_revision integer, p_expected integer)
returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid := snoozer.verified_user();
current_revision integer;
source snoozer.published_profiles;
begin
  select revision into current_revision from snoozer.profiles where owner_id = actor for update;
  if not found or current_revision is distinct from p_expected then
    raise exception 'Profile revision conflict' using errcode = '40001';
  end if;
  select * into source from snoozer.published_profiles where owner_id = actor and revision = p_revision;
  if not found then
    raise exception 'Publication unavailable' using errcode = 'P1002';
  end if;
  if (select count(*) from snoozer.published_links where owner_id=actor and revision=p_revision)
      > snoozer.current_link_limit() then
    raise exception 'Publication exceeds the current link allowance' using errcode = 'P1004';
  end if;
  update snoozer.profiles set display_name = source.display_name, bio = source.bio,
    theme = source.theme, indexable = source.indexable, avatar = source.avatar,
    revision = revision + 1, updated_at = now()
  where owner_id = actor;
  delete from snoozer.links where owner_id = actor;
  insert into snoozer.links(owner_id, position, label, url, hidden)
    select owner_id, position, label, url, hidden
    from snoozer.published_links where owner_id = actor and revision = p_revision;
end;
$$;

create or replace function snoozer.profile_snapshot(p_profile uuid, p_revision integer, p_public boolean)
returns jsonb language sql stable set search_path = '' as $$
  select snoozer.profile_snapshot_without_page_layout(p_profile,p_revision,p_public)
    || jsonb_build_object(
      'pageLayout',
      case when p_public then jsonb_build_object(
        'version', v.page_layout->'version',
        'items', coalesce((
          select jsonb_agg(
            case when layout_item.item->>'type'='section' then jsonb_build_object(
              'type','section',
              'index', (
                select count(*)::integer - 1
                from snoozer.published_sections visible_section
                where visible_section.owner_id=v.owner_id
                  and visible_section.revision=v.revision
                  and visible_section.position <= (layout_item.item->>'index')::integer + 1
                  and not visible_section.hidden
              )
            ) else layout_item.item end
            order by layout_item.ordinality
          )
          from jsonb_array_elements(v.page_layout->'items') with ordinality as layout_item(item, ordinality)
          where (
            layout_item.item->>'type' is distinct from 'section'
            or exists (
              select 1 from snoozer.published_sections visible_section
              where visible_section.owner_id=v.owner_id
                and visible_section.revision=v.revision
                and visible_section.position=(layout_item.item->>'index')::integer + 1
                and not visible_section.hidden
            )
          )
          and (
            layout_item.item->>'type' is distinct from 'links'
            or exists (
              select 1 from snoozer.published_links visible_link
              where visible_link.profile_id=p_profile
                and visible_link.revision=p_revision
                and not visible_link.hidden
            )
          )
        ), '[]'::jsonb)
      ) else v.page_layout end
    )
  from snoozer.published_profiles v
  where v.profile_id=p_profile and v.revision=p_revision
$$;

notify pgrst, 'reload schema';
commit;
