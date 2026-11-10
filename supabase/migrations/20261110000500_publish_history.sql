create function public.list_publications() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'revision', v.revision, 'display_name', v.display_name, 'published_at', v.published_at,
    'live', v.revision is not distinct from p.published_revision
  ) order by v.revision desc), '[]'::jsonb)
  from snoozer.profiles p join snoozer.published_profiles v on v.owner_id = p.owner_id
  where p.owner_id = snoozer.verified_user()
$$;

create function public.get_publication(p_revision integer) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'username', p.username, 'display_name', v.display_name, 'bio', v.bio,
    'theme', v.theme, 'indexable', v.indexable, 'avatar', v.avatar,
    'revision', v.revision, 'published_at', v.published_at,
    'draft_revision', p.revision, 'live', v.revision is not distinct from p.published_revision,
    'links', coalesce((select jsonb_agg(jsonb_build_object('label', l.label, 'url', l.url) order by l.position)
      from snoozer.published_links l where l.owner_id = v.owner_id and l.revision = v.revision), '[]'::jsonb)
  )
  from snoozer.profiles p join snoozer.published_profiles v on v.owner_id = p.owner_id
  where p.owner_id = snoozer.verified_user() and v.revision = p_revision
$$;

create function public.restore_publication(p_revision integer, p_expected integer) returns void
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

-- The private Studio asset route also serves previews of the owner's retained versions.
create or replace function public.draft_avatar_scope(p_avatar uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select p.media_scope from snoozer.profiles p where p.owner_id = snoozer.verified_user()
  and (p.avatar = p_avatar or exists (
    select 1 from snoozer.published_profiles v where v.owner_id = p.owner_id and v.avatar = p_avatar
  ))
$$;

revoke execute on function public.list_publications(), public.get_publication(integer),
  public.restore_publication(integer,integer) from public, anon, authenticated, service_role;
grant execute on function public.list_publications(), public.get_publication(integer),
  public.restore_publication(integer,integer) to authenticated;
