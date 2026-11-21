# Limited digital inventory — conservative test-mode allocation

Phase 5 master specification §13.4: a deliberately conservative **sandbox-only** limited-availability control for a frozen PDF product version. This is a hard **Checkout reservation cap**, not a count of settled sales or a refund/fulfilment entitlement.

## Seller workflow

1. Sign in as a verified owner. In Studio → Product drafts, open **Manage limited digital inventory**.
2. Each immutable frozen PDF version is **Unlimited** by default. Enter an integer from **1 to 50** to set a hard reservation cap, or leave blank to remove the cap before the first order attempt.
3. The cap is editable only **before any Checkout reservation exists** for that version. Once a buyer reserves an attempt, the cap becomes immutable to protect the original limited-edition promise and late payment reconciliation. The UI shows permanently reserved slots, not paid transactions. No capacity is automatically restored for cancelled, expired, refunded or disputed payments.
4. Reviewed and currently ready public sandbox store cards and product details show remaining unreserved slots. New Checkout controls disappear when there are zero slots. The database source-of-truth still enforces the cap on every new order under the existing seller lock; stale browser displays cannot oversell. A buyer may resume their **own existing** pending reservation without consuming a second slot. Existing purchase history/receipt navigation remains available.
5. If the cap is exhausted by a failed/abandoned Checkout, operator review is required. **There is currently no automatic refund/expiry restock, no admin override and no active release operation**. This favours fail-closed no-oversell over automatic restocking pending independent provider proof.

## Schema and privacy

- Additive `20261121053005_creator_sandbox_stock.sql` creates RLS-enabled `snoozer.creator_sandbox_stock` per frozen version with a durable, monotonic `reserved` counter. No direct Data API table grants. The counter is independent of the 90-day order retention policy. Deleting an unsold version/account cascades its unused counter.
- `list_my_creator_sandbox_stock(uuid)` and `set_my_creator_sandbox_stock(uuid,uuid,integer)` require verified, profile-owning authenticated accounts. The setter locks the seller user row, validates the exact version and denies edits once any reservation exists. No seller can alter another seller's stock.
- The existing **service-role-only** `reserve_creator_sandbox_order(uuid,uuid)` keeps its established verified buyer/seller, reviewed-offer, current seller readiness, billing policy and buyer order caps. It atomically increments limited stock **only after** the existing same-buyer idempotent resume check and **immediately before** inserting the new order; failure rolls back the slot increment. A sold-out version raises `P1222`. No existing paid order is modified.
- `get_creator_sandbox_stock(text)` is anonymous-readable, but only projects remaining counts for versions already admitted by the canonical `get_creator_sandbox_store` reviewed-offer projection. No buyer IDs, seller account IDs, private drafts, checkout sessions, payment IDs or unreviewed versions leave this endpoint.
- The inventory edit/page is private and noindex. Public "sold out" messaging is advisory; database reservations are authoritative and can race.

## Tests and acceptance

- Migration-backed PGlite cases: unrestricted default, cap 1–50 and invalid bounds, verified-owner and foreign/anonymous/unverified denial, public-only currently reviewed versions, exact seller lock/atomic allocation, same-buyer pending retry idempotency, second verified buyer sold-out rejection, version locked after its first attempt, and **no restock on expired Checkout**.
- Schema tests enforce bounded counters, nonnegative remaining and strip private identities. A Playwright owner journey validates empty state and navigation; production build, lint, types and the full browser suite must pass.
- Initial [CI #247](https://github.com/Truwty/snoozer-uk/actions/runs/44870897821) passed the full lint, types, PGlite SQL, production build and Playwright suite after one test harness permission fix caught by CI #246. Supabase applied and tracked version `20261121053005`; source filename matches. Hosted grants verified: authenticated owner read/write true, anon owner read/write false, anon public reviewed-stock read true, **service_role-only** reservations true. Stock table has zero configured limits; the one original paid £5 order and processed signed receipt are unchanged. Await final-head CI on filename alignment, merge, Render deployment and a separate authenticated human hosted-browser check.
- Real second-account sandbox payment, provider refunds/disputes/fraud events and actual receipt scheduled retry are **still not proven** by synthetic SQL tests. No live limited-item commerce, stock release after provider-confirmed failure or production safety certification is enabled.

This conservative approach prevents checkout overselling across late-payment/recovery edges **at the cost of never automatically returning abandoned attempts to inventory**. Automated release requires a separately designed, provider-verified irrevocable-expiry protocol and concurrency tests.
