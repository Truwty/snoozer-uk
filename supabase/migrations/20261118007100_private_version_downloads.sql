begin;
create function public.get_my_product_version_file(p_version uuid) returns jsonb language sql stable security definer set search_path='' as $$
 with actor as materialized(select snoozer.verified_user() as id)
 select jsonb_build_object('versionId',v.id,'sha256',v.sha256,'productId',d.id,'id',f.id,'scope',f.media_scope,'bytes',v.bytes,'state',f.state)
 from actor join snoozer.product_drafts d on d.owner_id=actor.id join snoozer.product_versions v on v.product_id=d.id
 join snoozer.product_files f on f.id=v.file_id and f.product_id=d.id and f.bytes=v.bytes and f.state='ready'
 join snoozer.profiles p on p.id=d.profile_id and p.owner_id=actor.id and p.media_scope=f.media_scope
 where v.id=p_version
$$;
revoke execute on function public.get_my_product_version_file(uuid) from public,anon,authenticated,service_role;
grant execute on function public.get_my_product_version_file(uuid) to authenticated;
commit;
