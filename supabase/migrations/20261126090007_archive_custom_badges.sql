begin;
alter function public.my_extended_account_archive() rename to my_extended_account_archive_pre_custom_badges;
create function public.my_extended_account_archive() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare actor uuid:=snoozer.privacy_actor();
begin
 return public.my_extended_account_archive_pre_custom_badges() || jsonb_build_object(
   'custom_profile_badges',coalesce((select jsonb_agg(jsonb_build_object('profile_id',profile_id,'id',id,'title',title,
     'description',description,'icon',icon,'color',color,'image_id',image_id,'is_public',is_public,'display_order',display_order,
     'created_at',created_at,'updated_at',updated_at) order by profile_id,display_order,id)
     from snoozer.custom_profile_badges where owner_id=actor),'[]'::jsonb));
end $$;
revoke all on function public.my_extended_account_archive_pre_custom_badges() from public,anon,authenticated,service_role;
revoke all on function public.my_extended_account_archive() from public,anon,authenticated,service_role;
grant execute on function public.my_extended_account_archive() to authenticated;
commit;
