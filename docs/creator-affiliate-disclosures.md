# Creator Affiliate Disclosures — sandbox storefront

This Phase 5 §13.13 slice gives a verified creator a private, owner-scoped way to publish an explicit affiliate/sponsorship disclosure on their *eligible test storefront*. It does not check or certify the truthfulness of the disclosure and does not automatically label individual affiliate products or constitute legal approval.

## User workflow

1. Open **Studio → Product drafts → Manage affiliate disclosure** while signed in with a verified account owning the current profile.
2. Enter an accurate disclosure of up to 500 characters. The text is private by default and can be saved with public visibility disabled.
3. Explicitly check **Display this disclosure on my eligible sandbox storefront** and save. Enabling requires nonempty visible text. Existing values use optimistic revision checks; reload after a stale-save conflict.
4. The public `/store/[username]` shows the disclosure when both the seller has enabled it and the canonical `get_creator_sandbox_store` RPC reports an eligible ready sandbox store. The public function returns only text, never owner ID, personal identity or private product data.
5. Turn off visibility to hide it without deleting the saved draft disclosure. Expired reviewed offers and disconnected sellers remain governed by the existing store gate.
6. Use clear advertising labels and follow applicable UK advertising, platform and tax rules separately. A free-text store-wide disclosure is not a substitute for prominent individual sponsored/affiliate identification where required.

## Schema and permissions

- Additive migration `20261121042000_creator_affiliate_disclosures.sql` creates private `snoozer.creator_affiliate_disclosures` with RLS enabled and no direct Data API grants.
- `get_my_creator_affiliate_disclosure(uuid)` and `save_my_creator_affiliate_disclosure(uuid,integer,text,boolean)` run as empty-search-path SECURITY DEFINER functions, require `snoozer.verified_user()` to own the profile and can be called only by authenticated role. Writes lock the verified user's row and reject stale revisions, controls, oversized content and enabled empty text.
- `get_creator_sandbox_affiliate_disclosure(text)` is callable by anon/authenticated but returns only enabled text for a public store that already passes `get_creator_sandbox_store`. An unavailable store returns null, not private disclosure data.
- This setting never changes product approval, billing, seller readiness, Stripe payments, order creation, revenue, download entitlements or risk holds.

## Verification and rollout

Run the full GitHub Actions pipeline including PGlite SQL cross-owner, anon, unverified, empty text, stale writes, enabled/disabled and expired-store checks, the typed-schema tests and authenticated browser journey. Apply once via the Supabase migration capability after CI is green, note the **actual hosted migration version** and align the local filename if it differs. Verify grants, source/hosted version parity, unchanged original £5 paid order and receipt, and exact SHA/Render deploy before marking this slice shipped. A human authenticated owner check on the live site is separate from CI browser proof.

Phase 5 still requires a separate real buyer, approved QA PDF and genuine refund/dispute/fraud plus failed-receipt recovery before commerce acceptance can close.
