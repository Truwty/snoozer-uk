# Snoozer Premium LIVE payment acceptance matrix

**Assessment date: 22 November 2026 UTC.** This checklist is a release gate, not evidence that billing is live. All real charges remain disabled at the server and hosted-database policy layers until the remaining evidence exists. Only Snoozer Plus, Pro and Studio subscriptions are sold.

## Verified independently

| Check | Result | Evidence |
| --- | --- | --- |
| Intended LIVE Stripe merchant | PASS | Stripe account `acct_1UdI9LBYH85ysT1B`; charges/payouts and identity previously verified |
| Approved recurring six GBP Prices | PASS | All six price IDs under Plus/Pro/Studio are live, active and stored in hosted `snoozer.premium_live_prices` |
| Restricted LIVE API credential read checks | PASS | Render startup probe: `key:authenticated_for_snoozer_prices`, `prices:verified_six`, `account:verified`, `billingPortal:verified` |
| LIVE Billing Portal configured | PASS | Configuration `bpc_1UeKY2BYH85ysT1BioyXeK9C` |
| LIVE webhook registration | PASS | Stripe destination `we_1UeKYyBYH85ysT1BSqAlpvsk` enabled 22 Nov 2026; exact URL and 14 intended event subscriptions verified on provider |
| Webhook signed **delivery** | **NOT PROVEN** | Enabling a Stripe destination does not prove it reached the deployed application or had the correct `whsec_*` on Render |
| Database subscription state | PASS (no purchases) | `public.premium_live_preflight()`: zero live customers, subscriptions and unprocessed receipts |
| Server Checkout switch | OFF | `SNOOZER_PREMIUM_LIVE_ENABLED=false`; no live customer Checkout |
| Database Checkout and seller sign-off | OFF | `snoozer.premium_live_policy.checkout_enabled=false` and `legal_reviewed=false` |
| Automated safe-path tests | **CI REQUIRED** | PR #35 adds new mocked webhook replay/reconciliation tests; check the GitHub Actions result before claiming this passed |

## Acceptance before enabling real payments

1. **Seller and consumer disclosures:** Verify the merchant's actual legal name, service/contact address, renewal frequency, payment total, right-to-cancel instructions, refunds and any applicable cooling-off rights. An automated card processor does not substitute for these obligations. Terms, Pricing and Help provide initial subscription wording but do not supply an unverified seller identity.
2. **Tax scope:** Automatic Stripe Tax remains OFF by owner request. UK VAT registration is normally mandatory above the current £90,000 taxable turnover threshold, with additional circumstances and rules. For UK-supplied digital services to customers abroad, including EU consumers, independent location-based VAT obligations may arise. Confirm the actual customer geography and merchant tax position before switching on worldwide Checkout.
3. **Signed webhook:** On a controlled provider-issued event, verify the *exact* Stripe destination delivers to the deployed route, signature is accepted, account and `livemode` match, the receipt is persisted, and Stripe records a successful 2xx response. Invalid signatures, test-mode and Connect events must be rejected; do not copy a signing secret into CI or chat.
4. **Provider flow:** Using an explicitly authorised test account/payment method, verify a genuine subscription Checkout from `/studio/plan`, correct price and amount, and an entitlement that becomes active only after a verified paid invoice/charge. Do not create a live payment or refund without authorisation from the cardholder.
5. **Lifecycle:** Verify (a) renewal extending access, (b) payment failure removing access, (c) 3DS/action-required state, (d) cancellation at period end, (e) cancellation/reversal/refund, (f) dispute/fraud risk hold, (g) duplicate and out-of-order webhooks, (h) lost webhook recovery, (i) cross-account checks, and (j) email, portal invoice, support and cancellation journeys. Use Stripe test clocks in the sandbox for simulated renewals and failures before controlled LIVE acceptance.
6. **Operational launch:** Run `npm run billing:live:preflight` with the intended server credentials; review Supabase advisors and live receipts; confirm rollback and operator contact. Enable `SNOOZER_PREMIUM_LEGAL_CONFIRMED`, database `legal_reviewed`, database `checkout_enabled` and `SNOOZER_PREMIUM_LIVE_ENABLED` only after actual seller approval and provider acceptance. Monitor first payments and re-run the preflight after release.

**Current action decision:** Keep charging OFF. No real payment, refund, dispute, invoice or billing provider webhook has yet been independently exercised end-to-end on the LIVE service.

## Technical references

- [Stripe Billing testing and test clocks](https://docs.stripe.com/billing/testing)
- [Stripe subscriptions](https://docs.stripe.com/billing/subscriptions/overview)
- [Stripe webhooks](https://docs.stripe.com/webhooks)
- [GOV.UK VAT registration](https://www.gov.uk/register-for-vat)
- [GOV.UK online selling requirements](https://www.gov.uk/online-and-distance-selling-for-businesses/online-selling)
- [GOV.UK digital services VAT](https://www.gov.uk/guidance/the-vat-rules-if-you-supply-digital-services-to-private-consumers)
