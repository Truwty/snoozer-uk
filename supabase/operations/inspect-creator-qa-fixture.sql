-- Read-only review checklist for ONE new, harmless frozen creator QA PDF.
-- SQL Editor as trusted operator; replace only the all-zero version UUID after
-- uploading, finalizing and freezing a NEW isolated fixture in Snoozer Studio.
-- Default is deliberately inert; zero rows means "no candidate", not approval.
-- Do NOT use the version belonging to the original paid £5 purchase.
-- This query makes NO database/storage/payment changes and DOES NOT inspect the
-- actual PDF content. The human operator must open the exact frozen PDF locally,
-- inspect it, and independently compare SHA-256 before invoking the existing
-- service-only review_creator_sandbox_fixture(owner,version,sha) RPC.
with target as (
  select '00000000-0000-0000-0000-000000000000'::uuid as version_id
)
select
  v.id as version_id,
  d.owner_id as creator_owner_id,
  v.sha256 as frozen_sha256,
  v.bytes as frozen_bytes,
  v.amount as price_in_pence,
  v.currency,
  d.archived as draft_archived,
  f.state='ready' and f.bytes=v.bytes as ready_file_matches_snapshot,
  m.account_id is not null and m.platform_id=policy.platform_id as seller_platform_bound,
  m.ready and m.checked_at>now()-interval '5 minutes' as recent_seller_readiness,
  coalesce(o.version_id=v.id and o.reviewed_sha256=v.sha256
    and o.review_expires_at>now(),false) as approval_still_current,
  coalesce(o.enabled,false) as published_test_offer,
  coalesce(o.review_expires_at, '-infinity'::timestamptz) as review_expiry,
  policy.enabled as new_checkout_policy_enabled,
  exists (
    select 1 from snoozer.creator_sandbox_orders ord
    where ord.version_id=v.id
  ) as version_already_has_orders
from target
join snoozer.product_versions v on v.id=target.version_id
join snoozer.product_drafts d on d.id=v.product_id and d.owner_id is not null
join snoozer.product_files f on f.id=v.file_id and f.product_id=d.id
join snoozer.creator_sandbox_accounts m on m.owner_id=d.owner_id
join snoozer.creator_sandbox_policy policy on policy.singleton=true
left join snoozer.creator_sandbox_offers o on o.product_id=d.id;
