# Snoozer Premium — only paid product

**Updated 22 November 2026:** Six live GBP prices are verified on the correct Stripe merchant, and the restricted LIVE key passed authenticated read-only checks on Render. Stripe webhook `we_1UeKYyBYH85ysT1BSqAlpvsk` is now **ENABLED** with all 14 expected event types. **Real Checkout is still OFF** until signed delivery, genuine subscription tests, and seller/consumer disclosures are verified. See [Premium live acceptance](premium-live-acceptance.md) for the current matrix.

## Approved GBP subscription prices

| Plan | LIVE Product ID | Monthly | Monthly LIVE Price ID | Annual | Annual LIVE Price ID |
| --- | --- | ---: | --- | ---: | --- |
| Snoozer Plus | `prod_VfgMlUsOz4GELl` | £3.00 | `price_1UeLyLBYH85ysT1BICf5EPJr` | £30.00 | `price_1UeLyYBYH85ysT1BEz7ehZP4` |
| Snoozer Pro | `prod_VfgMPjnzui1zGl` | £6.00 | `price_1UeLycBYH85ysT1BqE6guCme` | £60.00 | `price_1UeLyfBYH85ysT1BABUEkalJ` |
| Snoozer Studio | `prod_VfgMvCX05yAJSj` | £12.00 | `price_1UeLyjBYH85ysT1Bg7JnkUTg` | £100.00 | `price_1UeLypBYH85ysT1BnlVlQOVH` |

All prices are recurring `gbp`, quantity 1, `usage_type=licensed`, `interval_count=1`, live mode, active and mapped to their existing Product IDs. Pricing was explicitly supplied by the owner; the former £3.99 sandbox Plus fixture is NOT used. Stripe Tax was intentionally deferred and current Prices use `tax_behavior=unspecified`; Checkout uses `automatic_tax.enabled=false`. Do not represent this as a legal VAT/tax determination.

The product limits follow `snoozer.plan_versions`, version 1: Plus has 3 profiles / 100 links / 2 GB media / 1 domain; Pro has 10 profiles / 500 links / 10 GB media / 3 domains; Studio has 50 profiles / 2,000 links / 50 GB media / 10 domains. Pricing is not a creator seller marketplace; only Snoozer's verified main Stripe account receives the payments.

**Verified after creation:** Stripe `GetPrices` returned exactly six active, live prices with correct products, currencies, amounts and intervals. Hosted Supabase `public.premium_live_preflight()` returned `approvedOffers=6`, `coveredPlans=[plus,pro,studio]`, `checkoutEnabled=false`, `legalReviewed=false`, `currentSubscriptions=0`, `customers=0`, `unprocessedReceipts=0`. No live customer was charged.

## Existing production billing infrastructure

- Stripe main live merchant: `acct_1UdI9LBYH85ysT1B`; charges and payouts verified enabled.
- LIVE Billing Portal `bpc_1UeKY2BYH85ysT1BioyXeK9C`: active for invoices, payment method changes and cancellation at current period end; plan upgrades/downgrades await a defined switching/proration policy.
- LIVE platform-only webhook `we_1UeKYyBYH85ysT1BSqAlpvsk`: subscribed to 14 relevant events and **ENABLED (signed delivery still unverified)**. Its signing secret was saved server-side in Render. Destination: `https://snoozer-uk-staging.onrender.com/api/v1/billing/stripe/live-webhook`.
- Live Checkout and webhook handler: `src/lib/premium-live-service.ts`, `src/lib/premium-live-webhook.ts` and `src/lib/premium-live-reconciliation.ts`. Live-only entitlement grants require provider-verified invoices, subscription states, charge and risk checks. Signed webhook and replay/sweep logic are present but have not passed true live payment acceptance.
- Hosted database `snoozer.premium_live_prices` has all six source-of-truth IDs. `snoozer.premium_live_policy.checkout_enabled=false` and `legal_reviewed=false`; no live customers, checkout sessions, subscriptions or grants as verified. The historical `tax_reviewed=false` field remains informational; it no longer gates Checkout.
- Render environment includes pinned Stripe account ID and Billing Portal ID. Live webhook signing secret was saved. **`STRIPE_PREMIUM_LIVE_API_KEY` passed read-only live account, price and Billing Portal authentication on 22 November**; `SNOOZER_PREMIUM_LIVE_ENABLED=false` and `SNOOZER_PREMIUM_LEGAL_CONFIRMED=false` keep charging off.

