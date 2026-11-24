# Snoozer Premium — LIVE payment acceptance evidence

**Checked 22 November 2026 UTC.** This is a release-gate record. The production Checkout switches remain **OFF**. A signed LIVE webhook has now been proven through the actual production endpoint; that is not a substitute for a real paid subscription or live customer entitlement acceptance.

## 0. Seller preferences confirmed by operator (22 November 2026)

- **Trading name:** Snoozer. **Declared structure:** UK sole trader. This is a trading name, **not a verified legal personal name**.
- **Public billing/support email:** `[configured email address]`.
- **UK VAT:** Operator states not VAT registered, reporting under £90,000 VAT-taxable turnover in any rolling 12-month period. **Self-declaration only**; this does not establish overseas VAT exemptions or tax compliance.
- **Intended buyer territory:** Worldwide. UK VAT registration threshold does not remove potentially applicable EU consumer digital-services VAT or other local sales taxes. Cross-border country obligations, registration and price/tax model **NOT REVIEWED OR APPROVED**. Stripe Tax remains disabled.
- **Refund preference:** No voluntary refunds, but **all legally required refunds, remedies and cancellation rights preserved** in Terms, Studio and Help. A blanket claim of "non-refundable under every circumstance" would be inaccurate.
- **Owner cannot perform a LIVE card purchase/refund**. Do not mark production paid entitlement, cancellation, failed-renewal or dispute scenarios as validated based on sandbox-only provider tests.
- **Still missing before approving seller disclosures:** The sole trader's legally identifying name and suitable business/geographical contact address (to be provided securely and displayed where required, not sent in chat). Do not invent or publish private address details.
- **2027 UK subscription updates:** UK subscription rules are scheduled to change on 1 January 2027; verify applicable commencement and prepare the renewal/cancellation/cooling-off processes before then.

