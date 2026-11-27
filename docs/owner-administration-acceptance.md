# Feature #20 — Owner Control Centre acceptance

**Reviewed:** 27 November 2026  
**Operator acceptance:** The owner tested the delivered administration panel and confirmed that the final privacy/deletion, notification and security fixes work as expected.

## Delivered capabilities

- Database-authorised Owner access with verified identity and AAL2 for privileged mutations.
- User/profile search, paginated inventories, account restrictions, internal bans, provider-ban operations, external appeal challenges, reinstatement and session revocation.
- Case-linked moderation, report triage, gallery takedowns, appeal review and permanent audit history.
- Owner notes, global settings, maintenance mode, registration controls, Premium entitlements and gift-link management.
- Account inbox notices and queued Zoho email delivery with retry state and queue-health checks.
- Privacy request intake/review, account snapshots and archives, private-media export, billing export and evidence-based fulfilment.
- Privacy-erasure preparation/execution path with database evidence checks and explicit irreversible-action safeguards.
- Aggregate Owner analytics, billing diagnostics and system health summaries.

## Authorization requirements

Every Owner read/write must be protected by the database or an authenticated server boundary. Sensitive mutations require an active verified Owner AAL2 session. Database helper `snoozer.admin_actor()` checks the Owner registry and active Auth session; it is not enough for a caller to hide a UI button.

Do not expose service-role credentials, live Stripe keys, Zoho tokens, recovery tokens, OTPs, raw archives, private notes, full email contents or unnecessary personal data in logs or public responses.

## Important operational safeguards

- Snoozer's internal account restrictions and Supabase provider-wide bans are separate controls. The provider-ban workflow requires a safe external appeal/recovery path; do not set `SNOOZER_ENABLE_AUTH_BANS` without verifying the external email challenge and restore journey on an isolated account.
- Privacy erasure is deliberately narrower than a blanket automatic deletion. The irreversible action is gated by `SNOOZER_ENABLE_SAFE_PRIVACY_ERASURE`, an eligible reviewed request, AAL2, explicit confirmation and database evidence. Storage objects, processor records, legal holds and financial retention must be handled independently.
- An account archive or snapshot is not necessarily a complete statutory export. The UI must preserve its stated scope and direct users to a reviewed full export for missing processors/records.
- Email delivery is queued and retryable. A queued notice is not the same as a provider-confirmed delivery; use the outbox and queue-health status for operational verification.
- Scheduled public health probes are black-box HTTP monitoring, not a complete Render/Supabase/Stripe telemetry system or an uptime SLA.

## Verification

The repository CI runs static checks, dependency/security checks, database tests and browser tests for the Owner workflows. The current latest main CI run before this security branch is [run #1312](https://github.com/Truwty/snoozer-uk/actions/runs/46021425902). This new branch must pass its own latest-head CI before release.

The owner has confirmed the final Owner panel fixes as working. This operator acceptance is distinct from the automated test evidence and does not mean every provider outage, external mail failure or legal fulfilment case has been simulated.

## References

- [Owner bans and appeals](owner-auth-bans-and-appeals.md)
- [Owner notification delivery](owner-notification-email.md)
- [Privacy fulfilment runbook](owner20-privacy-fulfilment.md)
- [Safe erasure safeguards](owner20-safe-erasure.md)
- [Security audit](security-audit.md)
