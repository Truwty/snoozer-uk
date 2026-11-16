create index links_profile_position on snoozer.links(profile_id, position);
create index sections_profile_position on snoozer.sections(profile_id, position);
create index gallery_items_profile on snoozer.gallery_items(profile_id);

create function snoozer.profile_gallery(p_profile uuid, p_revision integer) returns jsonb
language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(
    jsonb_build_object('id', g.id, 'alt', g.alt, 'width', g.width, 'height', g.height)
    order by coalesce(s.position, g.position)), '[]'::jsonb)
  from snoozer.gallery_items g
  left join snoozer.published_gallery s
    on s.profile_id = g.profile_id and s.item = g.id and s.revision = p_revision
  where g.profile_id = p_profile and g.blocked_at is null
    and (s.item is not null or (p_revision is null and g.position is not null))
$$;

create function snoozer.profile_snapshot(p_profile uuid, p_revision integer, p_public boolean) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'username', p.username, 'display_name', v.display_name, 'bio', v.bio,
    'theme', v.theme, 'indexable', v.indexable, 'avatar', v.avatar,
    'links', coalesce((select jsonb_agg(jsonb_build_object('label', l.label, 'url', l.url) order by l.position)
      from snoozer.published_links l where l.profile_id = p.id and l.revision = v.revision), '[]'::jsonb),
    'sections', coalesce((select jsonb_agg(
      snoozer.section_item(s.heading, s.body, s.kind, s.target, s.hidden, s.locked and not p_public) order by s.position)
      from snoozer.published_sections s where s.profile_id = p.id and s.revision = v.revision
        and (not p_public or not s.hidden)), '[]'::jsonb),
    'gallery', snoozer.profile_gallery(p.id, v.revision)
  ) || snoozer.appearance_fields(v.appearance) ||
    case when p_public then '{}'::jsonb else jsonb_build_object(
      'revision', v.revision, 'published_at', v.published_at, 'draft_revision', p.revision,
      'live', v.revision is not distinct from p.published_revision) end
  from snoozer.profiles p
  join snoozer.published_profiles v on v.profile_id = p.id and v.revision = p_revision
  where p.id = p_profile
$$;

create function snoozer.profile_draft(p_profile uuid) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'username', p.username, 'display_name', p.display_name, 'bio', p.bio,
    'theme', p.theme, 'indexable', p.indexable, 'avatar', p.avatar,
    'revision', p.revision, 'published_revision', p.published_revision,
    'links', coalesce((select jsonb_agg(jsonb_build_object('label', l.label, 'url', l.url) order by l.position)
      from snoozer.links l where l.profile_id = p.id), '[]'::jsonb),
    'sections', coalesce((select jsonb_agg(
      snoozer.section_item(s.heading, s.body, s.kind, s.target, s.hidden, s.locked) order by s.position)
      from snoozer.sections s where s.profile_id = p.id), '[]'::jsonb),
    'gallery', snoozer.profile_gallery(p.id, null)
  ) || snoozer.appearance_fields(p.appearance)
  from snoozer.profiles p where p.id = p_profile
$$;

create function public.get_draft(p_profile uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  with actor as materialized (select snoozer.verified_user() as id)
  select snoozer.profile_draft(p.id)
  from actor join snoozer.profiles p on p.owner_id = actor.id
  where p.id = p_profile
$$;

create function public.get_publication(p_revision integer, p_profile uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  with actor as materialized (select snoozer.verified_user() as id)
  select snoozer.profile_snapshot(p.id, p_revision, false)
  from actor join snoozer.profiles p on p.owner_id = actor.id
  where p.id = p_profile
$$;

create or replace function public.get_draft() returns jsonb
language sql stable security definer set search_path = '' as $$
  select snoozer.profile_draft(p.id) from snoozer.profiles p where p.owner_id = snoozer.verified_user()
$$;

create or replace function public.get_publication(p_revision integer) returns jsonb
language sql stable security definer set search_path = '' as $$
  select snoozer.profile_snapshot(p.id, p_revision, false)
  from snoozer.profiles p where p.owner_id = snoozer.verified_user()
$$;

create or replace function public.get_published_profile(p_name text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select snoozer.profile_snapshot(p.id, p.published_revision, true)
  from snoozer.profiles p where p.username = p_name and p.published_revision is not null
$$;

create function public.list_publications(p_profile uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  with actor as materialized (select snoozer.verified_user() as id)
  select coalesce(jsonb_agg(jsonb_build_object(
    'revision', v.revision, 'display_name', v.display_name, 'published_at', v.published_at,
    'live', v.revision is not distinct from p.published_revision
  ) order by v.revision desc), '[]'::jsonb)
  from actor join snoozer.profiles p on p.owner_id = actor.id and p.id = p_profile
  join snoozer.published_profiles v on v.profile_id = p.id
$$;

create or replace function public.list_publications() returns jsonb
language sql stable security definer set search_path = '' as $$
  select public.list_publications((select id from snoozer.profiles where owner_id = snoozer.verified_user()))
$$;

revoke execute on function snoozer.profile_gallery(uuid,integer), snoozer.profile_snapshot(uuid,integer,boolean),
  snoozer.profile_draft(uuid), public.get_draft(uuid), public.get_publication(integer,uuid),
  public.list_publications(uuid)
from public, anon, authenticated, service_role;

grant execute on function public.get_draft(uuid), public.get_publication(integer,uuid), public.list_publications(uuid)
to authenticated;