Supporting official guidance: [GOV.UK online/distance selling](https://www.gov.uk/online-and-distance-selling-for-businesses/online-selling), [GOV.UK digital-services VAT](https://www.gov.uk/guidance/the-vat-rules-if-you-supply-digital-services-to-private-consumers), [EU non-Union One Stop Shop](https://vat-one-stop-shop.ec.europa.eu/one-stop-shop/register-oss_en), and [draft UK subscription rules commencement](https://www.legislation.gov.uk/ukdsi/2026/9780348287912/body).

## 1. Signed LIVE Stripe webhook — PASS

- Intended LIVE Stripe merchant: `[redacted Stripe account id]`; enabled destination `[redacted Stripe webhook id]` listens for 14 required event types at `[Render service URL]/api/v1/billing/stripe/live-webhook`.
- Created temporary **LIVE** Stripe customer `cus_Vfk94ILOLAjK7o` with **no payment method** and a 30-day trial subscription `sub_1UeOfaBYH85ysT1BwO3HVEVG`. Cancelled this trial **immediately**. No charge can recur on this cancelled trial.
- Stripe emitted real LIVE `customer.subscription.created` event `evt_1UeOfbBYH85ysT1BDd0IbVBv` and `customer.subscription.deleted` event `evt_1UeOffBYH85ysT1BZ9TTm1Wx`.
- Checked both events directly in Stripe: `livemode=true`, `pending_webhooks=0`.
- Queried the hosted `snoozer.premium_live_receipts` table by `object_id='sub_1UeOfaBYH85ysT1BwO3HVEVG'`: both LIVE event IDs persisted with non-null `processed_at` timestamps (00:30:18 and 00:30:20 UTC). The production webhook verifies its Stripe signing secret and LIVE/non-Connect status *before* writing any receipt, so these two processed receipts constitute a genuine end-to-end signed-delivery proof.
- Stripe LIVE invoice `in_1UeOfaBYH85ysT1B30ThVUq6` shows `amount_paid=0`, `total=0`, `amount_due=0`. Stripe charges filtered to probe customer: **0**. The subscription is `canceled`.
- The probe customer exists only in Stripe, **not** in Snoozer's user-to-Stripe customer mappings. No Premium entitlement was created or granted.
- Hosted `public.premium_live_preflight()`: `customers=0`, `currentSubscriptions=0`, `unprocessedReceipts=0`, six approved LIVE offers, `checkoutEnabled=false`, `legalReviewed=false`. A no-charge trial test must never be misrepresented as a paid Checkout test.

## 2. Actual Stripe TEST-mode provider lifecycle

All resources below used **the same Snoozer Stripe account in TEST mode**, not the LIVE merchant ledger. These API calls exercised the provider independently; they did **not** pass through the production Studio Checkout or make an end-user Supabase entitlement.

| Scenario | Result and proof |
| --- | --- |
| Test price/product | Created monthly £3 fixture `[redacted Stripe price id]` on `[redacted Stripe product id]`; both verified `livemode=false` and **archived/inactivated** after testing |
| Paid initial subscription | PASS. `sub_1UeOi7BYH85ysT1BCHEFiCif` was `active` after a successful test-token card charge with `payment_behavior=allow_incomplete`. Initial invoice `in_1UeOi7BYH85ysT1BrjSLQ88i`: `paid`, `amount_paid=300` pence, `billing_reason=subscription_create`; PaymentIntent `pi_3UeOi7BYH85ysT1B02dxLn9u` paid |
| Scheduled cancellation | PASS. Stripe accepted `cancel_at_period_end=true` and kept the sandbox subscription `active` with `cancel_at=current_period_end` |
| Immediate cancellation | PASS. The paid sandbox subscription is finally **`canceled`** and the earlier incomplete fixture `sub_1UeOhMBYH85ysT1B1F4zffZk` ended **`incomplete_expired`** |
| Refund | PASS. Test-only refund `re_3UeOi7BYH85ysT1B0eKyzGgx` was `succeeded`, `amount=300` pence, targeting the paid test PaymentIntent |
| Declined test card | PARTIAL. Stripe rejected `tok_chargeDeclined` at customer **source attachment** with `card_declined/generic_decline`. That proves provider decline handling, **not** a failed subscription renewal invoice |
| Provider-hosted Checkout | PARTIAL. Stripe created `[redacted Checkout session id]` with `mode=subscription`, `livemode=false`, amount £3. It was **open/unpaid** when checked; nobody completed the hosted payment form. The session has a short expiry and the test price was deactivated |
| Recurring renewal invoice | NOT PROVEN. A manual `billing_cycle_anchor=now` update did **not** produce a new invoice. Do not call this a real renewal. A test-clock advance or equivalent is still required |
| Failed renewal, dispute, 3DS | NOT PROVEN via real Stripe invoice/provider events in this session. Stripe API operations exposed here did not include test-clock advancement or automatic dispute creation; no real card was used |
| Production paid entitlement/revocation | NOT PROVEN. Prior [PR #35 CI](https://github.com/Truwty/snoozer-uk/actions/runs/44965938535) passed provider-mocked entitlement/replay/risk tests, but no actual paid Studio Checkout-to-Supabase journey happened |

No **LIVE** card charge, customer refund or live dispute was created. A real card payment/refund requires authorised cardholder interaction; no payment method should be supplied via this document or chat.

## 3. Remaining release requirements

1. **LIVE Checkout and user-to-entitlement acceptance:** Actual owner-approved payment through `/studio/plan`, correct £3/£6/£12 monthly or annual Price, matched signed Checkout completion and `invoice.paid`, verified paid charge and enabled plan in the *same signed-in user account*. Owner approval and an authorised payment method are required. Do not enable gates based on this no-charge webhook probe alone.
2. **Provider renewal and failure:** Execute Stripe test clocks in an appropriately linked sandbox integration and verify `invoice.paid`, `invoice.payment_failed`, 3DS/action-required states and Premium access/revocation. Test failed-collection recovery, duplicate and out-of-order webhook delivery. A test-mode provider result on a disconnected fixture does not establish production entitlement correctness.
3. **Dispute and fraud:** Simulate a test-mode dispute with Stripe's documented dispute card/test helpers, verify receipt and sticky hold, and confirm access removal. A live dispute must not be manufactured.
4. **Owner/seller review:** Verify actual seller identity/address/contact, recurring plan terms, refunds, cancellation/cooling-off disclosures and any relevant tax obligations. Stripe Tax automation may remain off, but does not negate independent obligations.
5. **Final gates:** After acceptance, run `npm run billing:live:preflight` with server credentials, independently review and enable `SNOOZER_PREMIUM_LEGAL_CONFIRMED`, database `legal_reviewed` and `checkout_enabled`, and server `SNOOZER_PREMIUM_LIVE_ENABLED`. Monitor live receipts, refunds, incidents and rollback.

**Launch decision:** signed LIVE webhook delivery **PASSED**; Stripe sandbox initial paid/cancel/refund **PASSED**; genuine LIVE paid subscription lifecycle and end-user entitlement acceptance **NOT COMPLETE**. Keep LIVE Checkout OFF.

## References

- [Stripe Billing testing](https://docs.stripe.com/billing/testing)
- [Stripe test clocks](https://docs.stripe.com/billing/testing/test-clocks)
- [Stripe signature verification](https://docs.stripe.com/webhooks/signature)
- [Stripe test cards and disputes](https://docs.stripe.com/testing)
- [UK government online-selling rules](https://www.gov.uk/online-and-distance-selling-for-businesses/online-selling)
- [UK VAT registration](https://www.gov.uk/register-for-vat)
