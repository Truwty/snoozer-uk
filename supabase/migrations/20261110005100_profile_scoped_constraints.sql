-- Replace each legacy relationship before removing the owner-only keys.
alter table snoozer.profiles drop constraint active_publication;
alter table snoozer.published_links drop constraint published_links_owner_id_revision_fkey;
alter table snoozer.published_sections drop constraint published_sections_owner_id_revision_fkey;
alter table snoozer.published_gallery drop constraint published_gallery_owner_id_revision_fkey;
alter table snoozer.published_gallery drop constraint published_gallery_owner_id_item_fkey;
alter table snoozer.gallery_items drop constraint gallery_items_owner_id_folder_id_fkey;

alter table snoozer.links drop constraint links_owner_id_fkey;
alter table snoozer.sections drop constraint sections_owner_id_fkey;
alter table snoozer.published_profiles drop constraint published_profiles_owner_id_fkey;
alter table snoozer.gallery_items drop constraint gallery_items_owner_id_fkey;
alter table snoozer.media_folders drop constraint media_folders_owner_id_fkey;

alter table snoozer.profiles drop constraint profiles_pkey, drop constraint profiles_id_key, add primary key (id);
alter table snoozer.links drop constraint links_pkey, add primary key (profile_id, position);
alter table snoozer.sections drop constraint sections_pkey, add primary key (profile_id, position);
alter table snoozer.published_profiles drop constraint published_profiles_pkey;
drop index snoozer.links_profile_position;
drop index snoozer.sections_profile_position;
-- The existing unique key on (profile_id, revision) is referenced by all snapshot children.
alter table snoozer.published_links drop constraint published_links_pkey, add primary key using index published_links_profile_position;
alter table snoozer.published_sections drop constraint published_sections_pkey, add primary key using index published_sections_profile_position;
alter table snoozer.published_gallery drop constraint published_gallery_pkey, add primary key using index published_gallery_profile_position;
alter table snoozer.gallery_items drop constraint gallery_items_pkey, add primary key (profile_id, id);
alter table snoozer.media_folders drop constraint media_folders_pkey, add primary key (profile_id, id);

alter table snoozer.gallery_items drop constraint gallery_items_owner_id_position_key,
  add unique (profile_id, position) deferrable initially deferred,
  add foreign key (profile_id, folder_id) references snoozer.media_folders(profile_id, id) deferrable initially deferred;
alter table snoozer.published_gallery add foreign key (profile_id, item)
  references snoozer.gallery_items(profile_id, id) deferrable initially deferred;

drop index snoozer.one_pending_gallery_upload;
create unique index one_pending_gallery_upload on snoozer.gallery_items(profile_id) where variant is null;
drop index snoozer.media_folder_names;
create unique index media_folder_names on snoozer.media_folders(profile_id, lower(name));
drop index snoozer.published_gallery_items;
create index published_gallery_items on snoozer.published_gallery(profile_id, item);
drop index snoozer.gallery_folder_members;
create index gallery_folder_members on snoozer.gallery_items(profile_id, folder_id) where folder_id is not null;
drop index snoozer.gallery_items_profile;

-- Keep the original claim RPC restricted to onboarding while Studio only
-- exposes one profile. The account row lock serializes concurrent claims.
create or replace function public.claim_profile(p_name text) returns void
language plpgsql security definer set search_path = '' as $$
declare actor uuid := snoozer.verified_user();
begin
  perform 1 from auth.users where id = actor for update;
  if not public.username_available(p_name) or exists (select 1 from snoozer.profiles where owner_id = actor) then
    raise exception 'Username unavailable' using errcode = '23505';
  end if;
  if exists (select 1 from snoozer.profile_revision_floor
    where owner_id = actor and last_reclaim_at > clock_timestamp() - interval '24 hours') then
    raise exception 'Replacement claim cooldown' using errcode = 'P1001';
  end if;
  insert into snoozer.profiles(owner_id, username, display_name, revision)
    values (actor, p_name, p_name, coalesce(
      (select next_revision from snoozer.profile_revision_floor where owner_id = actor), 0));
  update snoozer.profile_revision_floor set last_reclaim_at = clock_timestamp() where owner_id = actor;
end $$;
