-- Keep the self-service first-party archive aligned with the new profile and consent fields.
create or replace function public.my_extended_account_archive() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := snoozer.privacy_actor();
begin
  return jsonb_build_object(
    'schema_version', 1,
    'scope', 'first-party-app-records',
    'profiles', coalesce((select jsonb_agg(to_jsonb(p)) from (
      select id, studio_uid, username, username_changed_at, display_name, bio, theme, indexable,
        avatar, revision, published_revision, created_at, updated_at, appearance,
        seo_title, seo_description, media_scope
      from snoozer.profiles where owner_id = actor order by id
    ) p), '[]'::jsonb),
    'profile_aliases', coalesce((select jsonb_agg(to_jsonb(a)) from (
      select name, profile_id, created_at, expires_at, retired_at, is_username_redirect
      from snoozer.profile_aliases where owner_id = actor order by created_at, name
    ) a), '[]'::jsonb),
    'marketing_preferences', coalesce((select jsonb_build_object(
      'email_opt_in', email_opt_in, 'consent_updated_at', consent_updated_at
    ) from snoozer.account_marketing_preferences where owner_id = actor),
      jsonb_build_object('email_opt_in', false, 'consent_updated_at', null)),
    'profile_links', coalesce((select jsonb_agg(to_jsonb(l)) from (
      select profile_id, position, label, url from snoozer.links where owner_id = actor order by profile_id, position
    ) l), '[]'::jsonb),
    'gallery_metadata', coalesce((select jsonb_agg(to_jsonb(g)) from (
      select id, profile_id, alt, position, variant, width, height, created_at, folder_id, blocked_at
      from snoozer.gallery_items where owner_id = actor order by profile_id, id
    ) g), '[]'::jsonb),
    'media_folders', coalesce((select jsonb_agg(to_jsonb(f)) from (
      select id, profile_id, name from snoozer.media_folders where owner_id = actor order by profile_id, id
    ) f), '[]'::jsonb),
    'entitlement_grants', coalesce((select jsonb_agg(to_jsonb(e)) from (
      select id, plan, plan_version, source, starts_at, expires_at, revoked_at, payment_held
      from snoozer.entitlement_grants where owner_id = actor order by starts_at, id
    ) e), '[]'::jsonb),
    'premium_live_checkout_metadata', coalesce((select jsonb_agg(to_jsonb(c)) from (
      select id, price_id, session_id, subscription_id, status, created_at, expires_at,
        reconciliation_revision, last_invoice, last_status, last_checked_at
      from snoozer.premium_live_checkouts where owner_id = actor order by created_at, id
    ) c), '[]'::jsonb),
    'premium_live_customer_reference', coalesce((select jsonb_agg(to_jsonb(c)) from (
      select customer_id, created_at from snoozer.premium_live_customers where owner_id = actor
    ) c), '[]'::jsonb),
    'account_restrictions', coalesce((select jsonb_agg(to_jsonb(r)) from (
      select id, kind, reason, created_at, ends_at, revoked_at
      from snoozer.account_restrictions where user_id = actor order by created_at, id
    ) r), '[]'::jsonb),
    'moderation_appeals', coalesce((select jsonb_agg(to_jsonb(a)) from (
      select id, case_id, reason, status, response, created_at, reviewed_at
      from snoozer.moderation_appeals where user_id = actor order by created_at, id
    ) a), '[]'::jsonb),
    'privacy_requests', coalesce((select jsonb_agg(to_jsonb(r)) from (
      select id, kind, status, requested_at, reviewed_at, owner_response
      from snoozer.privacy_requests where user_id = actor order by requested_at, id
    ) r), '[]'::jsonb),
    'account_notifications', coalesce((select jsonb_agg(to_jsonb(n)) from (
      select id, kind, title, body, created_at, read_at
      from snoozer.account_notifications where user_id = actor order by created_at, id
    ) n), '[]'::jsonb)
  );
end $$;
revoke all on function public.my_extended_account_archive() from public, anon, authenticated, service_role;
grant execute on function public.my_extended_account_archive() to authenticated;
