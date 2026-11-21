# Snoozer Premium — production activation and acceptance

**Status (21 November 2026): not ready to charge.** This document covers the **platform's own** Plus, Pro and Studio plans only. Third-party creator commerce remains retired, including Stripe Connect test sellers, PDFs and creator memberships.

## Implemented engineering boundary

- Isolated `premium_live_*` tables with RLS and no direct client privileges; service-only price, Checkout, receipt and grant functions. `get_my_premium_live_billing` exposes only the authenticated owner's boolean customer status and high-level subscription state.
- Live-only Stripe API key and account-ID pinning, Checkout with automatic tax, customer-bound session, idempotent payment operations, independent webhooks, customer self-service portal, conservative invoice/charge/refund/dispute/fraud verification before entitlement grant.
- Three independent fail-closed launch switches: `SNOOZER_PREMIUM_LIVE_ENABLED`, `SNOOZER_PREMIUM_TAX_CONFIRMED`, `SNOOZER_PREMIUM_LEGAL_CONFIRMED` (all currently **false** on Render), plus database `snoozer.premium_live_policy.checkout_enabled`, `tax_reviewed` and `legal_reviewed` (all **false** by default).
- Live webhook endpoint `we_1UeKYyBYH85ysT1BSqAlpvsk` for the 14 subscribed event types has been created in **disabled** state. Its signing secret was saved to Render server environment. The production portal configuration `bpc_1UeKY2BYH85ysT1BioyXeK9C` is live and active for cancellation at the end of term, invoices and payment method changes. Subscription price changes are intentionally **disabled** until tested.
- Historical Stripe sandbox and creator test financial records are not mixed with production prices or grants.

## External operator sign-offs required before activating (cannot be guessed)

1. **Approve real prices**. In Stripe LIVE, define distinct products and recurring GBP prices for Plus, Pro, Studio, monthly and yearly (six approved offers if all intervals are advertised). Enter the EXACT returned `price_*` IDs, integer pence, plan version and interval in `snoozer.premium_live_prices` via a reviewed schema data migration. Do not copy the £3.99 sandbox QA amount as a commercial offer without explicit approval. Never substitute test-mode IDs.
2. **Confirm UK tax/VAT legal obligations** with a qualified adviser/owner. The Stripe business-head-office setting is active, but there are no verified tax registrations. Register only in jurisdictions where the business is actually registered. Set Stripe Tax classifications and confirm Price tax behaviour (inclusive/exclusive) deliberately. The Checkout implementation uses `automatic_tax.enabled=true`; no taxes will be collected in unregistered locations solely because this flag exists. Review international digital services treatment, invoices, exemptions, VAT evidence and retention. Stripe Tax status `active` is **not** a VAT-compliance sign-off.
3. **Legal terms** must identify the actual seller/legal business, price and renewal basis, cancellation timing, refund and consumer rights, digital-service start/withdrawal rules, customer support contact, privacy processors and retention. Current public Terms and Privacy pages are general notices; owner/legal review and any necessary edits are REQUIRED. Do not automatically accept digital content withdrawal waivers.
4. **Restricted production key**: create a server-only Stripe LIVE restricted API key with narrowly scoped Account, Customer, Price, Checkout Session, Subscription, Invoice, Invoice Payments, PaymentIntent, Charge, Dispute, Radar early-fraud-warning and Billing Portal read/write as needed. Save as `STRIPE_PREMIUM_LIVE_API_KEY` in Render, never in public JS, GitHub, logs, tickets or chat. Configure a separate live webhook signing secret; it was saved server-side at creation.
5. **Subscription-management policy**: existing live Billing Portal permits cancellation, invoices and updating cards. Price switching is OFF until six real prices, proration policy, portal `subscription_update` and paid-invoice mapping are verified. Until then, existing subscriptions can be cancelled through the portal; after their actual end, users may start a different tier when Checkout is approved.
6. **Email**: independently send and receive signup confirmation, password recovery, change-email/password alerts, and paid/failed-payment/cancellation/invoice notifications with an approved test inbox. Verify SMTP sender authentication (SPF, DKIM, DMARC), deliverability, bounces and safe redaction. Recent auth logs alone do not prove delivery.
7. **Provider acceptance**: on an isolated safely controlled merchant test, verify Checkout, 3DS and asynchronous events, renewal, cancellation, payment failure, partial/full refund, dispute, fraud warning and retry/out-of-order event behaviour. Confirm `snoozer.entitlement_grants` changes only after canonical Stripe checks; signed events must never grant based on redirect or payload alone. Test wrong-user, test-mode and Stripe Connect events are denied.
8. **Operational controls**: identify support owner and response policy, refund and complaint handling, production webhook retry dead letters, missed-event sweep, Supabase backups/restore drill, Render health and rollback, rate limits, security review, WCAG/mobile and consent/legal review. Avoid claiming production readiness solely from passing CI.
9. **Activation order**: run `npm run billing:live:preflight` using operator-only server variables; address every blocker, enable Stripe live webhook and confirm signature, then set database policy booleans and finally set the three Render flags. Perform an independent authorised live smoke purchase only after explicit pricing/tax/legal approval. If one step fails, keep the gates OFF.

**Never enable live Checkout by guessing a price, fabricating a test purchase, reusing Stripe test mode or treating Stripe Tax setup as tax-registration proof.**

## Traceability

- Production foundation PR: [#28](https://github.com/Truwty/snoozer-uk/pull/28)
- Retired creator marketplace: [#27](https://github.com/Truwty/snoozer-uk/pull/27)
- Production read-only preflight: `scripts/premium-live-preflight.mjs`
- Migrations: `20261121200500_premium_live_billing.sql`
- Billing route: `/api/v1/billing/stripe/live-webhook`
- Stripe product & tax: https://docs.stripe.com/tax/set-up
- Stripe webhook implementation: https://docs.stripe.com/webhooks
