# Creator-commerce buyer support — Phase 5

Private verified-buyer support requests are scoped to a retained PDF order or a recurring test membership. Create a case at /studio/support or from Purchases or Memberships. A case is never proof of payment, entitlement or refund; it cannot release a fraud hold. No card, payment intent, customer ID or credential is stored in a case. Buyer history and staff responses are visible only to that buyer.

## Staff assignment and operations

The snoozer.creator_support_staff allowlist is initially EMPTY. An authorised database operator must independently verify support staff identity and grant only the required account UUID with a controlled service-side database change. Do not add any default owner ID, allowlist all users, or reuse billing_diagnostics as the support role.

Once approved, staff use /studio/support/staff to read up to 50 oldest open cases and submit a single private response. An append-only database audit row records each queue read and reply, visible only to database operators. The buyer can close a case in /studio/support. No email is sent on response; there is no automatic notification, assigned SLA, escalation rota, webhook or off-site ticket export. Human staff must check the queue regularly and provide a monitored fallback mailbox before claiming support operations complete.

Each buyer is capped at three new cases per rolling 24 hours, five unresolved cases and 40 retained cases. An existing unresolved case for the same reference and issue is returned idempotently, without replacing the original message. Text is bounded at 20–1,500 characters. Reference ownership is checked by snoozer.verified_user and the retained order/subscription; every table has RLS and no client grants. Audited reads and replies are staff-only RPC. No support action updates creator order, subscription, invoice, refund, dispute, entitlement, delivery or Stripe state.

## Release evidence and limits

Full CI must pass SQL, unit, build and browser stages before applying a single new additive migration to hosted Supabase. Align source filename to recorded history. Verify no staff users, no cases, the historical paid PDF and its processed event unchanged, authenticated buyer-only RPC, anonymous and direct table read denied, then deploy main to Render. Operator staffing and real buyer/staff acceptance remain independent.

## Buyer support cases — tested source and hosted schema (21 Nov 2026)

[PR #22](https://github.com/Truwty/snoozer-uk/pull/22) merged into main at 9769244 after [full CI #44927006391](https://github.com/Truwty/snoozer-uk/actions/runs/44927006391) passed lint, types, unit/PGlite SQL, disposable Supabase, production build and Playwright. Hosted additive support migration 20261121165902_creator_support_cases applied successfully. Verified: zero buyer cases, zero staff assignments, authenticated buyer-only intake RPC, anonymous intake denied, no direct table or audit-log read, original one paid PDF order and processed receipt retained, recurring Checkout gate false. No real staff member has been assigned or monitored response rota established; human buyer/staff acceptance and Render deployment pending. Support case messages and replies never change payment or entitlement states. Phase 5 remains OPEN.
