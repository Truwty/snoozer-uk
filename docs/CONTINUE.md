# Development continuation — Snoozer.uk

## Approved LIVE Premium prices — 21 November 2026

**COMPLETE:** Owner approved and I created six recurring GBP Prices on the main verified Snoozer LIVE Stripe account, and inserted all six matching Price IDs into hosted `snoozer.premium_live_prices`. Stripe GetPrices verified exactly six active LIVE Prices with the correct products, cadence and amounts; hosted `premium_live_preflight()` verified `approvedOffers=6` across Plus/Pro/Studio. The Product default Price is monthly for each plan.

| Tier | Monthly | Monthly Stripe ID | Annual | Annual Stripe ID |
| --- | ---: | --- | ---: | --- |
| Plus | £3 | `price_1UeLyLBYH85ysT1BICf5EPJr` | £30 | `price_1UeLyYBYH85ysT1BEz7ehZP4` |
| Pro | £6 | `price_1UeLycBYH85ysT1BqE6guCme` | £60 | `price_1UeLyfBYH85ysT1BABUEkalJ` |
| Studio | £12 | `price_1UeLyjBYH85ysT1Bg7JnkUTg` | £100 | `price_1UeLypBYH85ysT1BnlVlQOVH` |

**Charges have NOT been enabled or proven.** The database remains `checkoutEnabled=false`, `legalReviewed=false`, `currentSubscriptions=0`, `customers=0`, `unprocessedReceipts=0`. Stripe LIVE webhook remains disabled; a server-side LIVE restricted API key and genuine provider acceptance test are still outstanding. Stripe Tax remains intentionally deferred but liability is not waived. Exact activation handoff is in `docs/premium-live-launch.md`.


## Release verification — creator marketplace removed (21 November 2026)

