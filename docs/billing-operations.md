# Gift codes and billing diagnostics

Authorised operators can issue a single-use gift through the service-only issue_gift_code RPC. Pass the paid plan and catalogue version, gift duration in days, and redemption deadline. Keep the returned gift ID for support and share the returned code only with the intended recipient. The code is returned once and its hash is stored. Never put the code in a URL, ticket or shared log.

Recipients redeem in Studio under Plan and usage. Redeeming attaches the time-limited grant to the verified account. The effective plan still follows the normal grant precedence rules. An authorised operator can call revoke_gift_code with the gift ID to disable the code and revoke its associated grant if already redeemed. Gift issuance is an operator workflow. Paid gift Checkout remains open.

Run npm run billing:diagnostics with the server credential for the target Supabase project to inspect aggregate counts for Stripe sandbox subscriptions and holds, unclaimed Ko-fi receipts and reviews, and gift usage. The report excludes account IDs, transaction references and codes. A staff web dashboard remains open.
