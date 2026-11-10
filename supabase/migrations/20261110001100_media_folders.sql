-- Folder metadata is private and has its own revision, independent of the public gallery.
alter table snoozer.profiles add column media_folder_revision integer not null default 0;

create table snoozer.media_folders (
  owner_id uuid not null references snoozer.profiles(owner_id) on delete cascade,
  id uuid not null default gen_random_uuid(),
  name text not null check (name = btrim(name) and char_length(name) between 1 and 60
    and name ~ '[^[:space:]]' and name !~ '[[:cntrl:]]' and lower(name) <> 'unfiled'),
  primary key (owner_id, id)
);
create unique index media_folder_names on snoozer.media_folders(owner_id, lower(name));
alter table snoozer.media_folders enable row level security;

alter table snoozer.gallery_items add column folder_id uuid,
  add foreign key (owner_id, folder_id) references snoozer.media_folders(owner_id, id)
    deferrable initially deferred;
create index gallery_folder_members on snoozer.gallery_items(owner_id, folder_id) where folder_id is not null;

-- Keep library visibility aligned with the existing owner image route.
create function snoozer.gallery_library_items(p_owner uuid) returns setof snoozer.gallery_items
language sql stable set search_path = '' as $$
  select g.* from snoozer.gallery_items g
  where g.owner_id = p_owner and g.variant is not null and g.blocked_at is null
    and (g.position is not null or exists (
      select 1 from snoozer.published_gallery s where s.owner_id = p_owner and s.item = g.id
    ))
$$;

create function public.get_media_folders() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('scope', p.media_scope, 'revision', p.media_folder_revision,
    'folders', coalesce((
      select jsonb_agg(jsonb_build_object('id', f.id, 'name', f.name) order by lower(f.name), f.id)
      from snoozer.media_folders f where f.owner_id = p.owner_id
    ), '[]'::jsonb),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object('id', g.id, 'alt', g.alt, 'width', g.width,
        'height', g.height, 'folder', g.folder_id, 'in_draft', g.position is not null)
        order by g.created_at desc, g.id)
      from snoozer.gallery_library_items(p.owner_id) g
    ), '[]'::jsonb))
  from snoozer.profiles p where p.owner_id = snoozer.verified_user()
$$;

create function public.edit_media_folders(p_scope uuid, p_expected integer, p_operation text,
  p_id uuid default null, p_name text default null, p_folder uuid default null) returns text
language plpgsql security definer set search_path = '' as $$
declare actor uuid := snoozer.verified_user();
declare folder_name text := btrim(p_name);
declare previous_folder uuid;
begin
  perform 1 from snoozer.profiles where owner_id = actor and media_scope = p_scope
    and media_folder_revision = p_expected for update;
  if not found then return 'changed'; end if;

  if p_operation in ('create', 'rename') then
    if folder_name is null or char_length(folder_name) not between 1 and 60
      or folder_name !~ '[^[:space:]]' or folder_name ~ '[[:cntrl:]]' or lower(folder_name) = 'unfiled'
      then return 'invalid_name'; end if;
    if exists (select 1 from snoozer.media_folders where owner_id = actor
      and lower(name) = lower(folder_name) and (p_operation = 'create' or id is distinct from p_id))
      then return 'duplicate'; end if;
  end if;

  case p_operation
    when 'create' then
      if (select count(*) from snoozer.media_folders where owner_id = actor) >= 12 then return 'limit'; end if;
      insert into snoozer.media_folders(owner_id, name) values (actor, folder_name);
    when 'rename' then
      update snoozer.media_folders set name = folder_name where owner_id = actor and id = p_id;
      if not found then return 'not_found'; end if;
    when 'delete' then
      update snoozer.gallery_items set folder_id = null where owner_id = actor and folder_id = p_id;
      delete from snoozer.media_folders where owner_id = actor and id = p_id;
      if not found then return 'not_found'; end if;
    when 'move' then
      if p_folder is not null and not exists (
        select 1 from snoozer.media_folders where owner_id = actor and id = p_folder
      ) then return 'not_found'; end if;
      select g.folder_id into previous_folder from snoozer.gallery_library_items(actor) g where g.id = p_id;
      if not found then return 'not_found'; end if;
      if previous_folder is not distinct from p_folder then return 'saved'; end if;
      update snoozer.gallery_items set folder_id = p_folder where owner_id = actor and id = p_id;
    else
      return 'invalid_operation';
  end case;
  update snoozer.profiles set media_folder_revision = media_folder_revision + 1 where owner_id = actor;
  return 'saved';
end $$;

revoke execute on function snoozer.gallery_library_items(uuid) from public, anon, authenticated, service_role;
revoke execute on function public.get_media_folders(), public.edit_media_folders(uuid,integer,text,uuid,text,uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_media_folders(), public.edit_media_folders(uuid,integer,text,uuid,text,uuid)
  to authenticated;
