# Stripe sandbox setup

Apply the billing migrations in a disposable Supabase project. Set STRIPE_SANDBOX_WEBHOOK_SECRET server-side using the signing secret from a Stripe sandbox snapshot destination or from Stripe CLI forwarding. Leave it unset elsewhere. Forward to /api/v1/billing/stripe/webhook. The receiver validates the original request body and stores the event ID, type, timestamp and Stripe object ID. Stripe can resend a delivery safely. Storage failures return HTTP 503 so Stripe can retry. The receipt does not activate a plan.

For each approved sandbox offer, create a distinct Stripe Product per paid plan and a GBP recurring Price for each billing interval. Insert the Stripe Price ID, plan, catalogue version, interval, currency and integer pence amount in snoozer.stripe_sandbox_prices as the database owner. When replacing an offer, set retired_at and insert the replacement in one transaction. Retain old rows to reconcile existing subscriptions. The sandbox Checkout flow is available from Plan and usage once the sandbox API key, webhook signing secret, service role and at least one current offer are configured.

Sources: https://docs.stripe.com/webhooks and https://docs.stripe.com/products-prices/how-products-and-prices-work

Use an isolated Stripe sandbox and a disposable Supabase project. Give the restricted sandbox API key permission to create Customers, read Prices, and create and retrieve Checkout Sessions. Store it in STRIPE_SANDBOX_API_KEY on the server. The account must have confirmed its email.

Each account can open one sandbox Checkout attempt. The database pins the original offer and binds one Stripe customer and session. A failed create can be retried with the original offer for 30 minutes. Once the session is bound, the app reopens it only while Stripe marks it open. Use a new disposable account for another checkout scenario until terminal-attempt handling is implemented.

The return page displays a pending message. The Plan and usage page reflects a sandbox grant once reconciliation succeeds. For a real sandbox run, confirm Stripe sends a signed event to the receipt endpoint and that the signed event references the session stored for the account.

With the API key set, a verified completion receipt triggers a server-side Checkout Session lookup. If the saved session, customer and account match Stripe, the receipt is marked bound and the Stripe subscription ID is recorded in the same database transaction. A transient API or database error returns 503. If a receipt has no saved session match, it stays unbound. After recovering the session binding, resend the event from Stripe Workbench. The binding records ownership only. Subscription status and invoice reconciliation can run after binding in an isolated test deployment.

For end-to-end tests, set STRIPE_SANDBOX_GRANTS_ENABLED=true in the isolated deployment. Add restricted read permissions for Subscriptions and Invoices. Grant eligibility requires an active, unpaused subscription with the original price and a paid invoice linked to the same subscription and customer. A scheduled cancellation caps expiry. Past due, incomplete, trial, unpaid and cancelled states revoke or withhold the sandbox grant. Temporary read failures return 503 for redelivery. Scheduled drift checks remain open.

## Billing Portal

Create a Billing Portal configuration in the same Stripe sandbox as Checkout and set its ID in STRIPE_SANDBOX_PORTAL_CONFIGURATION. Give the restricted sandbox key permission to create Customer Portal sessions. Enable invoice history, payment method changes and cancellation in that configuration. Leave plan switching disabled until price changes and proration are reconciled. After a completed Checkout has been bound, the Plan and usage page offers Manage sandbox billing. Verify the portal opens for that account, the return link lands in Studio, and cancellation triggers the expected webhook and grant change.

## Refunds and disputes

Enable charge.refunded, charge.dispute.created and radar.early_fraud_warning.created in the sandbox destination. Give the sandbox key read access to Charges, Disputes, Radar early fraud warnings, and Invoice Payments. Stripe objects are resolved through the charge and payment intent. A positive partial or full refund, dispute or early fraud warning places a hold on the affected sandbox invoice. A current held invoice loses access on reconciliation, and a later eligible paid invoice can restore it. Automatic dispute resolution and hold release remain pending. Test these flows with real sandbox events before using billing outside development.
