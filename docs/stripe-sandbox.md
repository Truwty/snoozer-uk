# Stripe sandbox — isolated test environments only

**Reviewed:** 27 November 2026

**TEST MODE ONLY — ISOLATED SANDBOX ENVIRONMENTS**

This guide is for disposable development/QA environments. It does not describe Snoozer's live subscription system. Never use test-mode configuration, test Price IDs, sandbox receipts or test grants to change a production account's entitlements. The live Snoozer-owned Plus, Pro and Studio subscription path is documented separately in [Premium LIVE operations](premium-live-launch.md). The operator has confirmed that live payments and subscriptions work; preserve that configuration during general maintenance.

Apply the billing migrations in a disposable Supabase project. Set `STRIPE_SANDBOX_WEBHOOK_SECRET` server-side using the signing secret from a Stripe sandbox snapshot destination or Stripe CLI forwarding. Leave it unset elsewhere. Forward to `/api/v1/billing/stripe/webhook`. The receiver validates the original request body and stores the event ID, type, timestamp and Stripe object ID. Stripe can resend a delivery safely. Storage failures return HTTP 503 so Stripe can retry. The receipt does not activate a live plan.

Sandbox Checkout grants are permitted only when `STRIPE_SANDBOX_GRANTS_ENABLED=true` is set on an isolated test deployment connected to a disposable test database. The app rejects live Stripe API keys in the sandbox configuration. Never point sandbox grant tests at the production Supabase project or use a production Stripe account.

For each approved sandbox offer, create a distinct test Product per plan and a GBP recurring test Price for each billing interval. Insert the Stripe test Price ID, plan, catalogue version, interval, currency and integer pence amount in `snoozer.stripe_sandbox_prices` as the database owner. When replacing an offer, set `retired_at` and insert the replacement in one transaction. Retain old rows to reconcile existing test subscriptions. The sandbox Checkout flow is available from Plan and usage once the sandbox API key, webhook signing secret, service role and at least one current offer are configured.

Sources: [Stripe webhooks](https://docs.stripe.com/webhooks) · [Stripe Products and Prices](https://docs.stripe.com/products-prices/how-products-and-prices-work).

## Sandbox Checkout and reconciliation

Each account can have one current sandbox Checkout attempt. The database pins the original offer and binds one Stripe customer and session. A failed create can be retried with the original offer for 30 minutes. Once the session is bound, the app reopens it only while Stripe marks it open. After Stripe confirms an unpaid session has expired, the next Checkout request starts a new attempt with the same test customer and preserves the expired attempt in history. A linked subscription blocks replacement until Stripe reports it canceled or `incomplete_expired`.

The return page displays a pending message. The Plan and usage page reflects a sandbox grant once reconciliation succeeds. For a real sandbox run, confirm Stripe sends a signed event to the receipt endpoint and that the signed event references the session stored for the test account.

With the test API key set, a verified completion receipt triggers a server-side Checkout Session lookup. If the saved session, customer and test account match Stripe, the receipt is marked bound and the Stripe subscription ID is recorded. A transient API or database error returns 503. If a receipt has no saved session match, it stays unbound. After recovering the session binding, resend the event from Stripe Workbench. The binding records ownership only. Subscription status and invoice reconciliation run after binding in the isolated test deployment.

For end-to-end tests, set `STRIPE_SANDBOX_GRANTS_ENABLED=true` in the isolated deployment. Add restricted read permissions for Subscriptions and Invoices. Grant eligibility requires an active, unpaused test subscription with the original Price and a paid invoice linked to the same subscription and customer. A scheduled cancellation caps expiry. Past due, incomplete, trial, unpaid and cancelled states revoke or withhold the sandbox grant. Temporary read failures return 503 for redelivery.

## Sandbox Billing Portal, risk events and recovery

A Billing Portal configuration must be in the same Stripe sandbox as Checkout. Set its ID in `STRIPE_SANDBOX_PORTAL_CONFIGURATION`. Use restricted test-key permissions and enable invoice history, payment method changes and cancellation. Keep plan switching disabled until Price changes and proration are reconciled.

For tests, configure the sandbox webhook for `charge.refunded`, dispute and early-fraud events. A verified refund, dispute or early-fraud warning creates a hold on the affected sandbox invoice. A current held invoice loses access on reconciliation; a later eligible paid invoice can restore it. Never manufacture a live dispute or risk event for a test.

Missed events can be recovered through `/api/v1/billing/stripe/recover` using a separate high-entropy `STRIPE_SANDBOX_RECOVERY_TOKEN`. Keep the test key and recovery token in an operator secret store. An HTTP 204 means the verified provider event went through sandbox receipt handling. Automated recovery and reconciliation are opt-in and should remain on the isolated test project.

## Local webhook fixtures

The disposable Supabase browser suite posts fabricated Stripe snapshot and Ko-fi donation payloads to the actual Next.js webhook endpoints. CI generates dedicated fixture signing values and does not use a Stripe API key. The test checks invalid proofs, duplicate requests and a single durable receipt for each provider.

To run the fixture locally, start disposable Supabase as described in [Supabase setup](setup-supabase.md). Set `STRIPE_SANDBOX_WEBHOOK_SECRET` to a fixture value beginning with `whsec_`, `KOFI_WEBHOOK_TOKEN` to a random fixture token, and `SNOOZER_TEST_LOCAL_SUPABASE=1`. Leave `STRIPE_SANDBOX_API_KEY` unset. Rebuild, then run `npm run test:e2e -- -g "sandbox payment webhook fixtures"`.

## Final rule

Every command in this guide must target a disposable Supabase project and Stripe test mode. Check both provider account and Supabase project before sending a test event. Never copy a LIVE API key, Price ID or customer record into a sandbox fixture.
