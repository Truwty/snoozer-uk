# Creator sandbox discount codes — §13.5 candidate

Status: implementation supplied for review; CI, hosted migration, deployment and real provider acceptance have not been performed.

- Exact frozen version, case-normalised ASCII code (3–24 chars), 1–90% off, 1–50 reservations, 1–30 days, 50 retained codes per seller. Disable permanently; no reuse of the same code on the same retained version.
- Integer arithmetic rounds the final charge down to whole pence, rejecting values below 50p. No client-provided amount, Stripe coupon or promotion code. The effective amount is snapshotted in the order and protected against updates; old orders fall back to their frozen version price.
- Service-only reservation shares the old merchant, policy, reviewed-offer, buyer, seller, order-quota and stock checks. Locks are acquired in the existing order. A failed reservation rolls back both stock and discount consumption. Resume ignores later code changes; each new reservation permanently consumes a redemption even if unpaid, expired or refunded.
- Purchase receipts, provider reconciliation and gross test analytics read the reserved amount. Existing access, webhook, refund and risk gates stay intact. No new real-money or tax capability.

## Test and release gates

Run lint, typecheck, unit/embedded SQL, disposable Supabase and Playwright using the existing CI workflow. Verify invalid/expired/exhausted/disabled codes, distinct buyer and version, cross-owner/anon/unverified denial, discounted receipt and analytics, simultaneous final-stock/last-code allocation and original reservation idempotency. Use a disposable database first. Do not replay source SQL manually on hosted Supabase; reconcile and track the migration through the established process. Apply the additive schema before deploying the app, after CI passes. Never change existing real checkout or review gates. Use only an independently approved sandbox PDF whose price permits a discount (the existing 50p QA fixture cannot be discounted). Preserve the original £5 purchase and receipt. A genuine discounted Stripe purchase, signed refund/dispute/fraud events, scheduled retry and human hosted verification remain outstanding.
