# Creator Commerce — isolated sandbox risk-event verification

> 21 November 2026 — pending live provider execution. This is an operator test protocol, **not** evidence that refund/dispute/fraud events have been received. Do not enable live selling or reuse the original successful £5 buyer order.

## Verified baseline

- Genuine signed test Checkout snapshot delivery recovered in Stripe Workbench with **HTTP 204**, and hosted Supabase contains its exact persisted/processed receipt. Original paid order remains untouched and has unexpired buyer access.
- Connected test seller and ten-event snapshot destination are configured. No new refund, dispute or fraud delivery/hold has yet been verified.
- Source and SQL already fail closed on unknown sellers, mismatched payment/charge identities, unrelated connected-account payments and absent canonical proof. Sticky holds cannot be cleared by late success receipts.
- This change adds test coverage for all six subscribed risk signal variants, one-penny partial and full refunds, provider scope failures, terminal dispute/fraud updates, access revocation and preserved original timestamps.
- A green CI validates *mocked provider data and disposable PostgreSQL only*. Separate signed Stripe events and real buyer download denial must still be tested in the actual sandbox.

## Preparing a new reviewed, harmless QA product

Use [the isolated QA PDF generator and operator review guide](creator-qa-fixture.md). It provides an inert static PDF, verifies its exact SHA-256 against a newly frozen private product snapshot using [a read-only SQL query](../supabase/operations/inspect-creator-qa-fixture.sql), and preserves the existing **manual**, 24-hour service-only review and owner publication controls. It does not create offers/payments by itself or reuse the expired review or original paid order.

## Operator preflight (separate isolated purchase only)

1. Confirm the **correct Snoozer test platform** (Stripe Workbench sandbox `New business`), connected seller, bound Supabase project and deployed Render source commit. Never use any live Stripe account.
2. Keep the **original £5 order, its receipt, its file/version, its payment IDs, its paid/access timestamps and its buyer identity unchanged**.
3. Create a *new harmless PDF and reviewed, short-lived QA offer* under a separate test seller/buyer combination. The existing QA offer was expired on 20 Nov and must **not** be silently renewed or republished. A deliberate QA approval is required before opening either new-purchase gate.
4. Use Snoozer's normal **isolated test Checkout** flow with the sandbox payment method and verify the new order is recorded as paid and buyer can download the correct file. Record the new order UUID and provider event IDs in an access-controlled test log, not a public PR.
5. Verify the new Checkout's signed `checkout.session.completed` delivery returns 204 and the corresponding receipt is processed in hosted Supabase. Missing deliveries must be resent through Stripe Workbench, not fabricated in SQL.

## Separate signed-risk scenarios

Run each scenario against its **own independent new test order**, unless the scenario specifically tests repeated signals on the *same* isolated order. Do **not** create a refund, dispute or fraud warning on the original paid purchase.

| Scenario | Genuine provider action | Expected Snoozer result |
| --- | --- | --- |
| Partial refund | Refund a small amount of the new test charge in the connected seller's test-mode Dashboard | `charge.refunded` event processed; `refund` hold set; buyer download denied immediately |
| Full refund | Refund a **different** isolated paid test charge in full | `refund` hold set; original `paid_at` and `access_until` preserved |
| Dispute creation/updates | Use a Stripe-supported **test-mode dispute** workflow on another isolated test charge | `charge.dispute.created/updated/closed` events processed; `dispute` hold persists through closed event |
| Early fraud warning | Use a Stripe-supported test-mode early-fraud-warning fixture if available for the connected account | `radar.early_fraud_warning.created/updated` processed; `fraud` hold persists; buyer download denied |
| Out-of-order/repeated success | Resend the isolated order's original completion delivery **after** its risk event | Duplicate receipt acknowledged without restoring access or extending purchase timestamps |
| Cross-account / bad signature | Unit-test fixture only, **not forged traffic to the hosted endpoint** | Invalid signatures, mismatched connected account, charge or foreign seller rejected; no buyer entitlement granted |

If the current Stripe sandbox does not support generating a particular event category, mark that scenario **blocked**, not passed. Do not mutate webhook receipts, change the hosted clock, manufacture provider event IDs, or grant extra API permissions to work around it.

## New read-only provider check for an isolated order

The script `scripts/creator-commerce-qa-inspect.mjs` checks an **existing NEW isolated test order** against the actual Stripe sandbox API and the private service-role order read RPC. It does **not** create, refund, update, retry, or delete anything. It checks the exact project, bound connected account and canonical Checkout/payment/charge, then lists test disputes and early-fraud warnings and compares those risk signals with Snoozer's persisted sticky holds.

Only run in the intended operator environment with the *test* Stripe API key and Supabase service role credential already configured in `.env.local`. Never commit these credentials or run the command in a browser:

```powershell
npm run commerce:qa:inspect -- --project edgptbiwswcdmmxzwhxv --qa-order <NEW_ISOLATED_ORDER_UUID>
```

The command fails closed on mismatched project/Stripe account, missing or live-mode charge evidence, incomplete provider risk pages or a provider signal lacking its matching stored hold. If no actual risk event exists, it returns a **blocked** exit code; it does not invent success. It deliberately omits buyer identities, Stripe IDs, URLs and credentials from its output. The report checks the *current* Stripe risk view and the stored hold; it does **not** prove the signed event reached the receipt table. For that, use the existing [read-only isolated-order receipt report](../supabase/operations/inspect-creator-commerce-risk-evidence.sql) together with Stripe Workbench delivery evidence.

## Read-only hosted verification

Replace only `<ISOLATED_ORDER_UUID>` with the *new* test order's UUID. Run in the correct Snoozer Supabase SQL Editor as an authorised operator:

```sql
select state, holds, paid_at, access_until,
       checkout_id is not null as checkout_bound,
       payment_id is not null as payment_bound,
       charge_id is not null as charge_bound
from snoozer.creator_sandbox_orders
where id = '<ISOLATED_ORDER_UUID>'::uuid;

select id, type, processed_at is not null as processed, retry_count
from snoozer.creator_sandbox_receipts
where order_id = '<ISOLATED_ORDER_UUID>'::uuid
order by occurred_at, id;
```

Confirm `state='paid'`, correct sticky holds, unchanged `paid_at`/`access_until`, `processed=true` on each real risk event. Use an independent, authenticated buyer session to verify the protected download becomes **unavailable**; the creator, a different signed-in user and an anonymous visitor must never gain purchase access. Verify owner-only diagnostics disclose counts, not private buyer data.

## Recovery and shutdown exit

After a deliberately induced **recoverable and persisted** event processing failure on an *isolated* test order, observe actual `retry_count`, `next_attempt_at` backoff, scheduled retry execution and eventual `processed_at`. A manual Stripe resend is not proof of automatic retry.

Once all tests are recorded, withdraw the new reviewed test offer and disable the **new Checkout** gates through the authorised operator. Do **not** disable `SNOOZER_CREATOR_SANDBOX_ENABLED`, which existing webhook processing and paid buyer refresh still require. Verify a new Checkout is refused while previous paid/unheld buyer access and future dispute/refund webhooks continue to function.

Production payouts/payments remain unapproved until file scanning, legal/tax/operational policy and moderation are reviewed.

**Official Stripe reference:** [Testing disputes](https://docs.stripe.com/disputes/testing) · [Stripe events](https://docs.stripe.com/api/events/types) · [Refunds](https://docs.stripe.com/refunds).
