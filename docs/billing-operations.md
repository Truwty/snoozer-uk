# Gift codes and billing diagnostics

Authorised operators can issue a single-use gift through the service-only issue_gift_code RPC. Pass the paid plan and catalogue version, gift duration in days, and redemption deadline. Keep the returned gift ID for support and share the returned code only with the intended recipient. The code is returned once and its hash is stored. Never put the code in a URL, ticket or shared log.

Recipients redeem in Studio under Plan and usage. Redeeming attaches the time-limited grant to the verified account. The effective plan still follows the normal grant precedence rules. An authorised operator can call revoke_gift_code with the gift ID to disable the code and revoke its associated grant if already redeemed. Gift issuance is an operator workflow. Paid gifting in Stripe sandbox is described below.

Run npm run billing:diagnostics with the server credential for the target Supabase project to inspect aggregate counts for Stripe sandbox subscriptions and holds, unclaimed Ko-fi receipts and reviews, and gift usage. The report excludes account IDs, transaction references and codes. The same aggregate report is available to authorised staff in Studio.

## Staff access

The database owner can assign the read-only billing_diagnostics role by inserting the verified account UUID and role into snoozer.staff_roles. Remove that row to revoke access. The user then sees Billing diagnostics on the Plan and usage page. Every successful web read records the actor and time in snoozer.billing_diagnostics_access. The role does not allow changes to subscriptions, gifts, donations or other staff roles. The existing service-only command remains available for operational use.

## Stripe sandbox paid gifts

Apply migration 20261110003800 to the isolated sandbox project. Create a one-time GBP Stripe Price for each gift product. Configure its price ID, integer pence amount, paid tier, catalogue version and gift duration in snoozer.stripe_sandbox_gift_offers. Retire prices by setting retired_at and preserve their historical rows. The existing sandbox API and signing keys and STRIPE_SANDBOX_GRANTS_ENABLED are required. The restricted key needs Checkout Session, Price and PaymentIntent access appropriate to the flow.

Set a stable STRIPE_SANDBOX_GIFT_KEY to 32 random bytes encoded as 64 hex characters, stored as a server secret. Maintain it while unredeemed paid gifts exist, since it derives the original code. The app checks the derived code against the stored hash before showing it to the purchaser. Codes expire if unredeemed for one year. Purchasers start test Checkout from Studio and share a confirmed code privately with the recipient.

Verify a sandbox purchase, delayed payment confirmation, redemption by a different account and a refund after redemption. The signed event must resolve to the stored buyer, session, price, amount, and payment. Positive partial or full refunds, disputes and early fraud warnings hold the payment and revoke any issued gift grant. Automatic release on dispute resolution remains open. Use operator replay after recovering a missed event and keep the sandbox separate from live billing.
