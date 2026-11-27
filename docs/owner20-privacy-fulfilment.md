# Owner #20: appeal and GDPR fulfilment runbook

**Reviewed:** 27 November 2026. The Owner administration and notification workflows have been accepted by the owner. This runbook preserves the provider, privacy and evidence gates for individual cases.

## External appeal and provider ban acceptance

The signed-out /appeal/external route implements 256-bit single-use challenges, expiry, non-enumeration, and service-only RPCs. Disposable Supabase integration tests cover rate limiting, token replay denial, Auth ban/unban and Owner AAL2.

**Provider-ban actions remain gated by an independently available appeal and recovery channel.** Before enabling provider-wide bans or using the provider action on a real account:
1. Create an isolated verified non-Owner, non-customer account with a mailbox you control.
2. In the actual Owner AAL2 browser, create an actioned moderation case and internal ban.
3. From a signed-out browser, request an external appeal for that exact case/email. Confirm the Zoho HTTPS message actually arrives in the controlled mailbox.
4. Follow the one-use link; submit an appeal; verify exactly one queue record. Replay the same link and verify it is denied, without another appeal.
5. Test mismatched case/email and expiry without leaking whether an account exists. Verify no raw one-use tokens or secrets appear in logs.
6. On the isolated staging environment, perform Supabase provider ban/unban against ONLY the disposable account, check denied login, independent appeal availability, session restriction and successful restoration.
7. Review audits and preserve recovery paths. Only after sign-off should production SNOOZER_ENABLE_AUTH_BANS be set to true. Leave it disabled if delivery, moderation or appeal availability fails.

A verified Owner test-email alone does not prove the independent external appeal route.

## Current self-service export coverage

- /api/v1/account/data-snapshot: basic account snapshot.
- /api/v1/account/data-archive: first-party account and profile metadata.
- /api/v1/account/media-export: current private Storage manifest and individual authenticated file downloads.
- /api/v1/account/billing-export: verified live Stripe customer, subscription and invoice summary with pagination limits.

These do not guarantee full processor, legacy or historical analytics coverage. Users can request a reviewed full export.

## Safe GDPR deletion and retention workflow

1. Verify requester identity and assess all applicable legal obligations and holds.
2. Inventory app tables, historical media, archived storage, profile identifiers, subscriptions, past invoices and other processors.
3. Retain legitimate tax, disputes, abuse-prevention and audit evidence only as long and as minimally as justified. Document the decision and expiry schedule.
4. Resolve active subscriptions through the lawful billing process; never silently cancel a paid customer.
5. Separately erase or anonymise authorised personal data across Auth, app tables and Storage. Verify foreign keys, orphan objects and downstream processor handling. Do not assume deleting an Auth user will cascade everything.
6. Confirm complete export delivery or erasure, including third-party processor follow-up and a secure completion message.
7. Record evidence references and each completed fulfilment step in Owner /owner/privacy.

The new private privacy_fulfilment_evidence table requires Owner MFA (AAL2) to write; the database now rejects request completion without evidence for identity, app, media, billing, processors, retention and secure notification. Deletion additionally requires subscriptions resolved and independently verified account erasure. **This is a mandatory evidence gate, not automatic erasure.**

Never write passwords, raw personal-data archives, bank details or MFA codes into the audit reference field. Keep third-party evidence in a private, access-controlled support system.

## Acceptance

Disposable Supabase E2E tests verify AAL2 denials, missing/incomplete evidence, successful evidence recording and test-only completion. Real recipient-controlled appeal testing, production Owner AAL2, processor retention/legal review and genuine deletion remain independent acceptance gates.

## Final-release provider-ban readiness and erasure inventory

On the Owner account detail page, the provider-ban readiness panel checks an Owner AAL2 browser session, an **active indefinite internal ban** (a temporary suspension does not qualify), at least one linked eligible actioned/closed/appealed moderation case and current Supabase Auth ban state. The ban button is disabled until all criteria pass and displays eligible case IDs from a database-verified read-only RPC. Before unbanning, lift all active internal restrictions; the provider unban button will only appear usable for an actually provider-banned user. Denial codes are allowlisted in the UI and do not reveal tokens or database internals.

The privacy request detail page adds a database-generated **direct foreign-key inventory** showing the number of Snoozer rows referring to the requested Auth user, table/column, and Postgres on-delete behaviour. This is not a substitute for inspecting indirect ownership, media files, Stripe/legal billing obligations, processor contracts and old support data. In particular, a reported zero direct FK count **does not** authorise Auth deletion or completion of a GDPR request.

**Acceptance:** Run disposable local tests and the full CI suite, then inspect hosted data after a controlled ban+unban: two `provider_ban_operations` rows (`ban` and `unban`) with succeeded status and associated `auth.ban.prepare` / `auth.ban.result` audit events; the test account has `banned_until` null and can sign in. If no operation rows appear, the request did not pass the Owner database preflight; do not mark it accepted.