**COMPLETE:** [PR #29](https://github.com/Truwty/snoozer-uk/pull/29) merged into `main` as [commit `55b9564`](https://github.com/Truwty/snoozer-uk/commit/55b9564533a6192d985c6dbda3a65e46704112fa). [CI #44949745031](https://github.com/Truwty/snoozer-uk/actions/runs/44949745031) passed secret audit, dependency audit, lint, TypeScript, unit tests, disposable Supabase migration, build and Playwright. Render deploy `dep-dc10h8qjnfac73fa24tg` confirmed **Live** 21 November 2026 at 21:11:50 UTC, exact merged commit; post-deploy ERROR logs checked for the period beginning 21:10 UTC found zero entries. An external direct HTTP smoke fetch could not be verified through the web tool, so do not represent it as independently performed.

**Only Snoozer Premium is sold.** 157 creator-marketplace source, test, UI and documentation files removed plus shared-path cleanup, and all `/store/*`, `/studio/products/*`, `/studio/memberships/*`, `/studio/donations/*`, `/studio/purchases/*`, `/studio/support/*`, `/studio/product-reports/*`, `/api/v1/commerce/*` paths now 404 under the site proxy. GitHub main tree audit found zero marketplace application files; historical SQL migrations intentionally remain.

Supabase retirement migration `20261121205733_retire_creator_marketplace_and_optional_tax` applied successfully. Four SQL CHECK constraints permanently require retired creator policy/offers/Ko-fi hooks `enabled=false`; marketplace RPC EXECUTE revoked from anon, authenticated and service_role. Confirmed old one paid £5 **SANDBOX** order preserved, and private PDF Storage bucket has no direct access policies. Nine creator-specific Render env keys cleared/forced false; three sandbox creator webhook destinations remain disabled. No historical payment/financial records deleted.

**LIVE Stripe products created on the VERIFIED MAIN Snoozer account**: Plus `prod_VfgMlUsOz4GELl`; Pro `prod_VfgMPjnzui1zGl`; Studio `prod_VfgMvCX05yAJSj`. Verified active live-mode and owned by Snoozer. Live Stripe Price count **6**, live subscriptions **0** and hosted Premium prices **6**; no actual LIVE payment was processed or proven. Live Checkout remains disabled by server+database launch gates. Stripe Tax was intentionally omitted at owner request: `automatic_tax.enabled=false`, removed tax-specific gating but **merchant tax obligations remain**. Live Billing Portal active, live signed webhook destination configured but disabled; restricted LIVE API key not installed/verified. Legal approval remains unconfirmed.

**Exact next blockers for working LIVE payments:** (1) Owner securely creates/installs a restricted LIVE Stripe key as `STRIPE_PREMIUM_LIVE_API_KEY` in Render; (2) completes seller/legal/consumer terms review; (3) verifies signed LIVE Stripe webhook and end-to-end subscription Checkout, renewal/failure/cancellation/refund/entitlement lifecycle; (4) enables live gate only after successful acceptance. Six prices are already approved and bound. Do not enable webhook or charging flags until verified. Read `docs/premium-live-launch.md` for exact steps.


## Product direction (binding, 21 November 2026)
Snoozer is a link-in-bio/profile platform. **Only Snoozer itself may sell Premium Plus, Pro and Studio subscriptions.** There is no third-party marketplace, seller onboarding, PDFs for sale, creator memberships, merchant tips, connected-account Checkout, or digital-product storefront. Do not rebuild those functions even if older git history/old specifications mention them.

## Exact current state
- Main verified Stripe LIVE merchant: `acct_1UdI9LBYH85ysT1B`.
- Three LIVE Stripe Products created: Plus `prod_VfgMlUsOz4GELl`, Pro `prod_VfgMPjnzui1zGl`, Studio `prod_VfgMvCX05yAJSj`. **Six owner-approved LIVE recurring Prices created and stored in Supabase; no genuine live payment accepted.**
- Stripe live Billing Portal `bpc_1UeKY2BYH85ysT1BioyXeK9C` configured; webhook `we_1UeKYyBYH85ysT1BSqAlpvsk` is DISABLED and its separate signing secret is stored on Render.
- Premium code from merged PR #28 runs on Render (commit `f03e231186ba6e16c339833b3bbb8f3121f4cb5d`). CI #44946031912 passed; hosted additive Premium database schema installed with RLS/private RPC checks. LIVE Checkout OFF; prices are now configured, but a restricted live API key, provider test and legal review remain before activation.
- Owner explicitly deferred Stripe Tax configuration. Checkout code uses `automatic_tax.enabled=false` on PR #29 branch; independent merchant tax obligations remain. Tax approval should NOT be silently fabricated or manually marked complete.
- Seller marketplace source/UI/API/routes removed merged to `main` in [PR #29](https://github.com/Truwty/snoozer-uk/pull/29). Historic creator SQL migrations and test payment records remain as audit evidence. Retirement migration has been applied to hosted Supabase with permanent policy constraints and revoked legacy RPCs.
- Render verified deployed main commit `55b9564533a6192d985c6dbda3a65e46704112fa`.

## What to work on next
1. Marketplace removal PR #29 is finished; verify the deployed 404 routes after any future releases.
2. Six LIVE recurring prices were approved, created and verified on Stripe and Supabase; no further price decisions needed unless the owner changes pricing.
3. Have owner create and securely install scoped LIVE key in Render. Verify live subscription Checkout only after price and legal/provider tests; never expose secret or create an actual charge on behalf of an unwitting customer.
4. Run `npm run billing:live:preflight`, validate signed webhooks, protected entitlement grants, cancellation, renewal, failure, refunds, disputes and customer support flows; review live emails, backup/restore, and auth security advisor warnings.
5. Preserve historical paid test orders/receipts and Git migration history; do not drop financial records or shut a connected Stripe account without separate review.

## Operations
Render service `srv-dbts6jon74is73en2rjg` in workspace `tea-d7omjhu7r5hc73dh1fd0`; Supabase project `edgptbiwswcdmmxzwhxv`; GitHub `Truwty/snoozer-uk`. Run `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e -- --workers=2`, and `npm run billing:live:preflight`.

See `docs/premium-live-launch.md` for exact requirements. Historical development checkpoints are in Git commits before PR #29 rather than active roadmap files.
