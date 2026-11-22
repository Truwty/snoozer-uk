-- Owner-only read-only fulfilment preflight for verified privacy requests.
-- This does NOT perform automatic erasure, cancellation or data disclosure.
create or replace function public.owner_privacy_preflight(p_request uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid := snoozer.admin_actor(); target uuid; kind text; state text;
begin
 select r.user_id,r.kind,r.status into target,kind,state
 from snoozer.privacy_requests r where r.id=p_request;
 if target is null then return null; end if;
 return jsonb_build_object(
  'request_id',p_request,'user_id',target,'kind',kind,'status',state,
  'verified_email',exists(select 1 from auth.users u where u.id=target and u.email_confirmed_at is not null),
  'profile_count',(select count(*) from snoozer.profiles p where p.owner_id=target),
  'gallery_metadata_count',(select count(*) from snoozer.gallery_items g where g.owner_id=target),
  'media_folder_count',(select count(*) from snoozer.media_folders f where f.owner_id=target),
  'has_avatar_media',exists(select 1 from snoozer.profiles p where p.owner_id=target and p.avatar is not null),
  'has_stripe_customer',exists(select 1 from snoozer.premium_live_customers c where c.owner_id=target),
  'live_checkout_records',(select count(*) from snoozer.premium_live_checkouts c where c.owner_id=target),
  'has_subscription_references',exists(select 1 from snoozer.premium_live_checkouts c
      where c.owner_id=target and c.subscription_id is not null),
  'has_retained_billing_evidence',exists(select 1 from snoozer.premium_live_checkouts c where c.owner_id=target),
  'active_grants',(select count(*) from snoozer.entitlement_grants e where e.owner_id=target
      and e.revoked_at is null and (e.expires_at is null or e.expires_at>now())),
  'appeal_count',(select count(*) from snoozer.moderation_appeals a where a.user_id=target)
 );
end $$;
revoke all on function public.owner_privacy_preflight(uuid) from public,anon,authenticated,service_role;
grant execute on function public.owner_privacy_preflight(uuid) to authenticated;
