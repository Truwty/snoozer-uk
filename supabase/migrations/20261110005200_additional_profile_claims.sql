alter table snoozer.profile_revision_floor add column requires_profile_id boolean not null default false;

create function snoozer.legacy_profile_id(p_owner uuid) returns uuid
language sql stable set search_path = '' as $$
  select p.id from snoozer.profiles p
  where p.owner_id = p_owner and not exists (
    select 1 from snoozer.profile_revision_floor f where f.owner_id = p_owner and f.requires_profile_id
  )
$$;
revoke execute on function snoozer.legacy_profile_id(uuid) from public, anon, authenticated, service_role;

create function public.claim_additional_profile(p_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare actor uuid := snoozer.verified_user();
declare claimed uuid;
declare owned integer;
begin
  perform 1 from auth.users where id = actor for update;
  select count(*) into owned from snoozer.profiles where owner_id = actor;
  if owned = 0 or owned >= coalesce((select (plan).profiles from snoozer.effective_plan(actor)), 0) then
    raise exception 'Profile allowance reached' using errcode = 'P1005';
  end if;
  if not public.username_available(p_name) then
    raise exception 'Username unavailable' using errcode = '23505';
  end if;
  if exists (select 1 from snoozer.profile_revision_floor
    where owner_id = actor and last_reclaim_at > clock_timestamp() - interval '24 hours') then
    raise exception 'Replacement claim cooldown' using errcode = 'P1001';
  end if;
  insert into snoozer.profiles(owner_id, username, display_name)
    values (actor, p_name, p_name) returning id into claimed;
  insert into snoozer.profile_revision_floor(owner_id, next_revision, requires_profile_id)
    values (actor, 0, true)
    on conflict (owner_id) do update set requires_profile_id = true,
      last_reclaim_at = case when profile_revision_floor.next_revision > 0 then clock_timestamp()
        else profile_revision_floor.last_reclaim_at end;
  return claimed;
end $$;
revoke execute on function public.claim_additional_profile(text) from public, anon, authenticated, service_role;
grant execute on function public.claim_additional_profile(text) to authenticated;

create or replace function public.get_draft() returns jsonb
language sql stable security definer set search_path = '' as $$
  select snoozer.profile_draft(p.id) || jsonb_build_object('profile_id', p.id)
  from snoozer.profiles p where p.owner_id = snoozer.verified_user()
  order by p.created_at, p.id limit 1
$$;

create or replace function public.save_profile(p_expected integer, p_name text, p_bio text, p_theme text, p_indexable boolean, p_links jsonb, p_publish boolean, p_remove_avatar boolean, p_sections jsonb default null, p_appearance jsonb default null) returns integer
language sql security definer set search_path = '' as $$
  select public.save_profile(snoozer.legacy_profile_id(snoozer.verified_user()), p_expected, p_name, p_bio, p_theme, p_indexable, p_links, p_publish, p_remove_avatar, p_sections, p_appearance)
$$;

create or replace function public.restore_publication(p_revision integer, p_expected integer) returns void
language sql security definer set search_path = '' as $$
  select public.restore_publication(snoozer.legacy_profile_id(snoozer.verified_user()), p_revision, p_expected)
$$;

create or replace function public.unpublish_profile(p_expected integer) returns void
language sql security definer set search_path = '' as $$
  select public.unpublish_profile(snoozer.legacy_profile_id(snoozer.verified_user()), p_expected)
$$;

create or replace function public.delete_profile(p_expected integer, p_username text) returns void
language sql security definer set search_path = '' as $$
  select public.delete_profile(snoozer.legacy_profile_id(snoozer.verified_user()), p_expected, p_username)
$$;

create or replace function public.get_publication(p_revision integer) returns jsonb
language sql stable security definer set search_path = '' as $$
  select public.get_publication(p_revision, snoozer.legacy_profile_id(snoozer.verified_user()))
$$;

create or replace function public.list_publications() returns jsonb
language sql stable security definer set search_path = '' as $$
  select public.list_publications(snoozer.legacy_profile_id(snoozer.verified_user()))
$$;

create or replace function public.pending_gallery_upload() returns jsonb
language sql stable security definer set search_path = '' as $$
  select public.pending_gallery_upload(snoozer.legacy_profile_id(snoozer.verified_user()))
$$;

create or replace function public.get_media_folders() returns jsonb
language sql stable security definer set search_path = '' as $$
  select public.get_media_folders(snoozer.legacy_profile_id(snoozer.verified_user()))
$$;

create or replace function public.edit_media_folders(p_scope uuid, p_expected integer, p_operation text, p_id uuid default null, p_name text default null, p_folder uuid default null) returns text
language sql security definer set search_path = '' as $$
  select public.edit_media_folders_for_profile(snoozer.legacy_profile_id(snoozer.verified_user()), p_scope, p_expected, p_operation, p_id, p_name, p_folder)
$$;

create or replace function public.edit_gallery(p_expected integer, p_id uuid, p_operation text) returns boolean
language sql security definer set search_path = '' as $$
  select public.edit_gallery(snoozer.legacy_profile_id(snoozer.verified_user()), p_expected, p_id, p_operation)
$$;

create or replace function public.add_library_image_to_gallery(p_expected integer, p_id uuid) returns text
language sql security definer set search_path = '' as $$
  select public.add_library_image_to_gallery(snoozer.legacy_profile_id(snoozer.verified_user()), p_expected, p_id)
$$;

create or replace function public.begin_avatar_processing(p_owner uuid, p_expected integer) returns boolean
language sql security definer set search_path = '' as $$
  select public.begin_avatar_processing(p_owner, snoozer.legacy_profile_id(p_owner), p_expected)
$$;

create or replace function public.prepare_avatar_upload(p_owner uuid, p_expected integer, p_open boolean) returns jsonb
language sql security definer set search_path = '' as $$
  select public.prepare_avatar_upload(p_owner, snoozer.legacy_profile_id(p_owner), p_expected, p_open)
$$;

create or replace function public.clear_avatar_upload(p_owner uuid, p_expected integer, p_key text) returns boolean
language sql security definer set search_path = '' as $$
  select public.clear_avatar_upload(p_owner, snoozer.legacy_profile_id(p_owner), p_expected, p_key)
$$;

create or replace function public.commit_avatar_upload(p_owner uuid, p_expected integer, p_key text, p_avatar uuid) returns boolean
language sql security definer set search_path = '' as $$
  select public.commit_avatar_upload(p_owner, snoozer.legacy_profile_id(p_owner), p_expected, p_key, p_avatar)
$$;

create or replace function public.avatar_references(p_owner uuid) returns uuid[]
language sql stable security definer set search_path = '' as $$
  select public.avatar_references(p_owner, snoozer.legacy_profile_id(p_owner))
$$;

create or replace function public.prepare_gallery_upload(p_owner uuid, p_expected integer, p_alt text, p_id uuid default null) returns jsonb
language sql security definer set search_path = '' as $$
  select public.prepare_gallery_upload_for_profile(snoozer.legacy_profile_id(p_owner), p_owner, p_expected, p_alt, p_id)
$$;

create or replace function public.commit_gallery_upload(p_owner uuid, p_expected integer, p_id uuid, p_variant uuid, p_width integer, p_height integer) returns boolean
language sql security definer set search_path = '' as $$
  select public.commit_gallery_upload(snoozer.legacy_profile_id(p_owner), p_owner, p_expected, p_id, p_variant, p_width, p_height)
$$;

create or replace function public.discard_gallery_upload(p_owner uuid, p_expected integer, p_id uuid) returns uuid
language sql security definer set search_path = '' as $$
  select public.discard_gallery_upload(snoozer.legacy_profile_id(p_owner), p_owner, p_expected, p_id)
$$;

create or replace function public.set_avatar(p_owner uuid, p_expected integer, p_avatar uuid) returns boolean
language sql security definer set search_path = '' as $$
  with updated as (
    update snoozer.profiles set avatar = p_avatar, revision = revision + 1, updated_at = now()
    where id = snoozer.legacy_profile_id(p_owner) and revision = p_expected and p_avatar is not null
    returning 1
  )
  select exists (select 1 from updated)
$$;

create or replace function public.draft_media_scope(p_expected integer) returns uuid
language sql stable security definer set search_path = '' as $$
  select media_scope from snoozer.profiles
  where id = snoozer.legacy_profile_id(snoozer.verified_user()) and revision = p_expected
$$;

create or replace function public.published_avatar_owner(p_name text, p_avatar uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select p.owner_id from snoozer.profiles p join snoozer.published_profiles v
    on (p.id, p.published_revision) = (v.profile_id, v.revision)
  where p.username = p_name and v.avatar = p_avatar
$$;
