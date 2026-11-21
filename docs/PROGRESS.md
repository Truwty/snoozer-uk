# Snoozer.uk — current development progress (21 November 2026)

## Delivered
- Profiles, login via email/Discord, public publishing and Studio, templates, gallery, private media, analytics, leaderboard, custom domains, consent and privacy UI.
- Production hosted in Render with GitHub and Supabase and passing core CI (most recent prior green CI: <https://github.com/Truwty/snoozer-uk/actions/runs/44946031912>).
- Snoozer's only monetisation direction: its own Premium Plus/Pro/Studio subscriptions, no third-party selling.
- LIVE merchant Stripe account verified, Premium Billing Portal configured with cancellation/invoice/card update, separate signed webhook destination provisioned but disabled, isolated gated Premium Checkout and reconciliation code deployed as PR #28.
- Three LIVE Stripe products created on 21 November 2026 (Plus `prod_VfgMlUsOz4GELl`, Pro `prod_VfgMPjnzui1zGl`, Studio `prod_VfgMvCX05yAJSj`). **These have zero approved recurring prices; creating products alone cannot charge customers.**
- Database `snoozer.premium_live_policy` gated off; no live customers, subscriptions or grants on the last verification. Product sales must not be advertised as working.
- Marketplace retirement PR #29 removed 157 creator sale files before additional shared cleanup; will permanently block the old code/RPCs and leave historical data intact. Its release/testing is not complete until CI and Render deployment are verified.

## Outstanding
- Finish PR #29 and confirm the retired creator API cannot run from user or service credentials.
- Confirm exact GBP per-month and per-year price for Plus, Pro, Studio; create six recurring LIVE Prices and bind them in the private catalogue.
- Restricted LIVE Stripe API key must be saved on Render; no live transaction can be proven until this is done.
- Owner legal/consumer terms review, production signed event proof and full billing lifecycle tests, deliverability tests, support/refund readiness, backup/restore and security advisor reviews.
- Stripe Tax deferred at owner request; the business still must determine any legal VAT/tax liability separately. Checkout set to disable automatic-tax calculation on PR #29.
- Stripe webhook disabled intentionally until live key, prices and testing. No real customer payment was created by this work.

## Source of truth
`docs/CONTINUE.md`, `docs/premium-live-launch.md`, `docs/feature-ledger.md`. Retired project features and their old tests are preserved only in Git history and retained financial records. Do not reopen creator commerce.
