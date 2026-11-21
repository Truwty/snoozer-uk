# Snoozer.uk — current development progress (21 November 2026)

## Release verification — creator marketplace removed (21 November 2026)

**COMPLETE:** [PR #29](https://github.com/Truwty/snoozer-uk/pull/29) merged into `main` as [commit `55b9564`](https://github.com/Truwty/snoozer-uk/commit/55b9564533a6192d985c6dbda3a65e46704112fa). [CI #44949745031](https://github.com/Truwty/snoozer-uk/actions/runs/44949745031) passed secret audit, dependency audit, lint, TypeScript, unit tests, disposable Supabase migration, build and Playwright. Render deploy `dep-dc10h8qjnfac73fa24tg` confirmed **Live** 21 November 2026 at 21:11:50 UTC, exact merged commit; post-deploy ERROR logs checked for the period beginning 21:10 UTC found zero entries. An external direct HTTP smoke fetch could not be verified through the web tool, so do not represent it as independently performed.

**Only Snoozer Premium is sold.** 157 creator-marketplace source, test, UI and documentation files removed plus shared-path cleanup, and all `/store/*`, `/studio/products/*`, `/studio/memberships/*`, `/studio/donations/*`, `/studio/purchases/*`, `/studio/support/*`, `/studio/product-reports/*`, `/api/v1/commerce/*` paths now 404 under the site proxy. GitHub main tree audit found zero marketplace application files; historical SQL migrations intentionally remain.

Supabase retirement migration `20261121205733_retire_creator_marketplace_and_optional_tax` applied successfully. Four SQL CHECK constraints permanently require retired creator policy/offers/Ko-fi hooks `enabled=false`; marketplace RPC EXECUTE revoked from anon, authenticated and service_role. Confirmed old one paid £5 **SANDBOX** order preserved, and private PDF Storage bucket has no direct access policies. Nine creator-specific Render env keys cleared/forced false; three sandbox creator webhook destinations remain disabled. No historical payment/financial records deleted.

**LIVE Stripe products created on the VERIFIED MAIN Snoozer account**: Plus `prod_VfgMlUsOz4GELl`; Pro `prod_VfgMPjnzui1zGl`; Studio `prod_VfgMvCX05yAJSj`. Verified active live-mode and owned by Snoozer. Live Stripe Price count **0**, live subscriptions **0** and hosted Premium prices **0**; no actual LIVE payment was processed or proven. Live Checkout remains disabled by server+database launch gates. Stripe Tax was intentionally omitted at owner request: `automatic_tax.enabled=false`, removed tax-specific gating but **merchant tax obligations remain**. Live Billing Portal active, live signed webhook destination configured but disabled; restricted LIVE API key not installed/verified. Legal approval remains unconfirmed.

**Exact next blockers for working LIVE payments:** (1) Owner supplies six explicit GBP recurring rates — monthly/yearly for Plus, Pro and Studio (never invent); (2) create six live recurring Stripe Prices and bind exact amounts/IDs to `snoozer.premium_live_prices`; (3) securely create/install restricted LIVE Stripe API key as `STRIPE_PREMIUM_LIVE_API_KEY` in Render; (4) complete owner-approved sales/renewal/refund/consumer terms and production signed webhook plus independent end-to-end real provider tests. Do not enable webhook or charging flags until verified. Read `docs/premium-live-launch.md` for exact steps.


## Delivered
- Profiles, login via email/Discord, public publishing and Studio, templates, gallery, private media, analytics, leaderboard, custom domains, consent and privacy UI.
- Production hosted in Render with GitHub and Supabase and passing core CI (most recent prior green CI: <https://github.com/Truwty/snoozer-uk/actions/runs/44946031912>).
- Snoozer's only monetisation direction: its own Premium Plus/Pro/Studio subscriptions, no third-party selling.
- LIVE merchant Stripe account verified, Premium Billing Portal configured with cancellation/invoice/card update, separate signed webhook destination provisioned but disabled, isolated gated Premium Checkout and reconciliation code deployed as PR #28.
- Three LIVE Stripe products created on 21 November 2026 (Plus `prod_VfgMlUsOz4GELl`, Pro `prod_VfgMPjnzui1zGl`, Studio `prod_VfgMvCX05yAJSj`). **These have zero approved recurring prices; creating products alone cannot charge customers.**
- Database `snoozer.premium_live_policy` gated off; no live customers, subscriptions or grants on the last verification. Product sales must not be advertised as working.
- Marketplace retirement PR #29 was merged and verified deployed; 157 creator-specific files plus shared cleanup were removed, with historical financial data retained.

## Outstanding
- PR #29 is finished and the retired creator API is revoked for user and service credentials.
- Confirm exact GBP per-month and per-year price for Plus, Pro, Studio; create six recurring LIVE Prices and bind them in the private catalogue.
- Restricted LIVE Stripe API key must be saved on Render; no live transaction can be proven until this is done.
- Owner legal/consumer terms review, production signed event proof and full billing lifecycle tests, deliverability tests, support/refund readiness, backup/restore and security advisor reviews.
- Stripe Tax deferred at owner request; the business still must determine any legal VAT/tax liability separately. Checkout set to disable automatic-tax calculation on PR #29.
- Stripe webhook disabled intentionally until live key, prices and testing. No real customer payment was created by this work.

## Source of truth
`docs/CONTINUE.md`, `docs/premium-live-launch.md`, `docs/feature-ledger.md`. Retired project features and their old tests are preserved only in Git history and retained financial records. Do not reopen creator commerce.
