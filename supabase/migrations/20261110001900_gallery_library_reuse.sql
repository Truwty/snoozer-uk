-- Reuse a retained image by attaching its existing row to the draft order.
create function public.add_library_image_to_gallery(p_expected integer, p_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare actor uuid := snoozer.verified_user();
declare last_position integer;
begin
  perform 1 from snoozer.profiles where owner_id = actor and revision = p_expected for update;
  if not found then return 'changed'; end if;

  if not exists (select 1 from snoozer.gallery_library_items(actor) g where g.id = p_id and g.position is null)
    then return 'unavailable'; end if;

  select coalesce(max(position), 0) into last_position from snoozer.gallery_items where owner_id = actor;
  if last_position >= 8 then return 'limit'; end if;

  update snoozer.gallery_items set position = last_position + 1 where owner_id = actor and id = p_id;
  update snoozer.profiles set revision = revision + 1, updated_at = now() where owner_id = actor;
  return 'added';
end $$;

revoke execute on function public.add_library_image_to_gallery(integer,uuid) from public, anon, authenticated, service_role;
grant execute on function public.add_library_image_to_gallery(integer,uuid) to authenticated;
