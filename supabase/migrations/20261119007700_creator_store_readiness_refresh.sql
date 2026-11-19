begin;
create function public.get_creator_store_check_target(p_name text,p_version uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('ownerId',m.owner_id,'merchant',public.get_creator_sandbox_merchant(m.owner_id))
 from snoozer.profiles p join snoozer.creator_sandbox_accounts m on m.owner_id=p.owner_id
 join snoozer.creator_sandbox_policy policy on policy.enabled and policy.platform_id=m.platform_id
 where num_nonnulls(p_name,p_version)=1 and m.account_id is not null
  and public.get_published_profile(p.username::text) is not null
  and exists(select 1 from snoozer.product_drafts d join snoozer.creator_sandbox_offers o on o.product_id=d.id and o.owner_id=p.owner_id
   join snoozer.product_versions v on v.id=o.version_id and v.product_id=d.id and v.sha256=o.reviewed_sha256
   join snoozer.product_files f on f.id=v.file_id and f.product_id=d.id and f.state='ready' and f.bytes=v.bytes
   where d.profile_id=p.id and d.owner_id=p.owner_id and not d.archived and o.enabled and o.review_expires_at>now()
    and ((p_name is not null and p.username::text=p_name) or (p_version is not null and v.id=p_version)))
$$;
revoke execute on function public.get_creator_store_check_target(text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.get_creator_store_check_target(text,uuid) to service_role;
commit;
