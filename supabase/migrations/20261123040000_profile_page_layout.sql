begin;

create function snoozer.valid_profile_page_layout(p_value jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare item jsonb;
declare item_type text;
declare item_key text;
declare seen text[] := array[]::text[];
begin
  if jsonb_typeof(p_value) is distinct from 'object'
    or p_value - array['version','items'] <> '{}'::jsonb
    or p_value->>'version' is distinct from '1'
    or jsonb_typeof(p_value->'items') is distinct from 'array'
    or jsonb_array_length(p_value->'items') > 9 then
    return false;
  end if;

  for item in select value from jsonb_array_elements(p_value->'items') loop
    if jsonb_typeof(item) is distinct from 'object' then return false; end if;
    item_type := item->>'type';
    if item_type = 'section' then
      if item - array['type','index'] <> '{}'::jsonb
        or jsonb_typeof(item->'index') is distinct from 'number'
        or coalesce(item->>'index','') !~ '^[0-5]$' then
        return false;
      end if;
      item_key := 'section:' || (item->>'index');
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
end $$;
revoke execute on function snoozer.valid_profile_page_layout(jsonb) from public, anon, authenticated, service_role;

alter table snoozer.profiles add column page_layout jsonb not null
  default '{"version":1,"items":[]}'::jsonb
  check (snoozer.valid_profile_page_layout(page_layout));
alter table snoozer.published_profiles add column page_layout jsonb not null
  default '{"version":1,"items":[]}'::jsonb
  check (snoozer.valid_profile_page_layout(page_layout));

create function snoozer.copy_profile_page_layout_to_publication() returns trigger
language plpgsql security definer set search_path = '' as $$
declare snapshot_layout jsonb;
begin
  select p.page_layout into snapshot_layout
  from snoozer.profiles p
  where p.id = new.profile_id and p.owner_id = new.owner_id;
  if snapshot_layout is null then
    raise exception 'Profile layout snapshot unavailable' using errcode = '23503';
  end if;
  new.page_layout := snapshot_layout;
  return new;
end $$;
revoke execute on function snoozer.copy_profile_page_layout_to_publication() from public, anon, authenticated, service_role;
create trigger published_profile_page_layout_snapshot
  before insert on snoozer.published_profiles
  for each row execute function snoozer.copy_profile_page_layout_to_publication();

alter function public.save_profile(uuid,integer,text,text,text,boolean,jsonb,boolean,boolean,jsonb,jsonb,jsonb,jsonb)
  rename to save_profile_without_page_layout;
revoke execute on function public.save_profile_without_page_layout(uuid,integer,text,text,text,boolean,jsonb,boolean,boolean,jsonb,jsonb,jsonb,jsonb)
  from public, anon, authenticated, service_role;

-- Older Studio callers still use the 13-argument contract. Reset their
-- layout to the legacy order so changed section arrays cannot leave stale
-- page-order references behind.
create function public.save_profile(
  p_profile uuid, p_expected integer, p_name text, p_bio text, p_theme text, p_indexable boolean,
  p_links jsonb, p_publish boolean, p_remove_avatar boolean, p_sections jsonb,
  p_appearance jsonb, p_seo jsonb, p_widgets jsonb
) returns integer
language plpgsql security definer set search_path = '' as $$
declare actor uuid := snoozer.verified_user();
declare saved integer;
begin
  if not snoozer.valid_profile_widgets(p_widgets) then
    raise exception 'Invalid profile widgets' using errcode='22023';
  end if;
  update snoozer.profiles set widgets=p_widgets,page_layout='{"version":1,"items":[]}'::jsonb
    where id=p_profile and owner_id=actor and revision=p_expected;
  if not found then raise exception 'Profile revision conflict' using errcode='40001'; end if;
  saved := public.save_profile_without_page_layout(
    p_profile,p_expected,p_name,p_bio,p_theme,p_indexable,p_links,p_publish,p_remove_avatar,
    p_sections,p_appearance,p_seo,p_widgets
  );
  return saved;
end $$;
revoke execute on function public.save_profile(uuid,integer,text,text,text,boolean,jsonb,boolean,boolean,jsonb,jsonb,jsonb,jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.save_profile(uuid,integer,text,text,text,boolean,jsonb,boolean,boolean,jsonb,jsonb,jsonb,jsonb)
  to authenticated;

create function public.save_profile(
  p_profile uuid, p_expected integer, p_name text, p_bio text, p_theme text, p_indexable boolean,
  p_links jsonb, p_publish boolean, p_remove_avatar boolean, p_sections jsonb,
  p_appearance jsonb, p_seo jsonb, p_widgets jsonb, p_page_layout jsonb
) returns integer
language plpgsql security definer set search_path = '' as $$
declare actor uuid := snoozer.verified_user();
declare saved integer;
declare section_count integer;
declare has_widgets boolean;
declare has_gallery boolean;
declare layout_section_count integer;
declare layout_links_count integer;
declare layout_widgets_count integer;
declare layout_gallery_count integer;
declare expected_links_count integer;
declare expected_widgets_count integer;
declare expected_gallery_count integer;
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

  expected_links_count := case when coalesce(jsonb_array_length(p_links),0)>0 then 1 else 0 end;
  expected_widgets_count := case when has_widgets then 1 else 0 end;
  expected_gallery_count := case when has_gallery then 1 else 0 end;

  if exists (
      select 1 from jsonb_array_elements(p_page_layout->'items') item
      where item->>'type'='section' and (item->>'index')::integer >= section_count
    )
    or layout_section_count <> section_count
    or layout_links_count <> expected_links_count
    or layout_widgets_count <> expected_widgets_count
    or layout_gallery_count <> expected_gallery_count then
    raise exception 'Page layout does not match profile content' using errcode='22023';
  end if;

  update snoozer.profiles set page_layout=p_page_layout
  where id=p_profile and owner_id=actor and revision=p_expected;
  if not found then raise exception 'Profile revision conflict' using errcode='40001'; end if;

  saved := public.save_profile_without_page_layout(
    p_profile,p_expected,p_name,p_bio,p_theme,p_indexable,p_links,p_publish,p_remove_avatar,
    p_sections,p_appearance,p_seo,p_widgets
  );
  return saved;
end $$;
revoke execute on function public.save_profile(uuid,integer,text,text,text,boolean,jsonb,boolean,boolean,jsonb,jsonb,jsonb,jsonb,jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.save_profile(uuid,integer,text,text,text,boolean,jsonb,boolean,boolean,jsonb,jsonb,jsonb,jsonb,jsonb)
  to authenticated;

alter function snoozer.profile_draft(uuid) rename to profile_draft_without_page_layout;
create function snoozer.profile_draft(p_profile uuid) returns jsonb
language sql stable set search_path = '' as $$
  select snoozer.profile_draft_without_page_layout(p.id)
    || jsonb_build_object('pageLayout',p.page_layout)
  from snoozer.profiles p where p.id=p_profile
$$;
revoke execute on function snoozer.profile_draft(uuid), snoozer.profile_draft_without_page_layout(uuid)
  from public, anon, authenticated, service_role;

alter function snoozer.profile_snapshot(uuid,integer,boolean) rename to profile_snapshot_without_page_layout;
create function snoozer.profile_snapshot(p_profile uuid,p_revision integer,p_public boolean) returns jsonb
language sql stable set search_path = '' as $$
  select snoozer.profile_snapshot_without_page_layout(p_profile,p_revision,p_public)
    || jsonb_build_object('pageLayout',v.page_layout)
  from snoozer.published_profiles v
  where v.profile_id=p_profile and v.revision=p_revision
$$;
revoke execute on function snoozer.profile_snapshot(uuid,integer,boolean),
  snoozer.profile_snapshot_without_page_layout(uuid,integer,boolean)
  from public, anon, authenticated, service_role;

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
    seo_description=v.seo_description,widgets=v.widgets,page_layout=v.page_layout
  from snoozer.published_profiles v
  where p.id=p_profile and v.profile_id=p_profile and v.revision=p_revision
    and p.owner_id=snoozer.verified_user();
  if not found then raise exception 'Publication unavailable' using errcode='42501'; end if;
end $$;

notify pgrst, 'reload schema';

commit;
