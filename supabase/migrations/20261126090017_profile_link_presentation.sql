-- Persist visual link modes and artwork through profile drafts and immutable publications.
-- Null values preserve the default detected-provider icon for existing links.
alter table snoozer.links
  add column if not exists mode text,
  add column if not exists icon_image uuid,
  add column if not exists audio_cover_image uuid;
alter table snoozer.published_links
  add column if not exists mode text,
  add column if not exists icon_image uuid,
  add column if not exists audio_cover_image uuid;

alter table snoozer.links
  drop constraint if exists links_mode_check;
alter table snoozer.links
  add constraint links_mode_check check(mode is null or mode in ('icon','text'));
alter table snoozer.published_links
  drop constraint if exists published_links_mode_check;
alter table snoozer.published_links
  add constraint published_links_mode_check check(mode is null or mode in ('icon','text'));

create or replace function snoozer.profile_draft_content(p_profile uuid)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'username', p.username, 'display_name', p.display_name, 'bio', p.bio,
    'theme', p.theme, 'indexable', p.indexable, 'avatar', p.avatar,
    'revision', p.revision, 'published_revision', p.published_revision,
    'links', coalesce((select jsonb_agg(
      jsonb_strip_nulls(jsonb_build_object(
        'label', l.label, 'url', l.url, 'hidden', l.hidden,
        'mode', l.mode, 'iconImage', l.icon_image, 'audioCoverImage', l.audio_cover_image
      )) order by l.position) from snoozer.links l where l.profile_id = p.id), '[]'::jsonb),
    'sections', coalesce((select jsonb_agg(
      snoozer.section_item(s.heading, s.body, s.kind, s.target, s.hidden, s.locked) order by s.position)
      from snoozer.sections s where s.profile_id = p.id), '[]'::jsonb),
    'blocks', p.blocks,
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
      jsonb_strip_nulls(jsonb_build_object(
        'label', l.label, 'url', l.url, 'hidden', l.hidden,
        'mode', l.mode, 'iconImage', l.icon_image, 'audioCoverImage', l.audio_cover_image
      )) order by l.position)
      from snoozer.published_links l
      where l.profile_id = p.id and l.revision = v.revision and (not p_public or not l.hidden)), '[]'::jsonb),
    'sections', coalesce((select jsonb_agg(
      snoozer.section_item(s.heading, s.body, s.kind, s.target, s.hidden, s.locked and not p_public)
      order by s.position)
      from snoozer.published_sections s
      where s.profile_id = p.id and s.revision = v.revision and (not p_public or not s.hidden)), '[]'::jsonb),
    'blocks', coalesce((
      select jsonb_agg(block_item order by block_ordinality)
      from jsonb_array_elements(v.blocks) with ordinality as block_rows(block_item, block_ordinality)
      where not p_public or (block_item->>'hidden') is distinct from 'true'
    ), '[]'::jsonb),
    'gallery', snoozer.profile_gallery(p.id, v.revision)
  ) || snoozer.appearance_fields(v.appearance) ||
    case when p_public then '{}'::jsonb else jsonb_build_object(
      'revision', v.revision, 'published_at', v.published_at, 'draft_revision', p.revision,
      'live', v.revision is not distinct from p.published_revision) end
  from snoozer.profiles p
  join snoozer.published_profiles v on v.profile_id = p.id and v.revision = p_revision
  where p.id = p_profile
$$;

create or replace function public.save_profile(
  p_profile uuid, p_expected integer, p_name text, p_bio text, p_theme text, p_indexable boolean,
  p_links jsonb, p_publish boolean, p_remove_avatar boolean, p_sections jsonb,
  p_appearance jsonb, p_seo jsonb, p_widgets jsonb, p_page_layout jsonb, p_blocks jsonb
) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := snoozer.verified_user();
  saved integer;
  expected_blocks integer;
  layout_blocks integer;
