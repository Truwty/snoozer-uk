## Feature #30 — Public Creator Discovery (24 November 2026)

**Implementation and automated validation: complete. PR #101 remains open and unmerged.** The branch is ready for owner review and the separately controlled release steps.

**Branch/PR:** [#101 — Feature #30: Public Creator Discovery](https://github.com/Truwty/snoozer-uk/pull/101)  
**Validated head:** `ca6b9c9b7800deaf0c5a1fce42a05248ad721df8`  
**Base:** `main` at `3bbf0c8b6b5532396aa9bea7d53233a10c5fb649`  
**Comparison:** 44 commits ahead, 0 behind; 45 changed files.  
**PR state:** Open, mergeable, not merged.

**Full CI:** [Run #956 — success](https://github.com/Truwty/snoozer-uk/actions/runs/45512619108), completed against the exact validated head above.

**Verified checks**
- Secret scan, dependency/policy audit, ESLint and TypeScript: **passed**.
- Unit and embedded-PostgreSQL database suite: **337/337 tests passed across 46 test files**. The database suite replayed the migration chain and exercised the Feature #30 opt-in, privacy, Owner MFA, rate-limit, collection and leaderboard paths.
- Production Next.js build: **passed**.
- Chromium Playwright: **all 5 shards passed; 72 tests passed and 1 test skipped**.
- Aggregate `validate` job: **passed**.

**Corrections made during validation**
- Removed duplicated and invalid SQL left after repeated `COMMIT` statements in the discovery rate-limit migration.
- Added direct collection-by-slug lookup so a collection remains reachable even when it is outside the 20-item public shelf; rechecked publication, opt-in and moderation eligibility and restricted the reader to the service role.
- Tightened relevance cursor bounds and response-schema limits; corrected Owner schedule parsing and the Studio preview.
- Added regression coverage for the collection shelf limit, public RPC privileges, leaderboard independence and active Owner MFA session enforcement.
- Added Discover and category routes to the accessibility checks and reconciled the sitemap, Terms and Privacy disclosures.

**Feature scope delivered:** default-off per-profile Discover listing; allow-listed category and interest filters; bounded search and stable pagination; related creators with separate opt-in; Featured, Community Spotlight and standard Owner-curated collections; Studio settings and preview; Owner AAL2 curation and audit; live moderation/opt-out filtering; independent Views Leaderboard preference; Privacy, Terms, Help Centre, sitemap and feature documentation. No marketplace, paid placement, follower graph or popularity ranking was added.

**Release boundary — not performed:** No migration has been applied to hosted Supabase, no production data has been changed, no Render deployment has been triggered, and Render auto-deploy remains disabled. PR #101 still needs the owner’s merge. After merge, apply the ten Feature #30 migrations in timestamp order, verify the hosted migration registry and RPC grants, manually deploy the merged commit to Render, and complete authenticated staging acceptance for Studio opt-in/opt-out, search, recommendations, collections, moderation exclusion and leaderboard independence. Do not mark the feature live until those separate release checks pass.

Implementation checklist:
- [x] Implement approved Feature #30 scope and documentation.
- [x] Pass latest-head secret scan, dependency/policy audit, ESLint and TypeScript.
- [x] Pass 337 unit/database tests and all migration replay checks.
- [x] Pass production build and all five Playwright shards.
- [x] Pass aggregate CI validation on the exact PR head.
- [ ] Owner merges PR #101.
- [ ] Apply and verify hosted Supabase migrations.
- [ ] Manually deploy Render and complete staging acceptance.

# Snoozer.uk — current development progress (21 November 2026)

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


## Priority 1 billing-readiness work — 22 November 2026

Snoozer LIVE Stripe webhook `we_1UeKYyBYH85ysT1BSqAlpvsk` enabled with 14 configured events. [PR #35](https://github.com/Truwty/snoozer-uk/pull/35) hardens Checkout-to-user webhook-binding race retries, payment event and entitlement tests, exact preflight verification, subscriber disclosures and dynamic pricing copy. Real signed event delivery and payment acceptance **not yet proven**. Server and hosted DB Checkout gates remain OFF, zero live subscribers, no real charge or refund performed. See [acceptance evidence](premium-live-acceptance.md).

---


## Production release — 22 November 2026, 00:01 UTC

**Released:** persistent sign-in, multi-account switching, top-bar redesign, Snoozer Premium Pricing and first-party searchable Help Center. [PR #33](https://github.com/Truwty/snoozer-uk/pull/33) squash-merged as [7cd4fd8](https://github.com/Truwty/snoozer-uk/commit/7cd4fd8b1916d11ffbcdc78b13a5680e527cae05); [CI #44964090069](https://github.com/Truwty/snoozer-uk/actions/runs/44964090069) fully green including disposable Supabase E2E and WCAG checks; Render deploy `dep-dc130j0u01pc738k0cfg` **Live** 2026-11-22 00:00:46 UTC with zero checked ERROR-level logs. Duplicate PR #34 was closed unmerged. Direct external HTTP smoke unavailable through the web tool.

**Features:** 365-day secure HTTP-only SSR cookies, sitewide refresh, four remembered user sessions with isolated cookie namespaces and real Supabase verification, account-switcher dropdown/modal, add/switch/remove/local logout flows, shared responsive nav, new `/pricing`, searchable `/help` and article guides. Screens stay on Snoozer theme and Discord is not a navbar button (OAuth remains supported). Provider expiration/revocation and browser cookie clearing can still end sessions; indefinite provider access cannot be promised.

**Live billing status update:** Unlike the 21 November warning below, current Render startup key audit is **authenticated** with six verified Stripe prices, the correct account and billing portal. Checkout is **still disabled** and legal/provider acceptance checks remain outstanding. No live customer charge was performed as part of this release.

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


## Delivered
- Profiles, login via email/Discord, public publishing and Studio, templates, gallery, private media, analytics, leaderboard, custom domains, consent and privacy UI.
- Production hosted in Render with GitHub and Supabase and passing core CI (most recent prior green CI: <https://github.com/Truwty/snoozer-uk/actions/runs/44946031912>).
- Snoozer's only monetisation direction: its own Premium Plus/Pro/Studio subscriptions, no third-party selling.
- LIVE merchant Stripe account verified, Premium Billing Portal configured with cancellation/invoice/card update, separate signed webhook destination provisioned but disabled, isolated gated Premium Checkout and reconciliation code deployed as PR #28.
- Three LIVE Stripe products created on 21 November 2026 (Plus `prod_VfgMlUsOz4GELl`, Pro `prod_VfgMPjnzui1zGl`, Studio `prod_VfgMvCX05yAJSj`). **These now have six approved LIVE recurring prices; Checkout is still disabled until credential and provider tests pass.**
- Database `snoozer.premium_live_policy` gated off; no live customers, subscriptions or grants on the last verification. Product sales must not be advertised as working.
- Marketplace retirement PR #29 was merged and verified deployed; 157 creator-specific files plus shared cleanup were removed, with historical financial data retained.

## Outstanding
- PR #29 is finished and the retired creator API is revoked for user and service credentials.
- Prices COMPLETE: six approved LIVE GBP recurring prices are bound and verified in Supabase.
- Restricted LIVE Stripe API key must be saved on Render; no live transaction can be proven until this is done.
- Owner legal/consumer terms review, production signed event proof and full billing lifecycle tests, deliverability tests, support/refund readiness, backup/restore and security advisor reviews.
- Stripe Tax deferred at owner request; the business still must determine any legal VAT/tax liability separately. Checkout set to disable automatic-tax calculation on PR #29.
- Stripe webhook disabled intentionally until live key, prices and testing. No real customer payment was created by this work.

## Source of truth
`docs/CONTINUE.md`, `docs/premium-live-launch.md`, `docs/feature-ledger.md`. Retired project features and their old tests are preserved only in Git history and retained financial records. Do not reopen creator commerce.
