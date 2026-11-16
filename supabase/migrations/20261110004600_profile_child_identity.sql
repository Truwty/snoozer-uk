-- Backfill profile identities while legacy writes still supply the account ID.
alter table snoozer.profiles add constraint profiles_owner_identity_key unique (owner_id, id);

create function snoozer.fill_child_profile_id() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.profile_id is null then
    select id into new.profile_id from snoozer.profiles where owner_id = new.owner_id;
  end if;
  return new;
end
$$;
revoke execute on function snoozer.fill_child_profile_id() from public, anon, authenticated, service_role;

do $$
declare child text;
begin
  foreach child in array array[
    'links', 'sections', 'gallery_items', 'media_folders',
    'published_profiles', 'published_links', 'published_sections', 'published_gallery'
  ]
  loop
    execute format('alter table snoozer.%I add column profile_id uuid', child);
    execute format('update snoozer.%I c set profile_id = p.id from snoozer.profiles p where p.owner_id = c.owner_id', child);
    execute format('alter table snoozer.%I alter column profile_id set not null', child);
    execute format('alter table snoozer.%I add foreign key (owner_id, profile_id) references snoozer.profiles(owner_id, id) on delete cascade', child);
    execute format('create trigger fill_profile_id before insert on snoozer.%I for each row execute function snoozer.fill_child_profile_id()', child);
  end loop;
end
$$;

alter table snoozer.published_profiles add unique (profile_id, revision);
create unique index published_links_profile_position on snoozer.published_links(profile_id, revision, position);
create unique index published_sections_profile_position on snoozer.published_sections(profile_id, revision, position);
create unique index published_gallery_profile_position on snoozer.published_gallery(profile_id, revision, position);
alter table snoozer.profiles add constraint active_publication_identity
  foreign key (id, published_revision) references snoozer.published_profiles(profile_id, revision);
alter table snoozer.published_links add foreign key (profile_id, revision)
  references snoozer.published_profiles(profile_id, revision) on delete cascade;
alter table snoozer.published_sections add foreign key (profile_id, revision)
  references snoozer.published_profiles(profile_id, revision) on delete cascade;
alter table snoozer.published_gallery add foreign key (profile_id, revision)
  references snoozer.published_profiles(profile_id, revision) on delete cascade;