begin
  if not snoozer.valid_profile_blocks(p_blocks) then
    raise exception 'Invalid profile blocks' using errcode = '22023';
  end if;
  if not snoozer.valid_profile_page_layout(p_page_layout) then
    raise exception 'Invalid profile page layout' using errcode = '22023';
  end if;
  if jsonb_typeof(p_links) is distinct from 'array' then
    raise exception 'Invalid links' using errcode = '22023';
  end if;

  -- A custom icon or track cover must reference an image already owned by
  -- this profile. Never trust an arbitrary storage ID submitted by the client.
  if exists (
    select 1
    from jsonb_array_elements(p_links) item
    where
      (item->>'mode' is not null and item->>'mode' not in ('icon','text'))
      or (item->>'iconImage' is not null and (
        item->>'iconImage' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        or not exists (
          select 1 from snoozer.gallery_items g
          where g.profile_id=p_profile and g.id=(item->>'iconImage')::uuid and g.blocked_at is null
        )
      ))
      or (item->>'audioCoverImage' is not null and (
        item->>'audioCoverImage' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        or coalesce(item->>'url','') !~* '\\.(mp3|m4a|ogg|wav|aac|flac)([?#].*)?$'
        or not exists (
          select 1 from snoozer.gallery_items g
          where g.profile_id=p_profile and g.id=(item->>'audioCoverImage')::uuid and g.blocked_at is null
        )
      ))
  ) then
    raise exception 'Invalid link icon or audio artwork' using errcode = '22023';
  end if;

  select count(*) into expected_blocks
  from jsonb_array_elements(p_blocks) block_item
  where coalesce(block_item->>'hidden','false') <> 'true';
  select count(*) into layout_blocks
  from jsonb_array_elements(p_page_layout->'items') layout_item
  where layout_item->>'type' = 'block';

  if layout_blocks <> expected_blocks
    or exists (
      select 1 from jsonb_array_elements(p_page_layout->'items') layout_item
      where layout_item->>'type' = 'block'
        and not exists (
          select 1 from jsonb_array_elements(p_blocks) block_item
          where lower(block_item->>'id') = lower(layout_item->>'id')
            and coalesce(block_item->>'hidden','false') <> 'true'
        )
    ) then
    raise exception 'Page layout does not match profile blocks' using errcode = '22023';
  end if;

  update snoozer.profiles set blocks = p_blocks
  where id = p_profile and owner_id = actor and revision = p_expected;
  if not found then raise exception 'Profile revision conflict' using errcode = '40001'; end if;

  saved := public.save_profile_without_blocks(
    p_profile,p_expected,p_name,p_bio,p_theme,p_indexable,p_links,p_publish,p_remove_avatar,
    p_sections,p_appearance,p_seo,p_widgets,p_page_layout
  );

  update snoozer.links l
  set mode = nullif(item.value->>'mode',''),
      icon_image = nullif(item.value->>'iconImage','')::uuid,
      audio_cover_image = nullif(item.value->>'audioCoverImage','')::uuid
  from jsonb_array_elements(p_links) with ordinality as item(value, ordinality)
  where l.profile_id = p_profile and l.position = item.ordinality;

  if p_publish then
    update snoozer.published_links l
    set mode = source.mode,
        icon_image = source.icon_image,
        audio_cover_image = source.audio_cover_image
    from snoozer.links source
    where l.profile_id = p_profile and l.revision = saved
      and source.profile_id = p_profile and source.position = l.position;
  end if;

  return saved;
end; $$;

-- Restoring a previous immutable publication also restores its link presentation.
create or replace function snoozer.restore_publication_for_id(
  p_profile uuid, p_revision integer, p_expected integer
) returns void language plpgsql security definer set search_path = '' as $$
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
  insert into snoozer.links(owner_id, position, label, url, hidden, profile_id, mode, icon_image, audio_cover_image)
    select owner_id, position, label, url, hidden, profile_id, mode, icon_image, audio_cover_image
    from snoozer.published_links where profile_id = p_profile and revision = p_revision;
end;
$$;

-- Legacy owner-scoped restore path retained for old clients.
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
  insert into snoozer.links(owner_id, position, label, url, hidden, mode, icon_image, audio_cover_image)
    select owner_id, position, label, url, hidden, mode, icon_image, audio_cover_image
    from snoozer.published_links where owner_id = actor and revision = p_revision;
end;
$$;

revoke execute on function public.save_profile(uuid,integer,text,text,text,boolean,jsonb,boolean,boolean,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.save_profile(uuid,integer,text,text,text,boolean,jsonb,boolean,boolean,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb)
  to authenticated;

notify pgrst, 'reload schema';
