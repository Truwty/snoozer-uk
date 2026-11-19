begin;
create function public.get_creator_sandbox_merchant(p_owner uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',m.id,'platformId',m.platform_id,'accountId',m.account_id,'country',m.country,
  'createdAt',m.created_at,'ready',m.ready,'checkedAt',m.checked_at) from snoozer.creator_sandbox_accounts m where owner_id=p_owner
$$;
create function public.list_my_creator_sandbox_offers(p_profile uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=snoozer.verified_user();
begin
 if not exists(select 1 from snoozer.profiles where id=p_profile and owner_id=actor) then raise exception 'Profile not owned' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('versionId',o.version_id,'enabled',o.enabled,'reviewExpiresAt',o.review_expires_at) order by o.version_id)
  from snoozer.creator_sandbox_offers o join snoozer.product_drafts d on d.id=o.product_id where d.profile_id=p_profile and o.owner_id=actor),'[]'::jsonb);
end $$;
create function public.get_creator_sandbox_store(p_name text) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('username',p.username,'displayName',public.get_published_profile(p.username::text)->>'display_name',
  'items',coalesce((select jsonb_agg(jsonb_build_object('versionId',v.id,'title',v.title,'description',v.description,'amount',v.amount,'currency',v.currency,'bytes',v.bytes) order by v.created_at,v.id)
   from snoozer.product_drafts d join snoozer.creator_sandbox_offers o on o.product_id=d.id and o.owner_id=p.owner_id
   join snoozer.product_versions v on v.id=o.version_id and v.product_id=d.id and v.sha256=o.reviewed_sha256
   join snoozer.product_files f on f.id=v.file_id and f.product_id=d.id and f.state='ready' and f.bytes=v.bytes
   where d.profile_id=p.id and d.owner_id=p.owner_id and not d.archived and o.enabled and o.review_expires_at>now()),'[]'::jsonb))
 from snoozer.profiles p join snoozer.creator_sandbox_accounts m on m.owner_id=p.owner_id
 join snoozer.creator_sandbox_policy policy on policy.enabled and policy.platform_id=m.platform_id
 where p.username::text=p_name and public.get_published_profile(p.username::text) is not null
  and m.account_id is not null and m.ready and m.checked_at>now()-interval '5 minutes'
$$;
revoke execute on function public.get_creator_sandbox_merchant(uuid),public.list_my_creator_sandbox_offers(uuid),public.get_creator_sandbox_store(text) from public,anon,authenticated,service_role;
grant execute on function public.get_creator_sandbox_merchant(uuid) to service_role;
grant execute on function public.list_my_creator_sandbox_offers(uuid) to authenticated;
grant execute on function public.get_creator_sandbox_store(text) to anon,authenticated;
commit;
