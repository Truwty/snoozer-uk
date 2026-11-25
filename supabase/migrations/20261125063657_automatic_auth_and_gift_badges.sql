-- Reconcile the account-security and gift milestones; award on click-count changes.
begin;
update snoozer.badge_catalog set award_mode='automatic',criterion_key='two_factor',enabled=true where slug='two-factor';
update snoozer.badge_catalog set award_mode='automatic',criterion_key='google_connected',enabled=true where slug='google-connected';
update snoozer.badge_catalog set award_mode='automatic',criterion_key='gift_claimed',enabled=true where slug='gifted-premium';
CREATE OR REPLACE FUNCTION snoozer.award_profile_milestones(p_profile uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare p snoozer.profiles; link_count integer; section_count integer; gallery_count integer; view_count bigint; click_count bigint;
begin
 select * into p from snoozer.profiles where id=p_profile; if not found then return; end if;
 select count(*) into link_count from snoozer.links where profile_id=p.id and hidden=false;
 select count(*) into section_count from snoozer.sections where profile_id=p.id and hidden=false;
 select count(*) into gallery_count from snoozer.gallery_items where profile_id=p.id and position is not null and blocked_at is null;
 select coalesce((select total_views from snoozer.profile_view_leaderboard where profile_id=p.id),0) into view_count;
 select coalesce(sum(clicks),0) into click_count from snoozer.profile_view_days where profile_id=p.id;
 insert into snoozer.profile_badges(profile_id,slug,name,description,icon,category,rarity,source)
 select p.id,b.slug,b.name,b.description,b.icon,b.category,b.rarity,'automatic'
 from snoozer.badge_catalog b where b.enabled and b.award_mode='automatic'
 and case b.criterion_key
  when 'profile_claimed' then true
  when 'profile_published' then p.published_revision is not null
  when 'bio_added' then char_length(btrim(p.bio))>=20
  when 'avatar_set' then p.avatar is not null
  when 'links_1' then link_count>=1
  when 'links_5' then link_count>=5
  when 'links_10' then link_count>=10
  when 'section_1' then section_count>=1
  when 'sections_3' then section_count>=3
  when 'gallery_1' then gallery_count>=1
  when 'gallery_5' then gallery_count>=5
  when 'views_100' then view_count>=100
  when 'views_500' then view_count>=500
  when 'views_1000' then view_count>=1000
  when 'views_10000' then view_count>=10000
  when 'views_50000' then view_count>=50000
  when 'views_100000' then view_count>=100000
  when 'views_500000' then view_count>=500000
  when 'views_1000000' then view_count>=1000000
  when 'clicks_100' then click_count>=100
  when 'discovery_enabled' then exists(select 1 from snoozer.profile_discovery_settings d where d.profile_id=p.id and d.directory_enabled)
  when 'custom_domain' then snoozer.ready_profile_domain(p.id) is not null
  when 'discord_presence' then exists(select 1 from snoozer.discord_presence_settings d where d.profile_id=p.id and d.enabled)
  when 'widget_enabled' then coalesce(p.widgets->'guestbook'->>'enabled','false')='true'
   or coalesce(p.widgets->'poll'->>'enabled','false')='true' or coalesce(p.widgets->'faq'->>'enabled','false')='true'
  when 'block_added' then jsonb_array_length(p.blocks)>0
  when 'appearance_custom' then p.appearance is not null and p.appearance<>'{}'::jsonb
  when 'active_7_days' then p.created_at<=now()-interval '7 days'
  when 'active_30_days' then p.created_at<=now()-interval '30 days'
  when 'active_90_days' then p.created_at<=now()-interval '90 days'
  when 'google_connected' then exists(select 1 from auth.identities i where i.user_id=p.owner_id and i.provider='google')
  when 'two_factor' then exists(select 1 from auth.mfa_factors f where f.user_id=p.owner_id and f.factor_type::text='totp' and f.status::text='verified')
  when 'gift_claimed' then exists(select 1 from snoozer.entitlement_grants g where g.owner_id=p.owner_id and g.source='gift' and g.revoked_at is null)
  else false end
 on conflict(profile_id,slug) do nothing;
end $function$;
CREATE OR REPLACE FUNCTION public.refresh_my_profile_badges()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare actor uuid:=snoozer.verified_user(); item record; total integer:=0;
begin
 for item in select id from snoozer.profiles where owner_id=actor loop
  perform snoozer.award_profile_milestones(item.id); total:=total+1;
 end loop;
 return total;
end $function$;
create trigger badges_clicks_refresh after insert or update of clicks on snoozer.profile_view_days
 for each row execute function snoozer.refresh_profile_badges_trigger();
revoke all on function snoozer.award_profile_milestones(uuid) from public,anon,authenticated,service_role;

revoke all on function public.refresh_my_profile_badges() from public,anon,authenticated,service_role;
grant execute on function public.refresh_my_profile_badges() to authenticated;
do $$ declare item record; begin for item in select id from snoozer.profiles loop perform snoozer.award_profile_milestones(item.id); end loop; end $$;
commit;