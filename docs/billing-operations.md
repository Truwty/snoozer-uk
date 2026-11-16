# Gift codes and billing diagnostics

Authorised operators can issue a single-use gift through the service-only issue_gift_code RPC. Pass the paid plan and catalogue version, gift duration in days, and redemption deadline. Keep the returned gift ID for support and share the returned code only with the intended recipient. The code is returned once and its hash is stored. Never put the code in a URL, ticket or shared log.

Recipients redeem in Studio under Plan and usage. Redeeming attaches the time-limited grant to the verified account. The effective plan still follows the normal grant precedence rules. An authorised operator can call revoke_gift_code with the gift ID to disable the code and revoke its associated grant if already redeemed. Gift issuance is an operator workflow. Paid gifting in Stripe sandbox is described below.

Run npm run billing:diagnostics with the server credential for the target Supabase project to inspect aggregate counts for Stripe sandbox subscriptions and holds, unclaimed Ko-fi receipts and reviews, and gift usage. The report excludes account IDs, transaction references and codes. The same aggregate report is available to authorised staff in Studio.

## Staff access

The database owner can assign the read-only billing_diagnostics role by inserting the verified account UUID and role into snoozer.staff_roles. Remove that row to revoke access. The user then sees Billing diagnostics on the Plan and usage page. Every successful web read records the actor and time in snoozer.billing_diagnostics_access. The role does not allow changes to subscriptions, gifts, donations or other staff roles. The existing service-only command remains available for operational use.

## Stripe sandbox paid gifts

Apply migration 20261110003800 to the isolated sandbox project. Create a one-time GBP Stripe Price for each gift product. Configure its price ID, integer pence amount, paid tier, catalogue version and gift duration in snoozer.stripe_sandbox_gift_offers. Retire prices by setting retired_at and preserve their historical rows. The existing sandbox API and signing keys and STRIPE_SANDBOX_GRANTS_ENABLED are required. The restricted key needs Checkout Session, Price and PaymentIntent access appropriate to the flow.

Set a stable STRIPE_SANDBOX_GIFT_KEY to 32 random bytes encoded as 64 hex characters, stored as a server secret. Maintain it while unredeemed paid gifts exist, since it derives the original code. The app checks the derived code against the stored hash before showing it to the purchaser. Codes expire if unredeemed for one year. Purchasers start test Checkout from Studio and share a confirmed code privately with the recipient.

Verify a sandbox purchase, delayed payment confirmation, redemption by a different account and a refund after redemption. The signed event must resolve to the stored buyer, session, price, amount, and payment. Positive partial or full refunds, disputes and early fraud warnings hold the payment and revoke any issued gift grant. A won dispute releases its own new gift payment hold. This can restore redemption or the original unexpired grant. Other holds and operator revocations still apply. Older holds remain in manual review because their original revocation cannot be attributed safely. If a hold previously blocked issuance, replay the completion event after the resolution is recorded. Use operator replay after recovering a missed event and keep the sandbox separate from live billing.

## Legacy payment holds

Run npm run billing:diagnostics -- --legacy-holds against the isolated database to list up to 50 unresolved holds recorded before hold reasons were separated. Continue with the last returned cursor as the next argument. The output contains provider object references and belongs in the operator workspace. Compare each reference with Stripe sandbox payment history, including refunds, disputes and fraud events. Legacy holds stay in place until a case-specific decision is verified. The command is read-only.

The sandbox diagnostics distinguish Checkout receipts that match neither billing workflow from known gift orders awaiting fulfillment. The latter count includes orders with an unpaid or held Checkout receipt. Inspect the payment status in Stripe before replaying a receipt.

The Plan and usage screen shows the limits currently enforced by Studio. Studio enforces link allowances of 20 for Free, 100 for Plus, 500 for Pro and 2,000 for Studio. Publishing and restoring an over-limit revision are blocked. After a downgrade, the current public page and draft links remain intact. A draft can retain its exact existing list while editing other fields. Bring the link count under the limit before saving changes to the list or publishing. Multiple profiles and paid storage allowances remain pending.
