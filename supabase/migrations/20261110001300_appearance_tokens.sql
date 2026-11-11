-- Only named, built-in CSS token values can be persisted or published.
create function snoozer.valid_profile_appearance(p_value jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(jsonb_typeof(p_value) = 'object'
    and p_value = jsonb_build_object('density', p_value->'density', 'corners', p_value->'corners')
    and p_value->>'density' in ('compact','balanced','airy')
    and p_value->>'corners' in ('square','soft','round'), false)
$$;

create function snoozer.appearance_fields(p_appearance jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select case when p_appearance is null then '{}'::jsonb else jsonb_build_object('appearance', p_appearance) end
$$;

alter table snoozer.profiles add column appearance jsonb check (appearance is null or snoozer.valid_profile_appearance(appearance));
alter table snoozer.published_profiles add column appearance jsonb check (appearance is null or snoozer.valid_profile_appearance(appearance));

-- Replace the signature so PostgREST can continue resolving old calls with omitted optional arguments.
drop function public.save_profile(integer,text,text,text,boolean,jsonb,boolean,boolean,jsonb);
create function public.save_profile(
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
  saved := snoozer.save_profile_with_sections(p_expected, p_name, p_bio, p_theme,
    p_indexable, p_links, p_publish, p_remove_avatar, p_sections);
  if p_appearance is not null then
    update snoozer.profiles set appearance = nullif(p_appearance, '{"density":"balanced","corners":"soft"}'::jsonb)
      where owner_id = actor;
  end if;
  if p_publish then
    update snoozer.published_profiles v set appearance = p.appearance
      from snoozer.profiles p where v.owner_id = actor and v.revision = saved and p.owner_id = actor;
    insert into snoozer.published_gallery(owner_id, revision, position, item)
      select actor, saved, position, id from snoozer.gallery_items where owner_id = actor and position is not null;
  end if;
  return saved;
end $$;

create or replace function public.restore_publication(p_revision integer, p_expected integer) returns void
language plpgsql security definer set search_path = '' as $$
declare actor uuid := snoozer.verified_user();
begin
  perform snoozer.restore_publication_with_sections(p_revision, p_expected);
  update snoozer.gallery_items set position = null where owner_id = actor and position is not null;
  with visible_items as (
    select g.id, row_number() over (order by s.position) as position
    from snoozer.published_gallery s join snoozer.gallery_items g on g.owner_id = s.owner_id and g.id = s.item
    where s.owner_id = actor and s.revision = p_revision and g.blocked_at is null
  )
  update snoozer.gallery_items g set position = v.position
    from visible_items v where g.owner_id = actor and g.id = v.id;
  update snoozer.profiles p set appearance = v.appearance
    from snoozer.published_profiles v
    where p.owner_id = actor and v.owner_id = actor and v.revision = p_revision;
end $$;

create or replace function public.get_draft() returns jsonb
language sql stable security definer set search_path = '' as $$
  select snoozer.get_draft_with_sections() || snoozer.gallery_projection(snoozer.verified_user())
    || snoozer.appearance_fields((select appearance from snoozer.profiles where owner_id = snoozer.verified_user()))
$$;

create or replace function public.get_publication(p_revision integer) returns jsonb
language sql stable security definer set search_path = '' as $$
  select snoozer.get_publication_with_sections(p_revision) || snoozer.gallery_projection(snoozer.verified_user(), p_revision)
    || snoozer.appearance_fields((select appearance from snoozer.published_profiles
      where owner_id = snoozer.verified_user() and revision = p_revision))
$$;

create or replace function public.get_published_profile(p_name text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select snoozer.get_published_profile_with_sections(p_name) || snoozer.gallery_projection(p.owner_id, p.published_revision)
    || snoozer.appearance_fields(v.appearance)
  from snoozer.profiles p join snoozer.published_profiles v on v.owner_id = p.owner_id and v.revision = p.published_revision
  where p.username = p_name
$$;

revoke execute on function snoozer.valid_profile_appearance(jsonb), snoozer.appearance_fields(jsonb),
  public.save_profile(integer,text,text,text,boolean,jsonb,boolean,boolean,jsonb,jsonb) from public, anon, authenticated, service_role;
grant execute on function public.save_profile(integer,text,text,text,boolean,jsonb,boolean,boolean,jsonb,jsonb) to authenticated;
