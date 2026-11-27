# Snoozer Premium — LIVE payment acceptance

**Last updated:** 27 November 2026

## Current operating status

**Operator confirmed working**

The owner has explicitly confirmed that Snoozer's live payments and subscriptions are working. This is the current operational instruction and supersedes older entries in this document that described LIVE Checkout as disabled or instructed the team to keep the payment gates off.

Do not disable Checkout, change live subscription prices, alter Stripe credentials/webhook configuration or change payment gates during general security/documentation work. A billing change must be explicitly requested and handled as a dedicated, tested change.

The assistant's connected-provider checks confirmed the configured LIVE Snoozer Premium products/prices and webhook setup. This audit did **not** create a new live charge, refund, subscription or dispute. It does not claim to have independently replayed the customer's entire payment history. The owner's confirmation is recorded as an operator attestation.

## Approved subscription catalogue

The active product model is Snoozer-owned Premium only:

| Plan | Monthly | Annual |
| --- | ---: | ---: |
| Snoozer Plus | £3 | £30 |
| Snoozer Pro | £6 | £60 |
| Snoozer Studio | £12 | £100 |

There are six approved recurring LIVE GBP prices. The authoritative current Stripe Price IDs, Product mappings and policy flags are in [premium-live-launch.md](premium-live-launch.md) and the Stripe account. Do not create replacement prices or copy credentials into this document.

Creator seller onboarding, creator marketplace Checkout and Stripe Connect are retired. Historical sandbox records and migrations remain for audit; they do not define the current paid product.

## Billing safeguards in source

The current implementation includes:
- Raw-body Stripe signature verification with a bounded request body.
- LIVE-mode and configured platform-account checks.
- Provider read-back for Checkout, subscription and invoice objects.
- Explicit owner/customer/session/attempt binding.
- Idempotent event receipts and reconciliation.
- Refund, dispute and fraud holds.
- A separate token-protected recovery endpoint.

Primary source: `src/lib/premium-live-service.ts`, `src/lib/premium-live-webhook.ts`, `src/lib/premium-live-reconciliation.ts`, `src/app/api/v1/billing/stripe/live-webhook/route.ts`.

## Operational checks

Use the existing read-only preflight in an authorised operator environment:

```bash
npm run billing:live:preflight
npm run billing:live:key-check
```

These scripts check configuration and provider state; they do not create charges or prove a new customer's purchase journey. Never paste secrets or customer payment details into a ticket, public issue or chat.

For ongoing assurance, monitor:
- Checkout completion and signed webhook receipt processing.
- Subscription binding and entitlement reconciliation.
- Renewal invoices and payment failures.
- Cancellation and Billing Portal behaviour.
- Refund, dispute and early-fraud holds.
- Email receipts, customer support and privacy requests.

Do not perform real test charges/refunds on a customer account. Use a separate authorised test process and the provider's supported test facilities.

## Historic evidence

The 22 November 2026 record below this section described a no-payment-method LIVE trial and disconnected sandbox tests. It remains useful as historical evidence of signature verification and sandbox behaviour, but it is not the current operating status and must not override the owner's 27 November confirmation.

## Consumer/legal review

Keep customer-facing recurring price, renewal, cancellation, contact and refund wording accurate. A preference against voluntary refunds does not remove mandatory statutory rights. Stripe Tax being disabled does not establish that no tax obligations apply. Cross-border sales, consumer disclosures and future UK subscription-rule changes require qualified review; this document is not legal or tax advice.

## References

- [Stripe Billing subscriptions](https://docs.stripe.com/billing/subscriptions/overview)
- [Stripe API keys](https://docs.stripe.com/keys)
- [Stripe webhooks](https://docs.stripe.com/webhooks)
- [GOV.UK online and distance selling](https://www.gov.uk/online-and-distance-selling-for-businesses/online-selling)
