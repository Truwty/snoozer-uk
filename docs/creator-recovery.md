# Creator sandbox recovery and release checks

Current implementation is sandbox-only. Do not enable selling from source-file existence or CI fixtures. Check PROGRESS.md for the actual deployed commit/migrations and provider evidence. Source16aba31/migrations72–76 are deployed as one coherent, tested slice; both new-purchase gates stay disabled during provider setup. Hosted migrations through76 are immutable.

## Durable intake and provider checks

Use a dedicated connected-account **snapshot** event destination and STRIPE_CREATOR_SANDBOX_WEBHOOK_SECRET at `/api/v1/commerce/stripe/webhook`, separate from premium billing. Match the installed SDK's stable API version2026-10-28.endive. Required test events: checkout.session.completed, checkout.session.async_payment_succeeded, checkout.session.async_payment_failed, checkout.session.expired, charge.refunded, charge.dispute.created/updated/closed and radar.early_fraud_warning.created/updated. Never subscribe a live endpoint or reuse a premium signing secret.

Raw signatures and sandbox/account/object boundaries are checked before storing a receipt. Only bound accounts for the pinned sandbox platform are accepted. Receipts contain provider references/times, not raw customer payloads. A204 means canonical processing/disposition was durably completed;503 requests provider retry. Canonical payment reads are always scoped to the connected account. The browser return cannot grant anything.

The existing approved key has onboarding permissions only. Before real testing, review the provider's actual scoped-key permission labels for Checkout creation/read, PaymentIntent/Charge reads (including expansions), disputes and early-fraud-warning reads with connected-account access. Keep existing account/link permissions; no transfer, payout, refund-write or live permission is required by this implementation. Creating/expanding access and copying credentials to Render requires the browser's action-time approval. Do not request that approval until the exact key/destination changes are prepared for review. Secrets stay out of chat, source, logs and local files.

## Bounded retry and diagnostics

`POST /api/v1/commerce/stripe/recover` requires the separate STRIPE_CREATOR_SANDBOX_RECOVERY_TOKEN (32+ random characters), compared with constant-time hashed bearer matching. It accepts `{}` for one eligible persisted receipt, `{"limit":2}` for a bounded batch (maximum10), or `{"id":"evt_..."}` to replay one stored receipt. It never accepts a browser payment status or arbitrary provider resource. Unknown/manual mismatched IDs return404; missing setup503; bad bearer401; invalid/oversized input400/413. The response contains only attempted/processed/failed counts. Any processing failure returns503 so an operator/job sees the failure; other items still run.

SQL claims lease/backoff before provider work. Delay doubles from one minute up to one hour. After ten automatic retry attempts, a still-pending receipt is held for operator review; an explicit ID replay remains available after its cooldown. Successful reprocessing does not extend the original paid/access timestamps or clear payment holds. Billing diagnostics shows pending/backoff/dead-letter/uncertain-order/held-order counts to the existing read-only billing-diagnostics role; it grants no write authority. Provider retries may also recover the receipt normally.

The optional GitHub workflow `creator-sandbox-reconciliation.yml` is disabled unless repository variable CREATOR_SANDBOX_RECOVERY_ENABLED is true. It needs CREATOR_SANDBOX_RECOVERY_ORIGIN and the dedicated token in repository Secrets matching Render. Its hourly request deliberately processes one receipt to fit bounded provider work on the free service. Workflow failure is an operational alert signal; delivery of GitHub notifications has not been verified. Large backlogs require explicit bounded draining; unresolved events are not silently discarded. Do not enable/configure the new credential or workflow without the required action-time access approval.

This retry path handles **persisted, signature-verified receipts**. A provider event never received by the endpoint must be resent using Stripe's test destination; do not fabricate a database receipt from a guessed event ID. A Checkout unbound beyond23hours cannot be recreated: use the real session event, matching metadata/account/creation window and canonical receipt recovery. Never delete/rebind the seller or grant access to escape an uncertain state.

## Retention and purchased files

`purge_creator_sandbox_history(100)` is service-only, bounded to100 orders and100 receipts. It removes only nonpending, unheld orders beyond retained_until with expired access, and only when that account has no unprocessed receipts. Pending attempts, held orders and linked unresolved history remain for review. Processed unlinked receipts require both received/processed times older than90days. Deleting an expired order does not delete the product/version/PDF; creators must separately withdraw/discard/remove once no order retains the version. No purchased file is physically deleted as a side effect of the history purge.

The reviewed operation `supabase/operations/schedule-creator-commerce-cleanup.sql` uses existing native pg_cron twice hourly; no Render worker or paid cron service. It is **not activated or proven** by adding the file. Apply only after migration76/retention review, inspect a natural successful run and an isolated expired fixture, then record the evidence. Registration alone is not execution. Its rollback removes only snoozer-creator-retention-v1. Pending/held retention and live privacy/legal policy remain Phase6/7 work.

## Required actual staging exit

1. Pass matching full CI, apply/track new migrations, deploy that exact source with new purchases off and verify health/roles/private UI.
2. The business owner completes Stripe's real credential/agreement step directly; recheck both current sandbox card-payment and payout capabilities. No invented email, password, identity or CAPTCHA bypass.
3. Prepare/approve the exact scoped-key expansion, connected-account test destination/signing secret and optional retry credential destinations. Keep premium/Ko-fi/live settings unchanged.
4. Resolve normal-browser PDF upload, inspect an isolated harmless PDF and attest only that frozen test fixture. Enable the two sandbox purchase gates for the controlled test, then explicitly publish that reviewed version.
5. Verify a real direct Checkout/session binding, duplicate resume, successful provider delivery, buyer receipt and exact-byte attachment; deny anonymous/foreign access. Verify partial/full refund and dispute/fraud holds, duplicate/out-of-order success, transient receipt retry, missing-delivery resend and expired access using isolated test controls rather than altering hosted clock data.
6. Withdraw the offer, disable new-purchase gates, confirm retained buyer access/history behavior, drain recovery and prove natural retention scheduling. Record exact provider IDs outside public payloads and no secrets. Never mark this exit complete from local mocks/disposable fixtures.

Live selling, production content scanning, legal/tax/operator facts, general refunds/case resolution, identity deletion/anonymization and final domain cutover remain unapproved launch work.
