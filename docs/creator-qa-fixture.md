# Creator Commerce — isolated sandbox PDF fixture setup

This is a **test-only** operator playbook. It creates no real product, order, payment, event, review approval or webhook. Do not use the original £5 paid order, its buyer, version, frozen PDF or Stripe charge.

## Faster authenticated Studio setup (latest)

A signed-in, confirmed creator can now open `/studio/products`, download the **same synthetic PDF bytes** using the **Download test PDF** link, and press **Fill sandbox QA draft** in the New product form. The button only fills the fields (title, synthetic description and £0.50 price); the creator still deliberately submits **Create product draft**, then uploads and freezes the file through the existing owner-only flows.

The Studio also displays the deterministic PDF byte count and reference SHA-256 so the owner can identify the downloaded fixture. **This is not proof of the frozen uploaded file**: the operator must separately hash and inspect the actual frozen bytes, and any disagreement must stop approval.

The PDF endpoint is `/studio/products/qa-fixture`. It is an attachment with `private, no-store`, `nosniff` and sandbox CSP; unauthenticated/unconfirmed sessions cannot retrieve it. This does **not** approve any QA offer or initiate a Checkout. Operators should still independently inspect the actual frozen PDF bytes and compare their SHA-256; do not assume a previously downloaded attachment's hash.

The original command-line generator described below remains supported, and both routes reuse its deterministic source content. Use either route, never both as separate approved products.

## 1. Generate and inspect a harmless exact-byte test PDF

From the repository root on Windows PowerShell:

```powershell
npm run commerce:qa:fixture
Get-FileHash .\test-results\creator-commerce\isolated-qa-fixture.pdf -Algorithm SHA256
```

The generator writes one deterministic, static, one-page PDF to `test-results/creator-commerce/isolated-qa-fixture.pdf`. It refuses to overwrite that path. It contains no customer data, forms, links, scripts or embedded files. The output directory is already excluded by `.gitignore`.

**Review the actual PDF before approval.** If you use a copy obtained from another source (including chat downloads that may receive provenance metadata), compute SHA-256 on those actual bytes; do not assume that a displayed hash is identical. The *frozen* version hash recorded by Supabase must agree with the **exact uploaded and inspected PDF**, not just with the source-code generator's hash.

This is harmless content for QA, **not** malware/content scanning or production content approval.

## 2. Create a separate private product in Studio

1. Sign in as an already-verified **creator/seller**, using the existing bound Stripe **test** account. The seller and buyer must be separate verified users.
2. In <https://www.snoozer.uk/studio/products>, create a **new** private draft, clearly named `Snoozer isolated sandbox QA (not for sale)`. Set the price to **£0.50** (the platform's existing lower limit) and a description identifying the synthetic fixture.
3. Upload this PDF through the existing *Product files* control. Check the upload reports **ready**; do not bypass pending/reservation cleanup.
4. Freeze a new immutable product version. Copy its newly generated version UUID from the link target of **Download private revision** (`/studio/products/version/<UUID>`) or an authorised DB read. **Do not select any version associated with the original £5 purchase.**
5. An operator must independently open/inspect the exact frozen file and compare SHA-256. Do not publish yet.

No new routes, schema changes or webhook bypasses are needed. All the Studio upload/freeze controls already exist.

## 3. Inspect the frozen version before approval — READ ONLY

In the **correct** Supabase project's SQL Editor, open:

`supabase/operations/inspect-creator-qa-fixture.sql`

Replace only the *all-zero version UUID* with the new version UUID; then run. The all-zero default returns **no rows** and is safe to run without a fixture.

Verify `creator_owner_id`, `frozen_sha256`, `frozen_bytes`, `ready_file_matches_snapshot=true`, `draft_archived=false`, `version_already_has_orders=false`, the test price/currency, and account binding. Compare the frozen hash with your independently inspected exact PDF. Any mismatch is **STOP**.

The previously approved but expired offer is **not** a substitute. Creating an entirely new product/version avoids reusing old immutable receipts and files.

## 4. Explicit manual operator review — controlled database write

Only after independent PDF review, exact SHA-256 comparison, validated new owner/version, explicit operator approval and confirmed test-only configuration, call the **already existing** service-only review RPC from the trusted SQL Editor (not from a user-facing page):

```sql
select public.review_creator_sandbox_fixture(
  '<NEW_CREATOR_OWNER_UUID>'::uuid,
  '<NEW_FROZEN_VERSION_UUID>'::uuid,
  '<SHA256_OF_INSPECTED_FROZEN_PDF>'
) as reviewed;
```

It should return `true`, storing one reviewed but **disabled** short-lived (24-hour) offer. Never hardcode credentials, automatically approve content, extend an expired review, modify the original paid order or grant general users review permission. This review attests a sandbox fixture only.

When the trusted operator has explicitly authorised the scoped test window and **both existing** new-Checkout gates are enabled, the verified creator can use the existing Studio offer form to **Publish reviewed test version**. Verify storefront discovery on the correct published profile and refresh current seller readiness. Do not enable live Stripe keys or live selling.

## 5. Buy, exercise genuine risk events, then close the window

A **different verified test buyer** completes a normal Stripe test-mode Checkout through the public store. This establishes a **new isolated sandbox order**. Verify its signed completion in Stripe Workbench and persisted processed receipt.

Use the existing read-only tools (no mock risk events):
- `npm run commerce:qa:inspect -- --project edgptbiwswcdmmxzwhxv --qa-order <NEW_ORDER_UUID>` checks canonical Stripe Checkout, seller, refund, dispute, early fraud warning and stored sticky holds.
- `supabase/operations/inspect-creator-commerce-risk-evidence.sql` verifies stored signed event receipt classes and hold consistency (substitute only that new order UUID).

For refund, full refund, dispute and fraud experiments, use **separate new QA orders** per scenario where available. Never refund or dispute the original £5 test purchase. Do not claim an early fraud warning occurred if Stripe does not provide a supported sandbox fixture.

**After** recording genuine provider evidence: the creator withdraws the QA offer, operator disables **only new Checkout** via the existing SQL policy and Render flag (with approval), and verifies already-paid unheld buyer access/webhooks/recovery remain intact. Do **not** disable the wider sandbox reconciliation flag. Any genuine failed-receipt scheduled retry remains a separate provider acceptance gate.

Production commerce, malware scanning, legal/tax and content-policy launch approval are **not** completed by this procedure.
