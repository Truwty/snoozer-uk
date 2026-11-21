# Snoozer Premium — only paid product

**21 November 2026: implementation in progress. Live charging has NOT been activated.**

Snoozer does not operate a creator marketplace or Stripe Connect seller flow. The three products in the main Snoozer LIVE Stripe account are:
| Product | Live Stripe Product | Status |
| --- | --- | --- |
| Snoozer Plus | `prod_VfgMlUsOz4GELl` | Active; recurring price not yet approved |
| Snoozer Pro | `prod_VfgMPjnzui1zGl` | Active; recurring price not yet approved |
| Snoozer Studio | `prod_VfgMvCX05yAJSj` | Active; recurring price not yet approved |

The products represent real version-1 plan allowances in `snoozer.plan_versions`:
Plus: 3 profiles, 100 links per profile, 2 GB media and 1 domain;
Pro: 10 profiles, 500 links, 10 GB media and 3 domains;
Studio: 50 profiles, 2,000 links, 50 GB media and 10 domains.

**No one has approved production amounts for monthly or yearly billing.** The historical £3.99/month Plus entry is a sandbox QA fixture, *not* authority to charge it in live mode. Do not create a `price_*` or publish a payment link using invented amounts. After owner approval, create six **live-mode** GBP recurring prices (three plans × monthly/yearly), then bind exactly those price IDs and integer pence values in `snoozer.premium_live_prices`. Stripe product, price, plan, currency, amount and cadence must all match.

## Stripe and application state
- Main live merchant: `acct_1UdI9LBYH85ysT1B`, verified; charges and payouts enabled.
- LIVE Billing Portal: `bpc_1UeKY2BYH85ysT1BioyXeK9C`, active, invoice history, payment-method updates and cancellation at period end. Subscription switching remains disabled pending explicit price and proration policy.
- LIVE signed webhook `we_1UeKYyBYH85ysT1BSqAlpvsk`: configured for 14 events, currently **disabled**. Signing secret stored server-side on Render.
- New merchant-owned billing path: `/api/v1/billing/stripe/live-webhook`; verified Checkout, reconciliation, sticky refund/fraud holds and owner-only subscription billing. Legacy sandbox billing is **not** the live path.
- Host DB `snoozer.premium_live_policy`: `checkout_enabled=false`, `legal_reviewed=false`, `tax_reviewed=false` (tax flag retained only as documentary history). No active live prices, customers, sessions, subscriptions or grants as of the audit.
- Render `STRIPE_PREMIUM_LIVE_ACCOUNT_ID` and portal config are set. `STRIPE_PREMIUM_LIVE_WEBHOOK_SECRET` is stored. A real **restricted LIVE API key has not been provided** to `STRIPE_PREMIUM_LIVE_API_KEY`.
- Render `SNOOZER_PREMIUM_LIVE_ENABLED=false` and `SNOOZER_PREMIUM_LEGAL_CONFIRMED=false` are launch gates. Platform Premium billing must never use Connect or test keys.

## Stripe Tax intentionally deferred at owner's request
Checkout sets `automatic_tax: { enabled: false }`. The site does **not** automatically calculate VAT/sales tax. The merchant remains responsible for determining taxes legally due, any tax registrations, reporting and invoice treatment. Live Stripe Tax has no verified registrations; we have not registered the business or asserted an exemption. **Do not describe a charge as tax-compliant solely because payment works.** Stripe Tax can be added later when legally determined; it is not a technical prerequisite for non-tax-calculated Checkout.

## Remaining steps to take real payments
1. Owner confirms exact GBP amounts for Plus, Pro and Studio monthly and annually. Create Stripe LIVE recurring Prices for these approved amounts with correct subscription/tax behaviour; insert their real IDs into `snoozer.premium_live_prices`.
2. Owner creates a restricted LIVE secret key in the main Stripe Dashboard and stores it as Render `STRIPE_PREMIUM_LIVE_API_KEY`. Never post a secret into Git, chat or public `NEXT_PUBLIC_*` variables. It needs only the permission set used by `src/lib/premium-live-service.ts`, `premium-live-webhook.ts` and `premium-live-reconciliation.ts`.
3. Review current Terms, consumer cancellation/refund disclosures, subscription price/renewal messaging, privacy and support contact. Confirm the real seller identity. Enable `snoozer.premium_live_policy.legal_reviewed` and Render `SNOOZER_PREMIUM_LEGAL_CONFIRMED` **only after review**.
4. Complete provider acceptance: subscription Checkout with real verified customer and webhook, renewal, card failure, cancellation, refund, dispute, webhook retries, separate buyer accounts, active/expired entitlements and invoice proofs. Test with Stripe's isolated test environment first; do not claim live success without an authorized independent real payment.
5. Enable the LIVE webhook only after verifying the deployed handler and signing secret. Configure optional read-only recovery and bounded reconciliation. Use `npm run billing:live:preflight` to find missing dependencies.
6. Enable database `checkout_enabled` and Render `SNOOZER_PREMIUM_LIVE_ENABLED` only after all real-payment acceptance and legal requirements pass; immediately verify production can create/complete a valid subscription and revoke access on failed/refunded payment.
7. Verify signup confirmation, password recovery and billing notification email delivery; review Supabase leaked-password protection, support runbooks, accessible mobile Checkout, backup/restore, fraud monitoring and rollback.

## Marketplace removal
[PR #29](https://github.com/Truwty/snoozer-uk/pull/29) deletes seller/marketplace application routes and modules, adjusts Studio/homepage UI and includes a permanent database freeze/revocation migration. Existing paid test-order records and old migration history remain for financial audit only. The prior marketplace feature specification is superseded and must not be used to recreate it.

**Reference:** <https://docs.stripe.com/billing/subscriptions/overview> and <https://docs.stripe.com/webhooks>.
