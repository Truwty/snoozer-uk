# Creator storefront analytics — sandbox only

This Phase 5 §13.12 slice is a **private, read-only** seller report. It reuses retained `snoozer.creator_sandbox_orders` and their immutable `product_versions` prices; it does not query Stripe for revenue or introduce another Checkout path.

## Access and behaviour

- Sign in with an email-confirmed account that owns a Snoozer profile. Open **Studio → Product drafts → View private sandbox storefront analytics**. The route is `/studio/products/analytics?profile=<owned-profile-uuid>`, excluded from search indexing.
- The database function `public.read_my_creator_storefront_analytics(p_profile uuid)` runs with an empty search path and checks `snoozer.verified_user()` against the requested profile's `owner_id`. It grants execute only to `authenticated` and rejects unauthorised, anonymous and unverified attempts. No buyer IDs, email addresses, payment IDs or receipt data are exposed.
- Aggregates: all **currently retained** attempts broken down into pending, expired and paid; paid orders with sticky risk holds; paid/unheld orders with unexpired download windows; and the gross GBP amount of paid test orders.
- The fourteen-day table is aligned to **UTC creation date**, counting orders that are now marked paid on their original creation date. It is not a time-series of funds settlement. Days with no activity display zero.
- `grossTestPence` includes paid orders with refunds or disputes, and intentionally cannot be called net earnings, payout, revenue, tax evidence or live sales. Do not base withdrawals, payouts, entitlements or refunds on this report. The existing 90-day retention policy may remove older records, and unsettled pending/held records may persist longer.
- No buyer identity data is returned. Empty accounts show zero metrics and an explicit empty state. Database or provider failures show an unavailable message without changing any commerce state.
- Every owner can see their **own** sandbox data without an upgraded subscription, subject to the existing verified-account and profile ownership checks. No public-facing analytics endpoint or IP/device tracking was added.

## Release and verified evidence

[PR #14](https://github.com/Truwty/snoozer-uk/pull/14) merged as `9bdac81`, with [full CI #212](https://github.com/Truwty/snoozer-uk/actions/runs/44862797211) passing all gates. Hosted Supabase migration `20261121034500_creator_storefront_analytics` is installed and tracked; prior leaderboard migration history `20261120008000` was reconciled without DDL replay. Function grants: authenticated=true; anon=false; service_role=false. Render manual deploy `dep-dc0ha9d9el5s73e4i590` confirmed **Live** at 2026-11-21 03:52:31 UTC. Original order and receipt counts unchanged. Real owner-browser sign-in on the hosted production-domain page has **not** been separately observed. This report does not verify external provider risk events or live payouts.

## Release checks

1. Run `npm run lint && npm run typecheck && npm test && npm run build`.
2. Run disposable Supabase migrations and `npm run test:e2e -- --workers=2`. SQL tests validate anonymous/unverified/foreign-profile denial, safe empty results, pending/paid/held transitions, daily UTC counts and no buyer/payment identity leakage. Browser journey validates the verified profile owner sees zero report and navigates back to Products.
3. Verify the historical migration discrepancy: the already-installed `20261120008000_views_leaderboard.sql` was **reconciled to hosted migration history without rerunning DDL**, after verifying its table, indexes, RPC, trigger and reserved name. Do not replay the installed SQL.
4. The new `20261121034500_creator_storefront_analytics.sql` was successfully applied through Supabase's migration action and **is now tracked by hosted migration history**. A temporary draft used a different filename; source now matches hosted version to avoid a second execution. Verify grants and record current backup/recovery status before future schema changes. The migration adds only one bounded read-only RPC and execute grants; no table/row/payment mutation. Never apply it twice as a workaround for missing history.
5. Deploy the matching tested Render commit, verify the page for a verified profile owner, confirm `anon` and a foreign owner cannot invoke the RPC, and check the original £5 test purchase and webhook receipts remain unchanged. Keep both new-purchase gates as they were.
6. Record actual SQL migration version, CI, Render deploy SHA and live owner-browser checks in PROGRESS/CONTINUE. **Do not claim Phase 5 complete**; the separate actual buyer/risk-event exit checks remain mandatory.

This report depends only on the database's currently retained, already-verified state. It cannot prove real provider refunds, disputes, early fraud events or failed-receipt retries.
