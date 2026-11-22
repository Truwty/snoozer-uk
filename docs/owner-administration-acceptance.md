# Feature #20 — Owner administration acceptance

Last reviewed: 22 November 2026.

## Implemented and deployed
- Owner registry and visible Owner badge; database-authorised access under `/owner`.
- AAL2 MFA for audited privileged mutations, plus settings revision checks.
- User and profile search with full paginated inventory; case-linked moderation.
- Suspension/ban *within Snoozer*, reinstatement, profile/media quarantine, appeals, session revocation, and Owner Premium entitlements.
- Paginated audit log, internal notes, daily aggregate analytics and database operational counts.
- Email registration flag (email-password only), global public-effects setting, visitor-facing maintenance mode (default off).
- Privacy request **intake**, Owner review, in-app notices (PR #48).
- Maintenance mode recovery access for privacy/notification pages (PR #49).

## Outstanding acceptance and capability boundaries
1. **Auth-provider enforcement**: account restrictions are enforced within Snoozer. Do not set Supabase `ban_duration` until an independent identity-verified appeal/recovery path works for Auth-banned users; Auth bans would otherwise prevent current sign-in-dependent appeals.
2. **User notifications**: the in-app inbox is operational. Sending email from the platform's SMTP provider for these Owner events, delivery tracking and retries are not yet built.
3. **Personal-data requests**: intake and human review are operational. Actual complete export packages, safe processing of deletions across Auth, profiles, storage, domains and Stripe, retention/legal holds, and fulfilment evidence must be built and independently reviewed. Never mark an automated erasure as done based only on a queue status.
4. **Provider and platform health**: aggregate database metrics and payment diagnostics exist. Read-only external public status (PR #50) is deployed. Project-specific uptime/latency, incident alert routing and provider auth state are not automatically monitored.
5. **Production acceptance**: test a real Owner logged in with TOTP AAL2 at `https://www.snoozer.uk/owner/security`, then a harmless audited setting round-trip; confirm ordinary user denied; check report/appeal creation; verify restricted user still accesses privacy and appeal forms; confirm live Stripe Checkout, webhook verification and Billing Portal independently. Do not use or record actual OTPs in test logs.
6. **OAuth sign-up shutdown**: registration flag does not block first-time Discord OAuth accounts; separate controls and callback checks are needed for a true all-provider registration switch.

## Security release requirements
Every new admin read/write must enforce verified Owner identity in the database or a properly authenticated server boundary; privileged writes must verify AAL2 and be appended to audit history. Reject owner self-ban, cross-user IDOR and refresh-token-only trust. Do not expose Supabase service role, Render keys, Stripe keys, raw passwords, full email bodies or user PII through public routes. Preserve paid entitlements and processor evidence through privacy review.

## Verification sources
- [PR #44](https://github.com/Truwty/snoozer-uk/pull/44), [PR #45](https://github.com/Truwty/snoozer-uk/pull/45), [PR #46](https://github.com/Truwty/snoozer-uk/pull/46).
- [PR #47](https://github.com/Truwty/snoozer-uk/pull/47), [PR #48](https://github.com/Truwty/snoozer-uk/pull/48), [PR #49](https://github.com/Truwty/snoozer-uk/pull/49), [PR #50](https://github.com/Truwty/snoozer-uk/pull/50).
- CI run IDs and Render deploy IDs are tracked in `docs/PROGRESS.md` and `docs/CONTINUE.md`.
