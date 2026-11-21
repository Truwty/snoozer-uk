# Creator Collections — sandbox-only catalogue groups

Implements master spec §13.3 as an editorial grouping layer over existing product drafts and the existing short-lived, reviewed Stripe **test**-mode offers. It is not a separate Checkout path, product approval system, or revenue entitlement.

## Seller journey

1. Sign into a verified account and open **Studio → Product drafts → Manage creator collections**. Collection pages are private and noindex.
2. Add up to **five** collections per profile. Each can contain up to **five** product drafts from the **same** profile, in the checkbox order. Name is 1–80 characters; description max 500 characters. Collections are private by default.
3. Optionally tick public visibility. A visible collection only appears in `/store/[username]` **when at least one included product has an independently approved, enabled, unexpired and currently eligible frozen offer**. Private drafts, archived products, expired reviews and disconnected sellers cannot appear through the collection path.
4. Update membership, label or visibility using optimistic revision checks. A conflicting stale edit must be reloaded before retrying. Delete a collection without deleting drafts, frozen PDFs, reviews, buyer purchases or download permissions.
5. Public collection entries link to the already-gated product detail URL. Buyers must still acknowledge sandbox mode, pass the existing independent buyer requirement, pay through Stripe test Checkout and be verified before download.

## Model / permissions

- Tables `snoozer.creator_collections` and `snoozer.creator_collection_products`, both RLS-enabled and with no direct Data API table grants. Collection ownership and profile scope are checked in verified-account SECURITY DEFINER RPCs with an empty search path.
- `list_my_creator_collections(uuid)` returns only the current verified owner's groups.
- `save_my_creator_collection(uuid,uuid,integer,text,text,boolean,uuid[],boolean)` serialises per-account operations, validates profile/product ownership, bounds length/count, rejects duplicate membership, checks revision and supports owner deletion. This never changes a product draft or payment record.
- `get_creator_sandbox_collections(text)` is public but joins collection membership **only to the frozen versions already admitted by `get_creator_sandbox_store`**, the canonical reviewed-offer projection. Returns only public titles, descriptions and version IDs. The storefront additionally intersects returned IDs with the reviewed offer list before rendering. No owner/buyer identifiers are returned.
- Collection metadata cannot reactivate expired reviews, override seller readiness, create an order, revive an archived draft, extend delivery or alter previously purchased PDF bytes.

## Tests / operational limits

- Positive and negative PGlite tests: owned creation and list, cross-owner and anonymous denial, unverified account denial, invalid/duplicate products and titles, stale revision conflict, public exposure of only eligible frozen offers, private switch, expiry and deletion.
- Schema tests validate capped lists and stripped private metadata; authenticated browser journey adds a group to an existing private draft and confirms it stays unapproved.
- Run full GitHub CI, inspect the migration version in the **hosted** Supabase migrations history before deployment, use `apply_migration` once, align the repository timestamp to the version Supabase records, and verify table grants and existing paid order/receipt are unchanged. Then manually deploy the exact passing app commit to Render (auto-deploy disabled).
- Until a genuine second-account QA checkout and signed refund/dispute/fraud plus failed-receipt retry are verified, Phase 5 remains OPEN. Existing original £5 paid order is never reused for destructive testing.