## What remains before real payments can be taken

1. **Restricted LIVE API key:** In the *main Snoozer* Stripe Dashboard, generate a restricted key with the minimum read/write permissions required by the implemented Checkout, webhooks and portal. Put it directly into the Render service as `STRIPE_PREMIUM_LIVE_API_KEY` (server-only). **Never paste the key into a chat or source repository.** Use Stripe's live API key, not a Connect/test key.
2. **Seller/legal approval:** Confirm actual seller identity, renewal terms, cancellation/refund process, consumer rights, customer-support details and invoice disclosures, then independently approve `snoozer.premium_live_policy.legal_reviewed` and `SNOOZER_PREMIUM_LEGAL_CONFIRMED`. These remain **OFF** until real approval. Stripe Tax automation remains OFF at owner request but legal tax obligations still require separate assessment.
3. **Signed webhook validation:** After verifying live key, deployed handler and correct `whsec_*` value, verify that the **enabled** `we_1UeKYyBYH85ysT1BSqAlpvsk` endpoint receives a real event. Verify signed, live-mode, non-Connect events and real webhook delivery; do not equate a configured endpoint to a successful delivery.
4. **Billing lifecycle acceptance:** Complete approved isolated tests for subscription Checkout, authentication/3DS, renewal, card failure, cancellation, refund, dispute, fraud warnings, out-of-order and repeated webhook deliveries, cross-account access, correct entitlement grant/revoke and recovery. An actual live purchase should only be made with explicit authorised test-account/payment details after readiness checks.
5. **Production gates:** Run `npm run billing:live:preflight` in the intended server environment; address outstanding errors. Only after the above pass set `snoozer.premium_live_policy.checkout_enabled=true` and `SNOOZER_PREMIUM_LIVE_ENABLED=true`. Verify live Checkout price and access end-to-end, then monitor logs.
6. **Other launch checks:** Verify signup/recovery and billing email delivery, Supabase leaked-password protection setting, support/incident monitoring, backups and restores, mobile/accessibility and rollback runbooks. Do not claim fully tested production sales until these checks have real evidence.

## Marketplace closure

[PR #29](https://github.com/Truwty/snoozer-uk/pull/29) passed CI, was merged into main, and was deployed on Render at commit [`55b9564`](https://github.com/Truwty/snoozer-uk/commit/55b9564533a6192d985c6dbda3a65e46704112fa). Marketplace routes, sellers, creator Checkout, creator membership offers, Ko-fi donation selling and supporting code were removed, and legacy functions locked down. Old migrations and one paid **sandbox test** order remain for audit.

Official references: https://docs.stripe.com/billing/subscriptions/overview · https://docs.stripe.com/keys · https://docs.stripe.com/webhooks

## Verify the restricted LIVE key without disclosing it

The owner reports adding `STRIPE_PREMIUM_LIVE_API_KEY` directly to the Render environment. No assistant or GitHub user should copy the secret out of Render.

Every `npm start` on Render now executes a **read-only** check using that same environment. It issues Stripe GET requests for (1) the exact six known active GBP Premium prices, (2) the pinned main Snoozer account and (3) the configured Billing Portal. It only logs sanitised status values, and always allows Snoozer's public website to start, even if Stripe is unreachable. No customers, sessions, charges, or subscriptions are created.

Look in Render **Logs** for a JSON entry with `"audit":"snoozer-premium-live-key"`. Expected statuses are `"key":"authenticated_for_snoozer_prices"`, `"prices":"verified_six"`, `"account":"verified"`, `"billingPortal":"verified"`. If one permission is missing, a read-only operation may show `insufficient_permissions`; adjust *only* that permission in Stripe, never grant all permissions reflexively. Read-only verification is not evidence that write operations, webhooks or full paid Checkout are functional.

For manual repeatable verification in an environment where the secret is already installed, run `npm run billing:live:key-check`. Keep `SNOOZER_PREMIUM_LIVE_ENABLED=false` and the database policy `checkout_enabled=false` until successful legal/billing lifecycle acceptance.
