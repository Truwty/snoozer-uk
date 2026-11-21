# Development continuation — Snoozer.uk

## Product direction (binding, 21 November 2026)
Snoozer is a link-in-bio/profile platform. **Only Snoozer itself may sell Premium Plus, Pro and Studio subscriptions.** There is no third-party marketplace, seller onboarding, PDFs for sale, creator memberships, merchant tips, connected-account Checkout, or digital-product storefront. Do not rebuild those functions even if older git history/old specifications mention them.

## Exact current state
- Main verified Stripe LIVE merchant: `acct_1UdI9LBYH85ysT1B`.
- Three LIVE Stripe Products created: Plus `prod_VfgMlUsOz4GELl`, Pro `prod_VfgMPjnzui1zGl`, Studio `prod_VfgMvCX05yAJSj`. **No commercial prices approved/created; no genuine live payment accepted.**
- Stripe live Billing Portal `bpc_1UeKY2BYH85ysT1BioyXeK9C` configured; webhook `we_1UeKYyBYH85ysT1BSqAlpvsk` is DISABLED and its separate signing secret is stored on Render.
- Premium code from merged PR #28 runs on Render (commit `f03e231186ba6e16c339833b3bbb8f3121f4cb5d`). CI #44946031912 passed; hosted additive Premium database schema installed with RLS/private RPC checks. LIVE Checkout OFF; requires a restricted live API key, prices, provider test and legal review before activation.
- Owner explicitly deferred Stripe Tax configuration. Checkout code uses `automatic_tax.enabled=false` on PR #29 branch; independent merchant tax obligations remain. Tax approval should NOT be silently fabricated or manually marked complete.
- Seller marketplace source/UI/API/routes removed on branch `remove-creator-marketplace-entirely-20261121` / [PR #29](https://github.com/Truwty/snoozer-uk/pull/29). Historic creator SQL migrations and test payment records remain as audit evidence. New retirement migration permanently freezes policies and revokes legacy exposed functions; verify CI and apply carefully before final deployment.
- GitHub main branch is currently source of truth for deployed code; do not assume pending PR changes are live.

## What to work on next
1. Finish PR #29: CI lint, tsc, tests, disposable migration, build, Playwright; fix regressions; apply reviewed retirement migration to hosted Supabase, verify all creator services inaccessible, merge PR, deploy exact commit on Render.
2. Confirm with owner **exact** GBP live monthly and yearly prices for Plus, Pro and Studio. The old £3.99 QA sandbox Plus fixture is not an approved commercial price. Avoid guessing.
3. Have owner create and securely install scoped LIVE key in Render. Verify live subscription Checkout only after price and legal/provider tests; never expose secret or create an actual charge on behalf of an unwitting customer.
4. Run `npm run billing:live:preflight`, validate signed webhooks, protected entitlement grants, cancellation, renewal, failure, refunds, disputes and customer support flows; review live emails, backup/restore, and auth security advisor warnings.
5. Preserve historical paid test orders/receipts and Git migration history; do not drop financial records or shut a connected Stripe account without separate review.

## Operations
Render service `srv-dbts6jon74is73en2rjg` in workspace `tea-d7omjhu7r5hc73dh1fd0`; Supabase project `edgptbiwswcdmmxzwhxv`; GitHub `Truwty/snoozer-uk`. Run `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e -- --workers=2`, and `npm run billing:live:preflight`.

See `docs/premium-live-launch.md` for exact requirements. Historical development checkpoints are in Git commits before PR #29 rather than active roadmap files.
