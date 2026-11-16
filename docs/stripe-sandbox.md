# Stripe sandbox setup

Apply the billing migrations in a disposable Supabase project. Set STRIPE_SANDBOX_WEBHOOK_SECRET server-side using the signing secret from a Stripe sandbox snapshot destination or from Stripe CLI forwarding. Leave it unset elsewhere. Forward to /api/v1/billing/stripe/webhook. The receiver validates the original request body and stores the event ID, type, timestamp and Stripe object ID. Stripe can resend a delivery safely. Storage failures return HTTP 503 so Stripe can retry. The receipt does not activate a plan.

For each approved sandbox offer, create a distinct Stripe Product per paid plan and a GBP recurring Price for each billing interval. Insert the Stripe Price ID, plan, catalogue version, interval, currency and integer pence amount in snoozer.stripe_sandbox_prices as the database owner. When replacing an offer, set retired_at and insert the replacement in one transaction. Retain old rows to reconcile existing subscriptions. Checkout and reconciliation are pending.

Sources: https://docs.stripe.com/webhooks and https://docs.stripe.com/products-prices/how-products-and-prices-work
