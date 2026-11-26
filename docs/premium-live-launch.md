# Snoozer Premium — only paid product

## Current operating state — 26 November 2026

**Live Premium Checkout is intentionally enabled.** The owner has explicitly confirmed that the live payment configuration is valid and payments are meant to be accepted. This is the current operating instruction and supersedes older notes in this document that described Checkout as OFF or instructed developers to keep activation gates disabled.

Do not disable Checkout, switch the Stripe mode, change the payment gates, rotate the live API key or webhook secret, alter prices, or modify billing settings as part of general optimisation. Payment changes require a specific payment-related instruction from the owner.

The audit verified the following connected state:

- Supabase project snoozer-staging, region eu-west-1, is ACTIVE_HEALTHY.
- The private Premium policy reports checkout_enabled=true, tax_reviewed=true and legal_reviewed=true.
- public.premium_live_preflight() reports approvedOffers=6, coveredPlans=[plus,pro,studio], checkoutEnabled=true, customers=1, currentSubscriptions=0 and unprocessedReceipts=0.
- public.list_premium_live_offers() returns all six active LIVE GBP offers.
- Render startup audit at 26 November 2026 04:12:30 UTC reported checkoutEnabled=true, key=authenticated_for_snoozer_prices, prices=verified_six, account=verified and billingPortal=verified.
- The LIVE Stripe webhook remains enabled with its 14 configured event types. Signed no-charge LIVE delivery was previously verified on 22 November with two processed receipts.
- The owner confirms that the server-side payment activation configuration is intentional and must remain enabled.

The currentSubscriptions=0 result is an observed database count, not evidence that Checkout is disabled or malfunctioning. The preflight shows one customer, six approved offers and no unprocessed receipts. Do not invent a paid subscription or transaction that is not present in the acceptance records.

## Approved GBP subscription prices

| Plan | LIVE Product ID | Monthly | Monthly LIVE Price ID | Annual | Annual LIVE Price ID |
| --- | --- | ---: | --- | ---: | --- |
| Snoozer Plus | prod_VfgMlUsOz4GELl | £3.00 | price_1UeLyLBYH85ysT1BICf5EPJr | £30.00 | price_1UeLyYBYH85ysT1BEz7ehZP4 |
| Snoozer Pro | prod_VfgMPjnzui1zGl | £6.00 | price_1UeLycBYH85ysT1BqE6guCme | £60.00 | price_1UeLyfBYH85ysT1BABUEkalJ |
| Snoozer Studio | prod_VfgMvCX05yAJSj | £12.00 | price_1UeLyjBYH85ysT1Bg7JnkUTg | £100.00 | price_1UeLypBYH85ysT1BnlVlQOVH |

All prices are recurring GBP, quantity 1, usage_type=licensed, interval_count=1, live mode, active and mapped to their existing Product IDs. The former £3.99 sandbox Plus fixture is not used.

Stripe Tax automation remains configured with automatic_tax.enabled=false and the LIVE Prices have tax_behavior=unspecified. That is an explicit product configuration and does not itself determine or waive any merchant tax obligations. The current database tax_reviewed flag is true; do not silently rewrite it or infer legal conclusions from the flag.

The product limits follow snoozer.plan_versions, version 1: Plus has 3 profiles / 100 links / 2 GB media / 1 domain; Pro has 10 profiles / 500 links / 10 GB media / 3 domains; Studio has 50 profiles / 2,000 links / 50 GB media / 10 domains. Snoozer Premium is the only paid product. It is not a creator seller marketplace; payments go to Snoozer's verified main Stripe account.

## LIVE billing infrastructure and safeguards

- Main Snoozer LIVE Stripe merchant: acct_1UdI9LBYH85ysT1B.
- LIVE Billing Portal: bpc_1UeKY2BYH85ysT1BioyXeK9C. It is configured for invoices, payment-method updates and cancellation at the current period end. Plan switching and proration behaviour should be separately tested before being advertised.
- LIVE platform-only webhook: we_1UeKYyBYH85ysT1BSqAlpvsk. It is enabled for the 14 expected event types. Signed LIVE delivery was verified on 22 November via a no-payment-method trial; two signed events were processed with no charge.
- LIVE webhook destination: https://snoozer-uk-staging.onrender.com/api/v1/billing/stripe/live-webhook.
- Checkout and webhook logic: src/lib/premium-live-service.ts, src/lib/premium-live-webhook.ts and src/lib/premium-live-reconciliation.ts.
- Live-only entitlements are based on provider-verified invoices, subscription states, charge and risk checks. Webhook replay protection and reconciliation logic are present.
- The Supabase Premium policy and six current LIVE prices are the database source of truth. The current policy flags are all true.
- Render holds the server-only LIVE Stripe credentials. Never copy credentials into GitHub, source files, logs or chat.
- The creator marketplace remains retired. Historical creator/sandbox tables and records are retained for audit; they are not current paid products.

## Operational verification — not activation instructions

The following checks are appropriate for ongoing billing assurance. They are not instructions to turn Checkout off or postpone activation:

1. Verify the existing restricted LIVE API key with the read-only startup audit. The latest sampled startup audit passed the account, six-price and Billing Portal checks.
2. Monitor signed webhook delivery, duplicate event handling, out-of-order events, retries and unprocessed receipts.
3. Continue lifecycle acceptance for renewals, card failures, cancellation, refunds, disputes, fraud warnings, entitlement grants/revocation and recovery. Use authorised test accounts and owner-approved payment methods; do not invent or create charges as part of general optimisation.
4. Confirm the billing portal's cancellation and invoice behaviour remains correct.
5. Keep customer-facing renewal, cancellation, support and statutory consumer-rights disclosures accurate.
6. Keep scheduled reconciliation and webhook-processing jobs monitored. Investigate discrepancies without changing activation gates as a first response.

For a read-only key check in an environment where the secret is already installed, run npm run billing:live:key-check. The script issues Stripe GET requests only. It does not create customers, Checkout sessions, charges, refunds, prices or subscriptions. Expected successful statuses include authenticated_for_snoozer_prices, verified_six, account verified and Billing Portal verified.

**Payment preservation rule:** General Snoozer optimisation must leave the six LIVE prices, LIVE Stripe account, webhook, Checkout configuration and all payment gates unchanged. Never set SNOOZER_PREMIUM_LIVE_ENABLED=false, SNOOZER_PREMIUM_LEGAL_CONFIRMED=false or snoozer.premium_live_policy.checkout_enabled=false as part of this optimisation programme.

## Marketplace closure

Marketplace routes, sellers, creator Checkout, creator membership offers, Ko-fi donation selling and supporting code were removed by PR #29, merged and deployed at commit 55b9564533a6192d985c6dbda3a65e46704112fa. Legacy creator records and historical migrations remain preserved for audit.

Official references: https://docs.stripe.com/billing/subscriptions/overview · https://docs.stripe.com/keys · https://docs.stripe.com/webhooks
