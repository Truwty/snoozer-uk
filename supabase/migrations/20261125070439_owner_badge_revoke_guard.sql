-- Final guard: automatic milestones cannot be revoked by a manual Owner action.
begin;
create or replace function public.owner_revoke_profile_badge(p_badge uuid,p_reason text) returns boolean
language plpgsql security definer set search_path='' as $$
declare actor uuid:=snoozer.admin_actor(true); target uuid; slug text;
begin
 if length(btrim(coalesce(p_reason,''))) not between 8 and 500 then
   raise exception 'Reason required' using errcode='22023';
 end if;
 update snoozer.profile_badges
 set revoked_at=now()
 where id=p_badge and revoked_at is null and source='owner'
 returning profile_id,profile_badges.slug into target,slug;
 if target is null then return false; end if;
 insert into snoozer.admin_audit_events(actor_id,target_id,action,reason,details)
 select actor,p.owner_id,'badge.revoke',btrim(p_reason),
   jsonb_build_object('profile_id',target,'slug',slug,'badge_id',p_badge)
 from snoozer.profiles p where p.id=target;
 return true;
end $$;
revoke all on function public.owner_revoke_profile_badge(uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.owner_revoke_profile_badge(uuid,text) to authenticated;
commit;
