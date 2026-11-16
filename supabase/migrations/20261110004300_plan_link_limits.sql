alter table snoozer.links drop constraint links_position_check;
alter table snoozer.links add constraint links_position_check check (position between 1 and 2000);

create function snoozer.current_link_limit() returns integer
language sql stable set search_path = '' as $$
  select least(2000, coalesce((public.get_my_plan() #>> '{quotas,links}')::integer, 20))
$$;
revoke execute on function snoozer.current_link_limit() from public, anon, authenticated, service_role;

create or replace function snoozer.save_profile(
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

  select * into current from snoozer.profiles where owner_id = actor for update;
  if not found or current.revision <> p_expected then
    raise exception 'Profile revision conflict' using errcode = '40001';
  end if;
  if jsonb_array_length(p_links) > snoozer.current_link_limit() and (
    p_publish or p_links is distinct from (
      select coalesce(jsonb_agg(jsonb_build_object('label', label, 'url', url) order by position), '[]'::jsonb)
      from snoozer.links where owner_id = actor
    )
  ) then
    raise exception 'Draft exceeds the current link allowance' using errcode = 'P1004';
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

create or replace function snoozer.restore_publication(p_revision integer, p_expected integer) returns void
language plpgsql security definer set search_path = '' as $$
declare actor uuid := snoozer.verified_user();
declare current_revision integer;
declare source snoozer.published_profiles;
begin
  select revision into current_revision from snoozer.profiles where owner_id = actor for update;
  if not found or current_revision is distinct from p_expected then
    raise exception 'Profile revision conflict' using errcode = '40001';
  end if;

  select * into source from snoozer.published_profiles where owner_id = actor and revision = p_revision;
  if not found then
    raise exception 'Publication unavailable' using errcode = 'P1002';
  end if;

  if (select count(*) from snoozer.published_links where owner_id = actor and revision = p_revision)
      > snoozer.current_link_limit() then
    raise exception 'Publication exceeds the current link allowance' using errcode = 'P1004';
  end if;

  update snoozer.profiles set
    display_name = source.display_name, bio = source.bio, theme = source.theme,
    indexable = source.indexable, avatar = source.avatar,
    revision = revision + 1, updated_at = now()
  where owner_id = actor;

  delete from snoozer.links where owner_id = actor;
  insert into snoozer.links (owner_id, position, label, url)
    select owner_id, position, label, url from snoozer.published_links
    where owner_id = actor and revision = p_revision;
end $$;
