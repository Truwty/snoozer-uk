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

- Additive migration `20261121042952_creator_affiliate_disclosures.sql` creates private `snoozer.creator_affiliate_disclosures` with RLS enabled and no direct Data API grants.
- `get_my_creator_affiliate_disclosure(uuid)` and `save_my_creator_affiliate_disclosure(uuid,integer,text,boolean)` run as empty-search-path SECURITY DEFINER functions, require `snoozer.verified_user()` to own the profile and can be called only by authenticated role. Writes lock the verified user's row and reject stale revisions, controls, oversized content and enabled empty text.
- `get_creator_sandbox_affiliate_disclosure(text)` is callable by anon/authenticated but returns only enabled text for a public store that already passes `get_creator_sandbox_store`. A store with no currently approved **reviewed offers** (including when all old reviews have expired), or an unavailable store, returns null; this is enforced by checking the canonical store projection has at least one listed version, not just a non-null JSON store object. Private disclosure text is never exposed in either case.
- This setting never changes product approval, billing, seller readiness, Stripe payments, order creation, revenue, download entitlements or risk holds.

## Verification and rollout

After correcting the SQL control-byte fixture and the empty-approved-store disclosure bug, [full CI #234](https://github.com/Truwty/snoozer-uk/actions/runs/44865966237) passed PGlite owner/private/public/expiry checks, typed schema, build and authenticated Playwright. Hosted Supabase migration successfully applied and recorded `20261121042952_creator_affiliate_disclosures`; source filename now matches. Verified grants and unchanged original payment records. Final-head [CI #239](https://github.com/Truwty/snoozer-uk/actions/runs/44866456576) passed; [PR #16](https://github.com/Truwty/snoozer-uk/pull/16) merged as `796763f` and Render deploy `dep-dc0ijdbm8hqs73el38j0` confirmed **Live** at 2026-11-21 05:20:10 UTC. Hosted read-only verification: one original paid order, one processed receipt, no pending receipts, zero saved disclosure rows, migration tracked and unchanged SQL checkout policy. Authenticated human production-domain browser check remains outstanding. Verify grants, source/hosted version parity, unchanged original £5 paid order and receipt, and exact SHA/Render deploy before marking this slice shipped. A human authenticated owner check on the live site is separate from CI browser proof.

Phase 5 still requires a separate real buyer, approved QA PDF and genuine refund/dispute/fraud plus failed-receipt recovery before commerce acceptance can close.
