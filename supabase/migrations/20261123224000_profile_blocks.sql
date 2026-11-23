begin;

-- Persist typed, non-executable profile blocks in the draft and immutable
-- publication snapshot. Existing profiles are upgraded to an empty block list.
create or replace function snoozer.valid_profile_blocks(p_value jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare
  item jsonb;
  entry jsonb;
  item_type text;
  item_id text;
  target_url text;
  target_host text;
  target_time timestamptz;
  seen_ids text[] := array[]::text[];
begin
  if jsonb_typeof(p_value) is distinct from 'array'
    or jsonb_array_length(p_value) > 32 then
    return false;
  end if;

  for item in select value from jsonb_array_elements(p_value) loop
    if jsonb_typeof(item) is distinct from 'object'
      or jsonb_typeof(item->'id') is distinct from 'string'
      or item->>'id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or jsonb_typeof(item->'hidden') is distinct from 'boolean'
      or jsonb_typeof(item->'locked') is distinct from 'boolean'
      or jsonb_typeof(item->'width') is distinct from 'string'
      or item->>'width' not in ('full','half','third')
      or jsonb_typeof(item->'align') is distinct from 'string'
      or item->>'align' not in ('start','center','end')
      or jsonb_typeof(item->'variant') is distinct from 'string'
      or item->>'variant' not in ('plain','surface','outline','accent')
      or jsonb_typeof(item->'type') is distinct from 'string' then
      return false;
    end if;

    item_id := lower(item->>'id');
    if item_id = any(seen_ids) then return false; end if;
    seen_ids := array_append(seen_ids,item_id);
    item_type := item->>'type';

    if item_type = 'heading' then
      if item - 'id'::text - 'hidden'::text - 'locked'::text - 'width'::text - 'align'::text - 'variant'::text - 'type'::text - 'text'::text - 'level'::text <> '{}'::jsonb
        or jsonb_typeof(item->'text') is distinct from 'string'
        or char_length(btrim(item->>'text')) not between 1 and 160
        or coalesce(item->>'level','h2') not in ('h2','h3') then return false; end if;
    elsif item_type = 'about' then
      if item - 'id'::text - 'hidden'::text - 'locked'::text - 'width'::text - 'align'::text - 'variant'::text - 'type'::text - 'heading'::text - 'body'::text <> '{}'::jsonb
        or jsonb_typeof(item->'heading') is distinct from 'string'
        or char_length(btrim(item->>'heading')) not between 1 and 80
        or jsonb_typeof(item->'body') is distinct from 'string'
        or char_length(btrim(item->>'body')) not between 1 and 2000 then return false; end if;
    elsif item_type = 'callout' then
      if item - 'id'::text - 'hidden'::text - 'locked'::text - 'width'::text - 'align'::text - 'variant'::text - 'type'::text - 'heading'::text - 'body'::text - 'tone'::text <> '{}'::jsonb
        or jsonb_typeof(item->'heading') is distinct from 'string'
        or char_length(btrim(item->>'heading')) not between 1 and 80
        or jsonb_typeof(item->'body') is distinct from 'string'
        or char_length(btrim(item->>'body')) not between 1 and 1200
        or coalesce(item->>'tone','accent') not in ('neutral','accent','info','success','warning') then return false; end if;
    elsif item_type = 'quote' then
      if item - 'id'::text - 'hidden'::text - 'locked'::text - 'width'::text - 'align'::text - 'variant'::text - 'type'::text - 'quote'::text - 'attribution'::text <> '{}'::jsonb
        or jsonb_typeof(item->'quote') is distinct from 'string'
        or char_length(btrim(item->>'quote')) not between 1 and 1000
        or jsonb_typeof(item->'attribution') is distinct from 'string'
        or char_length(item->>'attribution') > 100 then return false; end if;
    elsif item_type = 'project' then
      target_url := item->>'url';
      target_host := substring(target_url from '^https?://([a-z0-9.-]+)');
      if target_url is null
        or item - 'id'::text - 'hidden'::text - 'locked'::text - 'width'::text - 'align'::text - 'variant'::text - 'type'::text - 'title'::text - 'description'::text - 'url'::text - 'buttonLabel'::text <> '{}'::jsonb
        or jsonb_typeof(item->'title') is distinct from 'string'
        or char_length(btrim(item->>'title')) not between 1 and 100
        or jsonb_typeof(item->'description') is distinct from 'string'
        or char_length(item->>'description') > 600
        or jsonb_typeof(item->'buttonLabel') is distinct from 'string'
        or char_length(btrim(item->>'buttonLabel')) not between 1 and 40
        or target_url !~ '^https?://[a-z0-9.-]+(:[0-9]{1,5})?([/?#].*)?$'
        or target_url ~ '[[:space:]]'
        or position(chr(92) in target_url) > 0
        or coalesce(substring(target_url from '^https?://[a-z0-9.-]+:([0-9]+)')::integer, 0) > 65535
        or target_host !~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$'
        or target_host ~ '\.(local|localhost|internal|test|invalid|example|onion)$' then return false; end if;
    elsif item_type = 'skills' then
      if item - 'id'::text - 'hidden'::text - 'locked'::text - 'width'::text - 'align'::text - 'variant'::text - 'type'::text - 'heading'::text - 'items'::text <> '{}'::jsonb
        or jsonb_typeof(item->'heading') is distinct from 'string'
        or char_length(btrim(item->>'heading')) not between 1 and 80
        or jsonb_typeof(item->'items') is distinct from 'array'
        or jsonb_array_length(item->'items') not between 1 and 20 then return false; end if;
      for entry in select value from jsonb_array_elements(item->'items') loop
        if jsonb_typeof(entry) is distinct from 'string' or char_length(btrim(entry#>>'{}')) not between 1 and 60 then return false; end if;
      end loop;
    elsif item_type = 'cta' then
      target_url := item->>'url';
      target_host := substring(target_url from '^https?://([a-z0-9.-]+)');
      if target_url is null
        or item - 'id'::text - 'hidden'::text - 'locked'::text - 'width'::text - 'align'::text - 'variant'::text - 'type'::text - 'heading'::text - 'body'::text - 'label'::text - 'url'::text <> '{}'::jsonb
        or jsonb_typeof(item->'heading') is distinct from 'string'
        or char_length(btrim(item->>'heading')) not between 1 and 100
        or jsonb_typeof(item->'body') is distinct from 'string'
        or char_length(item->>'body') > 600
        or jsonb_typeof(item->'label') is distinct from 'string'
        or char_length(btrim(item->>'label')) not between 1 and 40
        or target_url !~ '^https?://[a-z0-9.-]+(:[0-9]{1,5})?([/?#].*)?$'
        or target_url ~ '[[:space:]]'
        or position(chr(92) in target_url) > 0
        or coalesce(substring(target_url from '^https?://[a-z0-9.-]+:([0-9]+)')::integer, 0) > 65535
        or target_host !~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$'
        or target_host ~ '\.(local|localhost|internal|test|invalid|example|onion)$' then return false; end if;
    elsif item_type = 'divider' then
      if item - 'id'::text - 'hidden'::text - 'locked'::text - 'width'::text - 'align'::text - 'variant'::text - 'type'::text - 'style'::text <> '{}'
        or coalesce(item->>'style','line') not in ('line','space','dotted') then return false; end if;
    elsif item_type = 'countdown' then
      if item - 'id'::text - 'hidden'::text - 'locked'::text - 'width'::text - 'align'::text - 'variant'::text - 'type'::text - 'heading'::text - 'target'::text <> '{}'::jsonb
        or jsonb_typeof(item->'heading') is distinct from 'string'
        or char_length(btrim(item->>'heading')) not between 1 and 80
        or jsonb_typeof(item->'target') is distinct from 'string'
        or item->>'target' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}([.][0-9]+)?(Z|[+-][0-9]{2}:[0-9]{2})$' then return false; end if;
      begin
        target_time := (item->>'target')::timestamptz;
      exception when others then
        return false;
      end;
    elsif item_type = 'stats' then
      if item - 'id'::text - 'hidden'::text - 'locked'::text - 'width'::text - 'align'::text - 'variant'::text - 'type'::text - 'heading'::text - 'items'::text <> '{}'::jsonb
        or jsonb_typeof(item->'heading') is distinct from 'string'
        or char_length(btrim(item->>'heading')) not between 1 and 80
        or jsonb_typeof(item->'items') is distinct from 'array'
        or jsonb_array_length(item->'items') not between 1 and 6 then return false; end if;
      for entry in select value from jsonb_array_elements(item->'items') loop
        if jsonb_typeof(entry) is distinct from 'object'
          or entry - 'label'::text - 'value'::text <> '{}'::jsonb
          or jsonb_typeof(entry->'label') is distinct from 'string'
          or char_length(btrim(entry->>'label')) not between 1 and 40
          or jsonb_typeof(entry->'value') is distinct from 'string'
          or char_length(btrim(entry->>'value')) not between 1 and 40 then return false; end if;
      end loop;
    else
      return false;
    end if;
  end loop;

  return true;
exception when others then
  return false;
end; $$;

revoke execute on function snoozer.valid_profile_blocks(jsonb) from public, anon, authenticated, service_role;

alter table snoozer.profiles add column if not exists blocks jsonb not null default '[]'::jsonb
  check (snoozer.valid_profile_blocks(blocks));
alter table snoozer.published_profiles add column if not exists blocks jsonb not null default '[]'::jsonb
  check (snoozer.valid_profile_blocks(blocks));

create or replace function snoozer.valid_profile_page_layout(p_value jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare
  item jsonb;
  item_type text;
  item_key text;
  seen text[] := array[]::text[];
begin
  if jsonb_typeof(p_value) is distinct from 'object'
    or p_value - 'version'::text - 'items'::text <> '{}'::jsonb
    or p_value->>'version' is distinct from '1'
    or jsonb_typeof(p_value->'items') is distinct from 'array'
    or jsonb_array_length(p_value->'items') > 41 then
    return false;
  end if;

  for item in select value from jsonb_array_elements(p_value->'items') loop
    if jsonb_typeof(item) is distinct from 'object' then return false; end if;
    item_type := item->>'type';
    if item_type = 'section' then
      if item - 'type'::text - 'index'::text <> '{}'::jsonb
        or jsonb_typeof(item->'index') is distinct from 'number'
        or coalesce(item->>'index','') !~ '^[0-5]$' then return false; end if;
      item_key := 'section:' || (item->>'index');
    elsif item_type = 'block' then
      if item - 'type'::text - 'id'::text <> '{}'::jsonb
        or jsonb_typeof(item->'id') is distinct from 'string'
        or item->>'id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return false; end if;
      item_key := 'block:' || lower(item->>'id');
    elsif item_type in ('links','widgets','gallery') then
      if item <> jsonb_build_object('type',item_type) then return false; end if;
      item_key := item_type;
    else
      return false;
    end if;
    if item_key = any(seen) then return false; end if;
    seen := array_append(seen,item_key);
  end loop;

  return true;
exception when others then
  return false;
end; $$;
revoke execute on function snoozer.valid_profile_page_layout(jsonb) from public, anon, authenticated, service_role;

create or replace function snoozer.copy_profile_blocks_to_publication() returns trigger
language plpgsql security definer set search_path = '' as $
declare
  snapshot_blocks jsonb;
begin
  select p.blocks into snapshot_blocks
  from snoozer.profiles p
  where p.id = new.profile_id and p.owner_id = new.owner_id;
  if snapshot_blocks is null then
    raise exception 'Profile blocks snapshot unavailable' using errcode = '23503';
  end if;
  new.blocks := snapshot_blocks;
  return new;
end; $;
revoke execute on function snoozer.copy_profile_blocks_to_publication() from public, anon, authenticated, service_role;
create trigger published_profile_blocks_snapshot
  before insert on snoozer.published_profiles
  for each row execute function snoozer.copy_profile_blocks_to_publication();

-- The draft and publication JSON read paths share the same block data model.
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
      jsonb_build_object('label', l.label, 'url', l.url, 'hidden', l.hidden)
      order by l.position)
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

-- Upgrade the revision-safe save RPC without breaking the 13/14-argument
-- contracts still used by older deployed clients.
alter function public.save_profile(uuid,integer,text,text,text,boolean,jsonb,boolean,boolean,jsonb,jsonb,jsonb,jsonb,jsonb)
  rename to save_profile_without_blocks;
revoke execute on function public.save_profile_without_blocks(uuid,integer,text,text,text,boolean,jsonb,boolean,boolean,jsonb,jsonb,jsonb,jsonb,jsonb)
  from public, anon, authenticated, service_role;

create function public.save_profile(
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

  select count(*) into expected_blocks
  from jsonb_array_elements(p_blocks) block_item
  where coalesce(block_item->>'hidden','false') <> 'true';
  select count(*) into layout_blocks
  from jsonb_array_elements(p_page_layout->'items') layout_item
  where layout_item->>'type' = 'block';

  if layout_blocks <> expected_blocks
    or exists (
      select 1
      from jsonb_array_elements(p_page_layout->'items') layout_item
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
  return saved;
end; $$;
revoke execute on function public.save_profile(uuid,integer,text,text,text,boolean,jsonb,boolean,boolean,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.save_profile(uuid,integer,text,text,text,boolean,jsonb,boolean,boolean,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb)
  to authenticated;

create function public.save_profile(
  p_profile uuid, p_expected integer, p_name text, p_bio text, p_theme text, p_indexable boolean,
  p_links jsonb, p_publish boolean, p_remove_avatar boolean, p_sections jsonb,
  p_appearance jsonb, p_seo jsonb, p_widgets jsonb, p_page_layout jsonb
) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := snoozer.verified_user();
  current_blocks jsonb;
begin
  select p.blocks into current_blocks from snoozer.profiles p
  where p.id = p_profile and p.owner_id = actor and p.revision = p_expected for update;
  if not found then raise exception 'Profile revision conflict' using errcode = '40001'; end if;

  return public.save_profile(
    p_profile,p_expected,p_name,p_bio,p_theme,p_indexable,p_links,p_publish,p_remove_avatar,
    p_sections,p_appearance,p_seo,p_widgets,p_page_layout,current_blocks
  );
end; $$;
revoke execute on function public.save_profile(uuid,integer,text,text,text,boolean,jsonb,boolean,boolean,jsonb,jsonb,jsonb,jsonb,jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.save_profile(uuid,integer,text,text,text,boolean,jsonb,boolean,boolean,jsonb,jsonb,jsonb,jsonb,jsonb)
  to authenticated;

-- Restoring a publication restores its matching immutable block snapshot.
create or replace function public.restore_publication(p_profile uuid,p_revision integer,p_expected integer) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform snoozer.restore_profile_sections_for_id(p_profile,p_revision,p_expected);
  update snoozer.gallery_items set position=null where profile_id=p_profile and position is not null;
  with visible_items as (
    select g.id,row_number() over (order by s.position) as position
    from snoozer.published_gallery s
    join snoozer.gallery_items g on g.profile_id=s.profile_id and g.id=s.item
    where s.profile_id=p_profile and s.revision=p_revision and g.blocked_at is null
  )
  update snoozer.gallery_items g set position=v.position from visible_items v
  where g.profile_id=p_profile and g.id=v.id;

  update snoozer.profiles p set appearance=v.appearance,seo_title=v.seo_title,
    seo_description=v.seo_description,widgets=v.widgets,page_layout=v.page_layout,blocks=v.blocks
  from snoozer.published_profiles v
  where p.id=p_profile and v.profile_id=p_profile and v.revision=p_revision
    and p.owner_id=snoozer.verified_user();
  if not found then raise exception 'Publication unavailable' using errcode='42501'; end if;
end; $$;

-- Filter hidden block references alongside hidden sections and links in the
-- public page order, while preserving the owner's complete revision history.
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
          and (
            layout_item.item->>'type' is distinct from 'block'
            or exists (
              select 1 from jsonb_array_elements(v.blocks) visible_block
              where lower(visible_block->>'id')=lower(layout_item.item->>'id')
                and coalesce(visible_block->>'hidden','false') <> 'true'
            )
          )
        ), '[]'::jsonb)
      ) else v.page_layout end
    )
  from snoozer.published_profiles v
  where v.profile_id=p_profile and v.revision=p_revision
$$;
revoke execute on function snoozer.profile_draft_content(uuid), snoozer.profile_snapshot_content(uuid,integer,boolean),
  snoozer.profile_draft(uuid), snoozer.profile_snapshot(uuid,integer,boolean)
  from public, anon, authenticated, service_role;

notify pgrst, 'reload schema';
commit;
