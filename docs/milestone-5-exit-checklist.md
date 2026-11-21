# Phase 5 release acceptance checklist

> **SUPERSEDED 21 November 2026:** The owner retired third-party creator commerce. These historic acceptance items are no longer a product roadmap or permission to re-enable seller features. Only Snoozer Premium is to be sold; see docs/CONTINUE.md.

## Engineering release confirmed — 21 November 2026

- [x] PR #22 — private buyer support cases, restricted staff queue, per-access audit; hosted schema 20261121165902; final CI 44927569033; released to Render.
- [x] PR #23 — isolated creator Ko-fi donation notifications, per-owner digest and currency-preserving read; hosted schema 20261121171537; CI 44929130375; Render Live dep-dc0t65avcj2c73bmi050. These notifications are not settled revenue.
- [x] PR #24 — verified buyer-only, seller-scoped Stripe **TEST** invoice PDF handoff; CI 44930365915; included in later Render releases.
- [x] PR #25 — audited product moderation and permanent version quarantine, hosted schema 20261121173803; no moderators assigned by default.
- [x] PR #26 — conservative active-PDF static checks at private upload, frozen-version validation and each buyer PDF download; full main CI 44931904741; exact main 899a933 deployed Render Live 2026-11-21 17:53:24 UTC in dep-dc0tka6c6qcc73fdphog.
- [x] Historical test paid order and webhook receipt retained. Recurring checkout policy remains disabled. Anonymous and client-direct access to sensitive commerce/moderation tables remains denied.

## Release acceptance still OPEN — do not bypass

- [ ] Independent **real sandbox seller and buyer**: approved product, refreshed seller readiness, verified separate buyer, genuine Stripe TEST checkout, signed provider event, payment/cancel/refund/dispute/fraud warning, failed-event reconciliation, private download and immutable balance verification. No fabricated buyer purchases or inferred webhook delivery.
- [ ] Recurring membership end-to-end provider test: independently approved membership offer, real TEST subscriber, renewal, failed invoice, cancellation and provider risk events; check that risk holds prevent benefits. SQL policy and server flag must stay disabled until the operator approves the staged test and all gates are verified.
- [ ] Creator Ko-fi sender-side owner test from their own account, plus external settlement/reversal reconciliation if net donation accounting is to be offered. Do not use webhook totals for invoices, tax or benefits.
- [ ] Authorised human support and moderator identities must be independently verified and explicitly provisioned (zero presently), with monitored response hours, privacy retention, escalation and real buyer/staff case acceptance. Do not grant staff privileges to guessed user UUIDs.
- [ ] External malware/AV scanner, safe-content policy review and human moderation acceptance before opening broad product sales. Static PDF name checks and moderator quarantine alone are not malware certification.
- [ ] Legal/tax owner review: Stripe test-platform Tax Settings is **pending**, missing the head-office address, with **zero** registered jurisdictions at the verified checkpoint; creators' legal tax obligations must be reviewed separately. Do not invent business details, registrations, VAT amounts, or activate live tax collection.
- [ ] Complete milestone-wide domain/schedule/portfolio/referral/growth exit evidence where any operational or human journey remains deferred; consult the feature ledger and implementation plan.

Do not call Phase 5 fully complete or activate live charging solely from green CI. Production/legal activation belongs to Milestone 7. Run the full staging acceptance and record actual provider evidence before closing Phase 5. Never delete, rewrite or erase retained test payment records to make an acceptance counter pass.

## Proof

- Combined main CI: https://github.com/Truwty/snoozer-uk/actions/runs/44931904741
- Released source: https://github.com/Truwty/snoozer-uk/commit/899a933e774b44e9cee22796643e738a1eebacb0
- PR #25: https://github.com/Truwty/snoozer-uk/pull/25
- PR #26: https://github.com/Truwty/snoozer-uk/pull/26
- Render: https://dashboard.render.com/web/srv-dbts6jon74is73en2rjg
