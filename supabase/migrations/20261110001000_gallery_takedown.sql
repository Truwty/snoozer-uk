-- Keep immutable snapshots; enforce a takedown when projecting or reading an asset.
alter table snoozer.gallery_items add column blocked_at timestamptz,
  add constraint blocked_gallery_not_in_draft check (blocked_at is null or position is null);

create table snoozer.gallery_takedowns (
  media_scope uuid not null,
  item_id uuid not null,
  case_reference text not null check (case_reference ~ '^[a-zA-Z0-9][a-zA-Z0-9._-]{2,79}$'),
  occurred_at timestamptz not null default now(),
  primary key (media_scope, item_id)
);
alter table snoozer.gallery_takedowns enable row level security;

create or replace function snoozer.gallery_projection(p_owner uuid, p_revision integer default null) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('gallery', coalesce(jsonb_agg(
    jsonb_build_object('id', g.id, 'alt', g.alt, 'width', g.width, 'height', g.height)
    order by coalesce(s.position, g.position)), '[]'::jsonb))
  from snoozer.gallery_items g
  left join snoozer.published_gallery s
    on s.owner_id = g.owner_id and s.item = g.id and s.revision = p_revision
  where g.owner_id = p_owner and g.blocked_at is null and (s.item is not null or (p_revision is null and g.position is not null))
$$;

create or replace function public.gallery_object(p_id uuid, p_name text default null, p_owner uuid default null) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('scope', p.media_scope, 'variant', g.variant)
  from snoozer.profiles p join snoozer.gallery_items g on g.owner_id = p.owner_id and g.id = p_id
  where g.variant is not null and g.blocked_at is null and (
    (p_owner is null and p.username = p_name and exists (
      select 1 from snoozer.published_gallery s
      where s.owner_id = p.owner_id and s.revision = p.published_revision and s.item = p_id
    ))
    or (p_name is null and p.owner_id = p_owner and (g.position is not null or exists (
      select 1 from snoozer.published_gallery s where s.owner_id = p.owner_id and s.item = p_id
    )))
  )
$$;

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
end $$;

create function public.take_down_gallery_image(p_name text, p_id uuid, p_case text) returns text
language plpgsql security definer set search_path = '' as $$
declare profile snoozer.profiles%rowtype;
declare image snoozer.gallery_items%rowtype;
begin
  if p_case is null or p_case !~ '^[a-zA-Z0-9][a-zA-Z0-9._-]{2,79}$' then
    raise exception 'Invalid case reference' using errcode = '22023';
  end if;
  select * into profile from snoozer.profiles where username = p_name for update;
  if not found then return 'not_found'; end if;
  select * into image from snoozer.gallery_items
    where owner_id = profile.owner_id and id = p_id and variant is not null for update;
  if not found then return 'not_found'; end if;
  if image.blocked_at is not null then return 'already_blocked'; end if;
  insert into snoozer.gallery_takedowns(media_scope, item_id, case_reference)
    values (profile.media_scope, p_id, p_case);
  update snoozer.gallery_items set blocked_at = now(), position = null
    where owner_id = profile.owner_id and id = p_id;
  if image.position is not null then
    update snoozer.gallery_items set position = position - 1
      where owner_id = profile.owner_id and position > image.position;
    update snoozer.profiles set revision = revision + 1, updated_at = now() where owner_id = profile.owner_id;
  end if;
  return 'blocked';
end $$;

revoke execute on function public.take_down_gallery_image(text,uuid,text) from public, anon, authenticated, service_role;
grant execute on function public.take_down_gallery_image(text,uuid,text) to service_role;
