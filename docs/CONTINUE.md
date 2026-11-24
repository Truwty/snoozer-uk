## Feature #30 — Public Creator Discovery (24 November 2026)

**Status: Implementation in progress on `feature/public-creator-discovery`.** This entry will be updated with the final PR/CI outcome and merge details after verification.

**Branch/PR:** [#101 — Feature #30: Public Creator Discovery](https://github.com/Truwty/snoozer-uk/pull/101)  
**Current implementation head:** \`1cf678e15ca00dadf4194cb8584b5ce3706c2844\`  
**Base:** \`main\` at \`3bbf0c8b6b5532396aa9bea7d53233a10c5fb649\`  
**Diff:** 10 commits ahead, 0 behind; 43 changed files at last comparison.  
**PR status:** Open and GitHub reports mergeable. Not merged.

**CI status (24 November 2026):** Latest run [#45380036869](https://github.com/Truwty/snoozer-uk/actions/runs/45380036869) failed in the \`prepare\` job before a hosted runner was assigned. GitHub reports \`runner_id: 0\`, \`steps: []\`; \`validate\` also failed and the Security/Quality and Browser jobs were skipped. The same pre-runner failure has occurred on previous branch heads. No ESLint, TypeScript, Vitest, SQL migration replay, production build or Playwright step has run yet. This is not a code-test result.

**Database validation option:** No Supabase test branch exists. Supabase quoted the isolated development-branch compute charge at **US$0.01344 per hour** for this project. Creating that branch requires explicit cost approval; do not create it before the owner approves. No migration has been applied to the hosted project.

The approved scope is implemented on the feature branch: opt-in directory, category/tag search, related creators, Featured/Spotlight/standard collections, Studio controls, Owner AAL2 curation, moderation filtering, rate limiting, legal/help disclosures and tests. It uses published snapshots and the existing moderation system. It does not add a marketplace, paid placements, follower graph or view-based search ranking.

Implementation checklist:
- [x] Create dedicated branch from the verified latest \`main\` commit.
- [x] Add private discovery settings, public readers, creator settings writer and Owner curation RPCs.
- [x] Add Discover/category/collection routes, Studio controls, Owner curation UI, related creators and global navigation.
- [x] Add default-off profile trigger, legacy leaderboard preference preservation and indexed search.
- [x] Add Privacy, Terms, Help Centre and feature documentation.
- [x] Add unit, database integration and responsive browser tests.
- [ ] Run and pass latest-head database migrations, ESLint, TypeScript, unit tests, production build and Playwright.
- [ ] Review final checks and merge PR #101 after all required checks pass.
- [ ] Hosted migration and Render deployment remain separate release steps; neither has been performed.

# Development continuation — Snoozer.uk

## Legal information page / sole trader disclosure — 22 November 2026

Implemented `/legal` with substantive service, subscription, privacy, legal and contact disclosures and a plainly labelled, anchor-linked business identity section near the bottom. Public-facing brand remains Snoozer; personal operator identity is disclosed only in the required legal section, with `noindex` to limit search-engine catalogue exposure but no obfuscation or access restrictions. Linked the page from homepage footer, Terms, Pricing and other legal page navigation. **Postal/geographical address is NOT PROVIDED** and must be published where required before paid Checkout is activated. No legal/tax gate or payment switch was changed. CI covers link visibility, legal section access and mobile accessibility.

---

## Operator's seller/refund preferences — 22 November 2026

Confirmed by operator: Snoozer is a UK sole-trader trading name; support email `snoozersupport@snoozer.uk`; no UK VAT registration (reports below £90,000 taxable-turnover threshold); wants worldwide subscriptions; no voluntary refunds. Customer-facing terms and Help must always preserve statutory refund and cancellation rights. **These declarations do not constitute legal/tax approval**: sole trader legal identifying name and suitable business/geographical address remain unspecified; worldwide digital-service VAT/local tax obligations remain unresolved. Operator cannot complete a live card purchase; Stripe sandbox lifecycle is **not** end-to-end production acceptance. **Keep live checkout and legal/tax review gates OFF.** See [acceptance evidence](premium-live-acceptance.md).

---


## Verified LIVE webhook and sandbox payment probes — 22 November 2026

**Signed LIVE webhook: PASS.** Created and immediately cancelled a no-payment-method LIVE trial on Snoozer's actual Stripe account. Both LIVE Stripe events were recorded and processed in Supabase; Stripe has no pending webhooks for either event, and the customer's zero-value invoice was £0 paid/£0 due with zero charges. Live Checkout remains OFF.

**Sandbox provider acceptance:** £3 initial paid invoice, cancel-at-period-end, immediate cancellation and £3 test refund **PASS**; test Checkout session created but not paid; rejected card token `card_declined` occurred at attachment, not renewal. Actual recurring invoice renewal, dispute and integrated end-user paid entitlement **NOT PROVEN**. Test fixtures cancelled and product/price archived. [Complete evidence](premium-live-acceptance.md). Real billing gates remain disabled.

---


## Priority 1 billing readiness — 22 November 2026

**Implementation in [PR #35](https://github.com/Truwty/snoozer-uk/pull/35):** public Pricing responds to the real application/database Checkout gates; Terms and Help explain recurring subscriptions, renewal, cancellation and support; startup preflight checks the exact Stripe webhook destination and 14 event types; new unit tests cover signed-webhook dispatch, retries, idempotence and provider-backed entitlement reconciliation.

**Provider action completed:** LIVE webhook `we_1UeKYyBYH85ysT1BSqAlpvsk` was enabled on the correct Snoozer LIVE Stripe account with all 14 event types. API key read-only authentication and six live GBP Prices were previously verified. **Checkout remains deliberately disabled** in Render and database; hosted preflight confirms zero live customers and subscriptions. No real charge has been processed. Actual signed webhook delivery, provider acceptance payments, renewal/refund/failure flows and seller/consumer disclosures require separate real-world verification. See [Premium acceptance matrix](premium-live-acceptance.md). Do not override the launch gates based solely on mock tests or configured webhook status.

---


## Latest continuation — 22 November 2026, 00:01 UTC (supersedes older key warning)

**COMPLETE AND LIVE: persistent sign-in, multi-account switching, shared navigation, Pricing and Help Center.** PR [#33](https://github.com/Truwty/snoozer-uk/pull/33) merged to main as [7cd4fd8](https://github.com/Truwty/snoozer-uk/commit/7cd4fd8b1916d11ffbcdc78b13a5680e527cae05). [CI #44964090069](https://github.com/Truwty/snoozer-uk/actions/runs/44964090069) passed audit/lint/typecheck/unit/Supabase/build/Playwright accessibility and integration checks. Duplicate PR #34 closed unmerged. Render deploy `dep-dc130j0u01pc738k0cfg` confirmed **live** 22 Nov 00:00:46 UTC, exact commit; subsequent ERROR-level logs contained no entries. External independent page fetch through the web tool was unavailable; do not claim an external HTTP smoke check.

- Supabase SSR sessions use secure HTTP-only 365-day browser cookies, sitewide refresh and isolated account slots (up to four saved accounts); Auth still controls revocation, session expiry and password resets. Email/password and Discord OAuth both retain independent sessions, with server-validated switching and per-account local sign-out. The account manager is a themed dropdown/dialog.
- Shared themed top navigation covers homepage, templates, leaderboard and Studio; Help Center at `/help` provides searchable first-party articles, and `/pricing` shows approved Snoozer-only Plus/Pro/Studio monthly/yearly prices and real plan allowances.
- Render startup preflight on this release **supersedes the old invalid-format diagnosis below**: `key:authenticated_for_snoozer_prices`, `prices:verified_six`, `account:verified`, `billingPortal:verified`. **`checkoutEnabled:false`** remains deliberate; no live payment processed or authorized. Do not enable live billing/webhooks until legal, lifecycle and provider acceptance checks are complete.
- Next verification: owner/browser manual sign-in after reopening the browser (including Discord), sign in with second account, switch and local logout; review customer-facing account UI on actual mobile devices. CI covers reload/navigation persistence and isolated multi-account browser sessions on disposable Supabase; actual close-and-reopen behaviour still needs a manual production-browser check. Keep live payment configuration gated.

---


## LIVE key validation — 21 November 2026, 22:05 UTC

After the owner reported adding `STRIPE_PREMIUM_LIVE_API_KEY` to Render, PR [#30](https://github.com/Truwty/snoozer-uk/pull/30) deployed a read-only startup probe. The first safe log was `key:not_configured`. PR [#31](https://github.com/Truwty/snoozer-uk/pull/31) then added harmless whitespace trimming and distinct missing/invalid reporting. Both PRs passed full CI and merged to `main`. Latest Render deploy `dep-dc11am1ksfps73fgvjn0`, commit `512e8f2125b640e45de42bf15796938daf096f49`, confirmed **Live** at 22:05:32 UTC; checked logs contain no error entries.

**Definitive probe result:** `{"audit":"snoozer-premium-live-key","checkoutEnabled":false,"key":"invalid_format","prices":"not_checked","account":"not_checked","billingPortal":"not_checked"}` at 22:05:28 UTC. This means the key variable is **present** in the Render server environment but (even after trimming surrounding whitespace) is not a recognised `rk_live_...` or `sk_live_...` credential. It may contain a label, placeholder, publishable/test key, extra quotes or an incomplete value. The assistant **cannot see or recover the secret** and must not ask to paste it in chat.

**Owner action:** Open [Render Snoozer service Environment](https://dashboard.render.com/web/srv-dbts6jon74is73en2rjg) (correct service ID: `srv-dbts6jon74is73en2rjg`; link must use that exact ID), edit `STRIPE_PREMIUM_LIVE_API_KEY`, paste the actual complete restricted **LIVE** key from the main Snoozer Stripe account (no quotes or code fences), then **Save and deploy**. Verify the next startup log says `key:authenticated_for_snoozer_prices`, `prices:verified_six`; separately check `account` and `billingPortal` values. **Do not enable Checkout or webhooks yet**; live payment/lifecycle and legal requirements are still outstanding. Six live GBP Prices and their Supabase mappings were already completed and verified.


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
