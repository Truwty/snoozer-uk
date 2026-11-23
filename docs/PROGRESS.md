## Feature #8 — Discord Presence (23 Nov 2026)

Owner approved first-party Discord Presence. Implementing consent-based identity linking, per-profile field visibility, a private Supabase cache and signed internal ingestion, a public profile card, Studio controls, a standalone Node Gateway worker, account export, privacy disclosure and tests.

The website-side implementation is under development on `feat/discord-presence`. The actual Discord bot application/token, shared guild, manual identity-linking setting (for email-first accounts) and always-on worker deployment are external dependencies. No worker has been provisioned because it adds a recurring paid Render resource. The owner must approve the cost and configure credentials directly in Render. No bot token is stored in GitHub or chat.

Do not claim complete until CI and migration pass, code is merged/deployed, the worker heartbeat is live, and a consenting real Discord account has passed online/idle/DND/offline/activity/custom-status, disable, disconnect, leave-server and outage acceptance. See `docs/discord-presence.md`.

---

## Feature #7 — Spotify embed visual redesign (23 Nov 2026)

Owner-requested appearance refresh: the official Spotify iframe now renders automatically (lazy network load) inside a compact Snoozer theme-aware card with one understated Spotify action, replacing the old duplicate link button, privacy accordion and load/hide controls. Link analytics are retained on the Open link and Spotify iframe remains the official provider code. Updates to published and preview appearance, Studio guidance, privacy disclosures, E2E tests and documentation. Provider requests can occur without per-widget consent; legal/privacy review recommended for UK PECR before broad rollout. Merged in PR #79 as commit e807ef5; GitHub Actions run 45096515897 passed, and Render deployment dep-dc1pp7nf3r2c73dd98gg reached Live. Automated browser checks passed; visual verification remains owner-confirmed.

---

## Feature #7 — Spotify embeds only (23 Nov 2026)

**Owner decision:** retain free, consent-first official Spotify links and embedded players; remove all Spotify OAuth and live Now Playing features. The existing Spotify parser/widget, Studio shortcut, CSP and embed E2E coverage remain. Removed account linking, callbacks, Web API polling, token storage, public listening status, OAuth tests and configuration. Added a forward Supabase migration to remove the unused table and RPCs; confirmed **0 connected Spotify accounts** before removal. Studio /spotify now explains how to add a free embed. Verify CI, production Render deployment and database migration before marking fully live. See `docs/spotify-integration.md`.

---

## Feature #20 — Single-step reviewed erasure UX fix (22 Nov 2026)

**Reproduced on real disposable UID `ff1646ea-961e-47aa-ac71-805eea03bd9f`:** It is confirmed, not an Owner, has one normal auto-created profile, zero Stripe customers/checkouts/products, zero media objects, zero bans/cases, and one `open` deletion request `8feabd7d-8bc2-4587-8cf7-71b547899af5`. **No privacy evidence row or erasure job was created.** The old Execute handler required a separate evidence form and returned only `erasure-blocked`, so the user had no actionable explanation. The clean profile itself is a normal `ON DELETE CASCADE` dependency and must not be considered a blocker.

**Candidate fix:** The Owner AAL2 deletion form now includes an explicit independent review attestation for verified identity, payment, subscription, processor and legal retention obligations. One click records that Owner review into the existing auditable evidence RPC and runs the restricted DB preflight and privileged Supabase Auth deletion. It uses allowlisted, human-readable failure messages and reports real linked records. After a successful Auth erasure, reconciliation and Zoho notice, it automatically marks the request `completed` through the existing Owner AAL2 audit RPC. The code retains every actual protection for Owner accounts, payment activity, private Storage, moderation dependencies and legal holds. No account data is deleted by deployment.

**Release acceptance:** PR CI lint/types/unit/real disposable Supabase/Playwright pass; squash merge; Render deploy to tested commit; verify the deletion flag `SNOOZER_ENABLE_SAFE_PRIVACY_ERASURE=true` is enabled only for Owner AAL2 acceptance. Only a signed-in Owner with an active AAL2 session can submit a real delete, including typed request confirmation and attestation. Then inspect the supplied disposable UID and corresponding `privacy_erasure_jobs` in production. Do not assert success before Auth account is absent and the job and notice are recorded.

---

## Feature #20 deletion integrity follow-up — 22 November 2026

**Confirmed production defect:** The Owner used the status-review form with repeated `ERASE <UUID>` text, but this form only changes the decision. The database showed the deletion request marked `completed`, while the original Auth user, profile, moderation appeal/restriction and other linked records still exist; `privacy_erasure_jobs` is empty. Prior fulfilment evidence marked `account_erasure_verified=true` and `secure_notice_sent=true` without a backend erasure job. This must NOT count as deletion success.

**Fix:** A new migration makes deletion evidence for `erasure` and `notice` conditional on verified server-side job and notice events. Deletion completion requires `auth.users` absence, a matching `privacy_erasure_jobs.status=completed` and service-recorded completion notice. The Owner UI distinguishes a status review from the separate irreversible execution form, and does not offer `Completed` early. Disposable E2E checks attempted forged evidence is denied even if directly updated in the test database.

**Production repair (after green CI/merge):** Surgically reopen the *one confirmed test request* with Auth still present, correct unsupported evidence, and write a repair audit entry. Do not erase, ban, or alter any real customer. The test account is *not* dependency-free (it has a moderation case, appeal and restriction), so restricted erasure correctly blocks it. Use a fresh verified, billing-free, media-free, moderation-free disposable account for a controlled deletion acceptance; do not remove safety requirements just to force the old test account through.

---

## Feature #20 restricted, real account erasure — implementation candidate, awaiting CI

Implemented a narrow, Owner AAL2, server-side Supabase Auth deletion path for verified **non-Owner, non-billing, media-free, dependency-free** subjects with a real deletion request, documented processor/retention/subscription attestations, and a typed irreversible confirmation. The app route uses `auth.admin.deleteUser`, not a direct SQL delete, preserves minimised audit actor history via `ON DELETE SET NULL`, and records a private job with service-only verification of the erased Auth row plus owned app/Storage leftovers. A Zoho completion notice is attempted; failures require operator reconciliation. Disposable local Supabase E2E covers allowed and blocked paths. Instructions: `docs/owner20-safe-erasure.md`.

**This remains disabled by default via `SNOOZER_ENABLE_SAFE_PRIVACY_ERASURE` and does not automatically erase Storage binaries, live Stripe customers, subscriptions, creator commerce, old third-party data or legal holds. It is not the end of GDPR obligations or a claim of complete general-purpose deletion. No customer data was erased.** The full release needs passing PR CI, merge, hosted migration, Render deploy and an isolated live acceptance run before enabling.

The user reports provider ban/unban worked but the hosted `provider_ban_operations` and restrictions have no operations for the disposable account; Auth-level ban acceptance therefore still requires an audited succeeded ban/unban pair. Other acceptance tasks remain Owner AAL2 browser verification, email/Discord registration off/on, alert recovery, Stripe billing, leaked-password protection and broader security sign-off.

---

## Feature #20 final acceptance and safe erasure inventory — 22 November 2026 (candidate awaiting CI)

**Production verified:** The user completed a real external-appeal Zoho inbox test on a verified, disposable non-Owner account. Hosted Supabase confirms exactly one issued challenge, one consumed challenge, one moderation appeal and one audit event. Render deployment `dep-dc1m7c2jnfac73959ekg` went live with `SNOOZER_ENABLE_AUTH_BANS=true`. The test account was subsequently able to sign in and is not currently provider banned.

**Provider-ban acceptance still unproven:** Although the user reports pressing ban/unban controls, hosted tables contain **zero** `provider_ban_operations` rows, no internal account restrictions and no ban-result audit events for the test account. The Owner form required an active internal indefinite ban and a linked actioned case, but did not explain prerequisites or denial reasons clearly. This candidate adds a database-authorised readiness RPC, case selection and actionable but allowlisted status messages, plus disposable end-to-end coverage. This does **not** prove a real provider ban/unban; test again after deployment with an AAL2 Owner and an isolated account. Do not claim provider enforcement accepted without a successful ban+unban operation pair and recovered sign-in.

**GDPR deletion remains manual and blocked by real dependencies:** This candidate adds read-only Owner-only direct Auth foreign-key inventory for a privacy request. It exposes counts of referencing Snoozer rows and FK deletion behaviour so the reviewed erasure workflow can be built safely. It is not an erasure implementation: indirect profile/media relationships, historical Storage, Stripe paid transactions and subscription commitments, third-party processors and lawful retention still require design and execution. Do not delete a customer or falsely close a request.

**Rollout:** After passing full CI, merge the PR, apply `20261122220600_owner_provider_preflight_privacy_inventory.sql` to hosted Supabase, verify anon/member EXECUTE denial and Owner RPC, manually deploy Render (auto-deploy off). Keep customer billing, maintenance and registration flags unchanged. Production signup-hook integration, real Owner AAL2 sign-off, alert recovery, Stripe regressions and GDPR fulfilment require separate acceptance.

---

## Feature #20 privacy fulfilment hardening — 22 November 2026 (branch, pending CI)

A follow-up branch adds private, MFA-only fulfilment evidence and a database-enforced requirement that privacy requests cannot be marked completed without verified identity, app/media, billing/processor, retention and secure-notice checks. Deletion also requires evidence of subscription resolution and actual account erasure. Owner UI can record reference-only evidence and inspect existing status. Disposable Supabase E2E exercises AAL1 denial, incomplete evidence and test-only closure. **This does not execute erasure, terminate customer subscriptions or prove full GDPR compliance.** Real mailbox-backed external appeal/replay verification and a protected staging Auth ban/unban drill remain necessary before provider bans are enabled. Run the acceptance checklist in docs/owner20-privacy-fulfilment.md; keep SNOOZER_ENABLE_AUTH_BANS disabled. No production change should be claimed before CI, merge, migration and Render checks.

---

## Feature #20 acceptance and privacy exports — 22 November 2026 (current checkpoint)

**Merged, CI-proven changes:** PR #66 exercises a disposable non-Owner Supabase Auth ban, sign-in refusal, **signed-out external appeal**, single-use replay rejection, unban/recovery, and real Owner TOTP AAL2 gating of `owner_prepare_auth_ban` plus internal restriction/case requirements. It does not send a live Zoho email. PR #67 adds first-party authenticated exports of **current private avatar/gallery Storage objects** with server-side per-object ownership verification and cross-account/anonymous denial tests. PR #68 adds read-only, bounded live Stripe Premium customer/invoice/subscription summaries for the session-verified owner and safe no-customer tests. All three PR CI suites completed successfully before merge.

**Hosted schema:** New migrations `private_media_export` and `live_billing_export` applied successfully to production Supabase. Explicit anonymous EXECUTE checks are false for the new media and billing RPCs; authenticated EXECUTE is true. The web changes require a subsequent manual Render deployment (autoDeploy is off), plus real production HTTP verification. Do not describe this entry as proof that new routes are live unless deploy verification is recorded separately.

**GDPR scope / remaining obligations:** The app archive, current private Storage file downloads and bounded Stripe billing summaries significantly improve access. These are **not** a complete UK GDPR access or erasure fulfilment pipeline: historic/orphaned Storage objects, analytics/processor records outside the app, more-than-100 Stripe records, full Stripe dispute/refund evidence, Zoho support mail and legally retained tax/fraud records require verified manual collection. No automatic erasure or cancellation is authorized. Owner privacy preflight must verify active subscriptions, providers and lawful retention before a reviewed request is marked complete.

**Security audit:** Supabase security advisor identified intentional anonymous SECURITY DEFINER read endpoints (public profiles, sitemap, leaderboard, signup status), protected authenticated RPCs requiring per-function review, and **leaked-password protection disabled**. Supabase docs indicate leaked-password protection requires Pro or above and a dashboard configuration step. Do not revoke public profile RPC EXECUTE wholesale. Actual live Owner AAL2 session checks, production email and Discord signup toggles, billing acceptance, real external email receipt/replay, and alert incident drill are still outstanding.

**Provider Auth-ban hard gate:** Keep `SNOOZER_ENABLE_AUTH_BANS` disabled until a separately controlled, verified non-Owner mailbox receives the real independent-appeal email, the token succeeds once and fails on replay without a session, and a protected test user's provider ban/unban is safely reversed and audited. Synthetic browser and Supabase tests are not a substitute for actual email delivery.

**Operational proof:** https://github.com/Truwty/snoozer-uk/pull/66 · https://github.com/Truwty/snoozer-uk/pull/67 · https://github.com/Truwty/snoozer-uk/pull/68

---

## Feature #20 release checkpoint — 22 November 2026, 20:35 UTC

**Delivered:** Owner notice Zoho HTTPS mail and a five-minute GitHub scheduler are live; user verified a successful dispatch (zero eligible queued messages) and automatic incident closure. PR #63 (commit `d8ba5ae823d5200321cf58f89a1aab412de3ef5f`) adds a scoped, verified-session first-party app archive and disposable Supabase Auth-ban/TOTP acceptance tests; PR #64 adds an Owner read-only privacy fulfilment preflight; PR #65 adds an opt-in private exhausted/overdue email queue monitor. CI for each PR passed; the combined application code has been reported **live** by Render on commit `d8ba5ae8`, and post-deploy ERROR-level logs were empty in the inspected window. Hosted Supabase applied all three function migrations; anonymous EXECUTE is denied on the archive, privacy preflight and queue-health RPCs; appropriate authenticated/service access is granted. Post-merge main CI and externally-originated endpoint HTTP verification are **not** claimed complete at this checkpoint.

**Remaining hard gates:** This is not end-to-end GDPR fulfilment: full processor/Stripe invoices, binary private Storage exports, lawful deletion/retention and verified account erasure remain manual. Live external-appeal email + one-time token replay and protected disposable provider ban/unban sign-off remain necessary before enabling `SNOOZER_ENABLE_AUTH_BANS` (keep disabled). Real live Owner AAL2 browser sign-off, both states of first-time Discord/email sign-up, payment regressions, and project alert recovery drill remain to do. The queue-health workflow check is independently disabled until the operator sets GitHub Actions variable `OWNER_EMAIL_QUEUE_HEALTH_ENABLED=true` after deploying the migrations and route. Supabase Auth leaked-password protection is a separate dashboard setting that requires operator review. **Do not claim Feature #20 fully accepted, and do not modify active customer subscriptions or trigger destructive erasure.**

---

## Feature #20 follow-up — 22 November 2026, 19:30 UTC (pending PR #60 CI)

**Zoho API sending verified by operator:** Owner reports the real production test email succeeded after deploying region-matched Zoho OAuth API credentials. A read-only production Supabase count confirms 5 queued delivery jobs, 5 marked delivered and 0 undelivered at inspection. This confirms the current outbox state, not an unattended delivery schedule or guaranteed inbox receipt for every recipient.

**Scheduled dispatch implementation:** PR #60 adds a five-minute GitHub Actions dispatcher with bounded request, no cross-host redirect forwarding, counter checks and automatic incident issues. It requires an independent GitHub repository Actions secret `OWNER_EMAIL_DISPATCH_TOKEN` matching Render's existing token, plus Actions variable `OWNER_EMAIL_SCHEDULE_ENABLED=true`. It is **disabled until configured and acceptance-tested**; do not claim autonomous delivery is running yet.

**Still open for full Feature #20 sign-off:** disposable-user external appeal / single-use email verification and safe enablement of Supabase provider bans; full cross-provider privacy export/deletion fulfilment with billing and lawful retention; project-specific alert delivery/recovery validation; real Owner AAL2 and ordinary-account production browser acceptance; first-time email/Discord registration toggle and billing regressions. Previous entries below are historical checkpoints and should not be interpreted as the latest state.

---

## Zoho mail delivery remediation — 22 November 2026 (pending CI and deploy)

The existing outbox had three undelivered Premium event notices in hosted Supabase; sending a manual batch returned zero processed because its jobs were already leased. The prior UI misleadingly named a discontinued provider and did not offer a safe test. The Render Free web service blocks outgoing SMTP ports 25, 465, and 587. **This does not affect Zoho authentication mail sent from Supabase.**

Implementation on the current branch:
- Strip retired provider terminology from Owner System and provider-ban UI; distinguish zero processed from zero failures.
- Add Owner-only AAL2 test email to the Owner's own confirmed email, without a Premium or moderation mutation.
- Prefer Zoho Mail REST API over HTTPS (OAuth refresh token, fixed regional mail hosts), which can work on Render Free; keep TLS SMTP as an explicitly gated option only on hosting with permitted outbound ports.
- Fail closed on the outgoing email and independent-appeal routes if neither transport is configured. Existing in-app notices continue working.
- Require separate Zoho Mail API OAuth credentials and account ID (plus dispatcher token); **do not claim a real test email was delivered**. Never enable Auth bans before confirming the independent appeal link end-to-end and one-use token replay denial.

---

## Owner email UI and delivery incident — 22 November 2026

**Verified state:** The Owner System UI used obsolete provider wording. Hosted outbox read-only inspection showed 3 Premium action notifications, 3 delivery jobs, **0 delivered**, all with one claimed attempt and leases. Manual dispatch status "ok, sent 0, failed 0" is not evidence of delivery. Render Free blocks outbound SMTP on port 465, while separately hosted Supabase Auth Zoho emails work.

**Remediation:** Remove obsolete provider copy; add a verified Owner MFA (AAL2) test-email action addressed only to the Owner's confirmed email; improve zero-processed messaging; block outbound sends and independent email appeals until `ZOHO_SMTP_OUTBOUND_ENABLED=true`. This flag must stay disabled on Render Free. Upgrade to an SMTP-capable Render instance or implement an HTTPS Zoho Mail API sender before enabling this flag; then prove inbox delivery, one-time external appeal and dispatcher scheduling. Do not enable provider bans without independent appeal verification.

---

## Zoho SMTP Owner delivery migration — 22 November 2026 (implementation awaiting CI and production sender verification)

The Owner notification queue and independent /appeal/external verification email code now use an explicit TLS-validated Zoho SMTP transport (`smtppro.zoho.uk:465`) instead of the former former transactional email API transport. Supabase Auth SMTP settings are **unchanged**; the user reports that Auth confirmation/reset and security mail are successfully delivered through Zoho. The Owner delivery pipeline still needs separate Render server-only secrets `ZOHO_SMTP_USER`, `ZOHO_SMTP_PASSWORD`, `SNOOZER_NOTIFICATION_FROM`, and `OWNER_EMAIL_DISPATCH_TOKEN`. These are not readable from Supabase Auth's saved SMTP settings. The external appeal route and guarded provider-ban readiness checks use the same Zoho sender. This is a code-only transition: no email send, sender inbox receipt, scheduled dispatch, or Auth-level ban enablement is claimed. Keep `SNOOZER_ENABLE_AUTH_BANS` disabled until a disposable user's external verification flow is proven end-to-end and replay-tested. Follow `docs/owner-notification-email.md` for settings, test and scheduling requirements.

---

## Feature #20 production acceptance checkpoint — 22 November 2026, 08:40 UTC

**Merge/deploy:** PR #52 (signup hook), PR #53 (email outbox), and PR #56 (independent appeals and guarded Auth bans) are merged. PR #54 was closed unmerged as superseded by #56. GitHub Actions run [45003124370](https://github.com/Truwty/snoozer-uk/actions/runs/45003124370) succeeded for current main commit `349c0b3d42451a948a8067153d728d330c866023`. Render deployment `dep-dc1agbmtlv9c73bigun0` reports **live** on that commit. No ERROR-level logs were returned for the sampled post-release Render window (08:30 onwards); this is not proof of zero runtime defects.

**Hosted Supabase:** Project `edgptbiwswcdmmxzwhxv` reports ACTIVE_HEALTHY. Migration versions `20261122082136` (signup hook), `20261122082150` (outbox), `20261122082942` (external appeals), and `20261122082944` (provider ban) are installed. SQL verified `supabase_auth_admin` has EXECUTE on `public.snoozer_before_user_created`, while `anon` and `authenticated` do not. The two service-role outbox RPCs also deny both public roles. Zero queued notification email deliveries at inspection. **These observations do not establish that the hook is enabled in the Auth dashboard, that legacy provider is configured on Render, or that a real recipient received an email.**

**Outstanding hard acceptance gates — do not claim completed:**
1. Enable **Before User Created** hook in the Supabase Auth dashboard and perform real first-time Discord and email signup tests both on and off, plus existing-account sign-in tests. Database privileges alone do not activate the hook.
2. Configure verified previous sender, secret API key and long independent dispatcher token on Render; verify end-to-end recipient-controlled test email and retry behavior. After that, configure trusted scheduled dispatch. Do not expose secrets in GitHub.
3. Exercise `/appeal/external` with a disposable non-Owner banned-user scenario, including one-use token replay protection, real delivery and moderation appeal creation. Keep `SNOOZER_ENABLE_AUTH_BANS` disabled until proved.
4. Implement and separately test actual complete cross-provider personal-data export/erasure processing, identity verification, lawful retention and Stripe/Storage handling. The existing basic snapshot and review queue are **not** full GDPR fulfilment.
5. Verify project-specific health/latency and alert routing, not just public provider status; retain the existing hourly availability monitor. Demonstrate an actionable alert and safe recovery procedure.
6. Run real Owner AAL2/TOTP browser acceptance, ordinary-user denial, privacy/appeal access for restricted users, and production billing smoke without recording MFA codes or disrupting customer subscriptions.

**Security reviewer note:** Supabase security advisor returned informational RLS/no-policy findings on private-schema tables. Do not automatically add permissive policies; verify grants, schema exposure and intended RPC access before changing any security policy. Run security advisors again after DDL changes.

**Release disposition:** Code merged and deployed; Feature #20 still **NOT fully production-accepted**. Keep privileged provider enforcement fail-closed, do not automatically erase legal/billing evidence, and do not represent sender API acceptance as confirmed inbox delivery.

---

## Owner account snapshot — LIVE, 22 November 2026, 07:22 UTC

[PR #51](https://github.com/Truwty/snoozer-uk/pull/51) merged to `main` as `3ba12042c08441ed285ec4012ce417e0f614e39a`; [CI #44997231296](https://github.com/Truwty/snoozer-uk/actions/runs/44997231296) passed secret scanning, audit, lint, TypeScript, unit, disposable Supabase, Next build and Playwright. Render deployment `dep-dc19fdmtlv9c73bflli0` reported **live** on the exact merged code; no error-level logs in the inspected deploy window. Adds a no-store, verified-user JSON download at `/api/v1/account/data-snapshot` and linked `/account/data` interface. The archive contains a **basic own-account snapshot only** (identity fields, privacy request history, in-app notices). Anonymous access is tested to return 401. It does not include all stored user data, media, payment records or external processors and must not be called a full GDPR export.

**Feature #20 remains INCOMPLETE:** external Auth-provider ban/independent identity-verified appeal, delivery/retries for notification emails, complete export/deletion fulfilment and retention, private provider health alerts, Discord signup gating and real Owner AAL2 production browser acceptance remain open. Do not remove session-based appeals, paid Stripe subscriptions or protected audit evidence to shortcut completion.

---

## Owner administration expansion — LIVE through PR #50, 22 November 2026, 07:16 UTC

**Released with verification:**
- [PR #47](https://github.com/Truwty/snoozer-uk/pull/47), merged commit `f36379652fa7a0318c51c3e3728809c6b16fb3e5`. [CI #44995471696](https://github.com/Truwty/snoozer-uk/actions/runs/44995471696) passed. Supabase migration `20261122064925_owner_maintenance_mode` applied and checked with `maintenance_enabled=false`. Render `dep-dc194o2fngtc73f0dp4g` confirmed live; post-startup ERROR logs zero in the checked window. Adds missing Owner global-effects UI and safe visitor-facing 503 maintenance switch, with AAL2-gated audited changes and Owner/Auth/API/Stripe recovery paths.
- [PR #48](https://github.com/Truwty/snoozer-uk/pull/48), merged commit `655d5e2284afcbddec00d359c9990167175afc29`. [CI #44995814847](https://github.com/Truwty/snoozer-uk/actions/runs/44995814847) passed. Supabase migration `20261122065402_owner_privacy_notifications` applied with anonymous EXECUTE denied on privacy/admin RPCs. Render `dep-dc196gl6e07s73cn527g` confirmed live with no checked post-startup ERROR logs. Adds restricted-compatible privacy-request intake, AAL2 Owner review and in-app account notices for moderation/Owner Premium actions. **This is not automated full export/deletion or SMTP notification delivery.**
- [PR #49](https://github.com/Truwty/snoozer-uk/pull/49), merged commit `7aa9ebbcbdfaeac8367df5bd2593eec25f2c1470`. [CI #44996348177](https://github.com/Truwty/snoozer-uk/actions/runs/44996348177) passed; preserves privacy-request and account-notification access while maintenance is enabled.
- [PR #50](https://github.com/Truwty/snoozer-uk/pull/50), merged commit `879ace83926f41b7fea8224cc2c23e384d6430a8`. [CI #44996753842](https://github.com/Truwty/snoozer-uk/actions/runs/44996753842) passed. Render `dep-dc19crt9fdbs73a6lrf0` confirmed **live**, checked post-startup error logs zero. Adds bounded, read-only public incident status for Render, Supabase and Stripe; this is not project-specific provider monitoring.

**Pending release:** [PR #51](https://github.com/Truwty/snoozer-uk/pull/51) adds authenticated basic account snapshot downloads, with clear incomplete-export disclosure. Full CI/deploy not yet confirmed.

**Overall #20 NOT YET COMPLETE:** provider Auth-level ban integration needs an out-of-band verified appeal path; transactional email delivery/retry needed in addition to in-app notices; complete personal-data export/erasure and lawful retention require actual fulfilment tooling; private provider-specific health/incident alerts and real Owner AAL2 browser acceptance remain unverified. First-time Discord OAuth bypasses the existing email-registration switch. Do not claim all six phases complete or bypass these controls.

---

## Owner administration — verified releases and remaining acceptance, 22 November 2026

**Released on main with full CI and hosted database migrations:**
- [PR #47](https://github.com/Truwty/snoozer-uk/pull/47) (commit `f36379652fa7a0318c51c3e3728809c6b16fb3e5`, [CI 44995471696](https://github.com/Truwty/snoozer-uk/actions/runs/44995471696) passed, hosted migration `20261122064925_owner_maintenance_mode`, Render `dep-dc194o2fngtc73f0dp4g` confirmed live): AAL2-gated audited public visitor maintenance switch with a 503 response and recovery/billing exemptions; existing effects switch now appears in Owner settings. Maintenance is **off by default**, independently confirmed in hosted settings.
- [PR #48](https://github.com/Truwty/snoozer-uk/pull/48) (commit `655d5e2284afcbddec00d359c9990167175afc29`, [CI 44995814847](https://github.com/Truwty/snoozer-uk/actions/runs/44995814847) passed, hosted migration `20261122065402_owner_privacy_notifications`, Render `dep-dc196gl6e07s73cn527g` confirmed live): authenticated privacy export/deletion **request intake and manual Owner review** with AAL2/audit, owner-only private queue and user status page; private **in-app** Owner action notifications for restriction, reinstatement, Premium grants/revocation, appeals. RPC permission check confirmed unauthenticated role cannot execute private functions. Automatic data exports/deletion, Stripe cancellation and outbound email are not implemented.
- [PR #49](https://github.com/Truwty/snoozer-uk/pull/49) (commit `7aa9ebbcbdfaeac8367df5bd2593eec25f2c1470`, [CI 44996348177](https://github.com/Truwty/snoozer-uk/actions/runs/44996348177) passed, Render `dep-dc19ah2jnfac73845v30` confirmed live): data requests and private notices remain accessible during visitor maintenance.
- [PR #50](https://github.com/Truwty/snoozer-uk/pull/50) (commit `879ace83926f41b7fea8224cc2c23e384d6430a8`, [CI 44996753842](https://github.com/Truwty/snoozer-uk/actions/runs/44996753842) passed): read-only, bounded and validated public incident status for Render, Supabase and Stripe in Owner system. Render deployment `dep-dc19crt9fdbs73a6lrf0` confirmed **live** on the exact merged commit; checked post-deploy ERROR-level logs returned zero records. A second queued deployment for the same code commit is redundant, not a new code change.

**Full #20 remains incomplete.** Remaining: production real Owner AAL2 interactive/browser acceptance (cannot impersonate an Owner MFA browser); Auth provider-level banning with appeal and privacy access preserved; transactional notification emails; actual verified data export/delete fulfilment including provider/Stripe retention obligations; project-specific provider monitoring/alerting and wider operational/support acceptance. Global email registration flag still does not prevent first-time Discord OAuth signups. Existing app-level account restrictions, session revocation and moderation remain active. Preserve paid Stripe subscriptions and separate provider credentials. Do not claim real browser smoke or automatic GDPR erasure.

---

## Owner settings: effects and safe visitor maintenance — implementation pending verification, 22 November 2026

**Branch:** `feat/owner-maintenance-settings`. The previously deployed `effects_enabled` Owner setting was not displayed despite its database and action support; the Owner settings UI now exposes it with audited MFA changes. Added a default-off `maintenance_enabled` configuration flag, Owner-only AAL2-gated revision-based updates using existing `owner_set_setting`, public read-only boolean, and a visitor-facing 503 maintenance page. Main Owner/admin recovery, authentication callbacks, login, appeals, legal pages, health checks and all API endpoints (particularly Stripe webhooks) are exempt to preserve recovery and financial continuity. This is a *visitor-facing maintenance mode*, not a complete upstream shutdown. Existing customers and subscriptions are not changed. Full CI, hosted migration, merge and Render verification are required before this can be called live.

**Still outstanding for full #20:** Provider-level ban/notification, privacy export/deletion workflows, external provider checks, operational/support acceptance and a real live Owner AAL2 browser test. Keep these open until implemented and verified.

---

## Owner full-inventory search and pagination — LIVE, 22 November 2026, 06:32 UTC

**Merged and verified:** [PR #46](https://github.com/Truwty/snoozer-uk/pull/46) on `main` at commit `7415f6fc5301f41b42c718debbf3b3105393263f`. [GitHub CI #44993502789](https://github.com/Truwty/snoozer-uk/actions/runs/44993502789) passed source-secret scanning, dependency audit, lint, TypeScript, unit tests, disposable Supabase, Next.js build and Chromium Playwright. Connected hosted Supabase applied migration `20261122062301_owner_inventory_pagination` (matching source file), and SQL confirmed authenticated EXECUTE plus denied anonymous EXECUTE on both new RPCs. The functions check verified Owner identity internally. Render deployment `dep-dc18o156e07s73clsr9g` reports **live** on the exact merged commit at 06:32:39 UTC; runtime logs show Next.js ready, and ERROR-level logs from the checked post-startup window contained zero records. Direct real Owner browser MFA acceptance on the public domain remains unverified.

**Feature:** Account inventory and profile inventory now use searchable 50-item cursor pagination rather than only fixed recent lists. The new Owner-only SQL functions support account email, username or UUID lookup and profile username/account UUID filters, with consistent creation-date/UUID cursors. Non-Owner RPC denial and cursor validation have disposable-provider tests. Existing moderation, session controls, Premium entitlements, billing and published profiles were not intentionally altered.

**Programme status:** The overall six-phase Full Owner Administration Panel remains incomplete. Next: real Owner AAL2 production smoke, provider Auth ban/notifications and retention workflows, global maintenance switch and other feature controls, external-provider operational health, data export/delete, and wider operational acceptance.

---

## Owner inventory pagination — implementation candidate, 22 November 2026

**Hosted migration applied; source-alignment CI/release pending:** new migration `20261122062301_owner_inventory_pagination.sql` adds authenticated Owner-only, cursor-paginated account and profile inventories. Search now spans all accounts/profiles instead of the previous fixed recent window, with 50-result pages, username/account UID filtering and links to affected accounts. Owner-only RPCs validate query length and cursor pairs; non-Owners receive permission errors. Browser UI retains existing owner permissions and routes. Disposable Supabase integration tests cover search, cursor navigation and role isolation. Do not mark deployed before full CI, hosted migration and Render checks.

**Remaining for full administration sign-off:** production Owner MFA smoke, provider-level bans and notifications, data export/deletion, maintenance mode, health of external providers, support operational workflows and broader acceptance testing.

---

## Owner administration releases verified — 22 November 2026, 06:12 UTC

**Second stage — MERGED and LIVE.** [PR #44](https://github.com/Truwty/snoozer-uk/pull/44) merged to `main` at `513cd89cf30fe5fe1ddc5a92620237118241c02a`. [CI #44991261460](https://github.com/Truwty/snoozer-uk/actions/runs/44991261460) passed secret scan, audit, lint, typecheck, unit tests, disposable Supabase, build, and Playwright. Render deployment `dep-dc189qpksfps7385l860` confirmed **live** on that commit. Includes verified profile reports, appeals, case-linked moderation, public-profile quarantine, blocked gallery media, and audit actions.

**Third stage — MERGED and LIVE.** [PR #45](https://github.com/Truwty/snoozer-uk/pull/45) integrated with stage two, tested at branch commit `fb1c34f72e9c130984609d19967a0b224b0a395e` in [CI #44991970503](https://github.com/Truwty/snoozer-uk/actions/runs/44991970503): full checks passed. Squash merge to `main` produced `ccf7a87c7d8a37a48615fbf69c70530ae8d728ef`; Render deployment `dep-dc18eht9fdbs73a3vv3g` confirmed **live** 06:12:08 UTC on that precise commit. Build succeeded, startup showed Next.js ready, and Render error-level logs returned **zero records** in the inspected post-startup window. Includes session-revocation controls and Owner MFA-session checks, restriction notices, Owner session summaries, platform effects setting, daily analytics, operational metrics, and paginated audit views. Connected Supabase reports all corresponding migration versions installed (including compatibility migration `20261122054252`). No independent browser with a real Owner AAL2 session was exercised against the live public domain in this run.

**Remaining work (do not mark six phases complete):** production Owner-session smoke verification; Auth provider-level bans and notification email flows; full inventory pagination, additional global feature switches/maintenance mode, external provider health controls and monitoring; data export/delete compliance workflows and broader regression/operational acceptance. New administrative capabilities must remain database-authorised, MFA-gated for privileged writes, logged, tested against disposable Supabase, and released after CI. Avoid disrupting existing paid Stripe subscriptions.

---

## Owner session security and operations — 22 November 2026

**Third-stage candidate (CI/deploy pending):** migrations `20261122053548_owner_effects_setting.sql` and `20261122053616_owner_sessions_and_operations.sql` provide an audited global profile-effects switch, verified Auth session lookup on privileged operations, Owner-only revocation of ordinary account refresh sessions, active restriction status for suspended users, Owner account session inventory, daily aggregate consented analytics, system health counts and paginated audit reads. `/account-restricted` provides explanations and known case references without blocking appeal access. Server-side `requireAccount()` checks restrictions before Studio operations; valid sessions must correspond to `auth.sessions`. Owner session revocation is blocked against the protected Owner registry.

**Important limits:** Supabase Auth may keep a previously minted access JWT valid until expiry even after a refresh-session revocation. Snoozer's verified-user database checks now enforce session existence on JWTs containing a session ID, including formerly valid revoked sessions. Some external-provider operations remain separately permissioned. The OAuth sign-up path remains separate from the email-registration flag. Global effects are controllable, but maintenance mode and other unimplemented feature flags are not claimed as finished.

**Verification gate:** deploy only after full CI and provider/browser checks; preserve current Stripe subscription reconciliation and do not expose service-role credentials in user-facing code.

---

## Owner moderation, public reporting and appeals — 22 November 2026

**Second-stage release candidate (pending CI and Render):** migration `20261122052736_owner_moderation_reporting.sql` adds private RLS report, appeal and profile-quarantine tables, rate-limited verified-user report submission, appeal submission available even to restricted accounts, Owner-only report and appeal queues, MFA AAL2-gated triage, profile block/unblock, case-linked gallery takedown and appeal decisions. Public profile data, aliases, sitemap entries, and public avatar/gallery endpoints now suppress active moderated/restricted publications. Actions append to `snoozer.admin_audit_events`. A disposable-provider Playwright test covers report intake, Owner/non-Owner separation, MFA denial and public profile quarantine.

**Boundaries:** Appeals accepted in the dashboard do not automatically reinstate accounts or content; use the separate audited action after reviewing evidence. A case reference is required to appeal. Email notices and appeals received through a public support portal beyond this form are not yet integrated. Global Auth session revocation, provider-level bans and automated moderation are still open. Never assert this release is deployed until CI and Render are verified.

---

## Full Owner Administration Panel — initial implementation (22 November 2026)

**In development, not fully released:** A private migration `20261122051649_owner_administration_core.sql` adds append-only administrative action records, active account restrictions, support notes, internal moderation cases, Owner-issued Premium grant attribution, and a versioned email-registration flag. The `snoozer.verified_user()` permission boundary now rejects restricted accounts for verified-user database actions, preserving Owner recovery access. The existing `platform_owners`, `entitlement_grants`, and paid Stripe processing are retained. All new RPCs are restricted to verified Owner actors; mutations additionally require an MFA AAL2 session. Browser-only controls are not relied upon for authorisation.

**Initial UI under `/owner`:** secure navigation, search by username/email/UID, detailed user profile and grant inventory, suspension/reinstatement, Owner grants and revocation, support notes, moderation-case creation and status updates, read-only recent profile inventory, aggregate analytics, audit log, email-registration setting, system links and TOTP enrollment/verification. Sensitive actions are fail-closed if MFA has not been verified. The registration switch currently applies to **email/password signup only**, not first-time Discord OAuth sign-in; it must not be advertised as a global registration shutdown.

**Not yet complete / do not claim full six-phase sign-off:** user-originated reports and appeals, case-linked gallery takedowns through the dashboard, session revocation, Auth-level bans, public profile suspension, full inventory pagination, email notice workflows, global feature switches, maintenance mode, external provider health/controls, operational monitoring, export/delete and independent production Owner session smoke verification. These require additional secure work and tests before being marked completed.

**Verification gate:** run GitHub CI with source scanning, lint, typecheck, unit tests, disposable Supabase migrations, Next.js build and Playwright, then merge only if passing. Document deploy ID and smoke results after release.

---

## Owner Control Centre routing hotfix — 22 November 2026

**Fixed and deployed.** [PR #41](https://github.com/Truwty/snoozer-uk/pull/41) merged as commit `643ffe5fc44a1c60a3be21a8d671c058df11ad3c`. Owner route `/owner` had been accidentally omitted from `src/proxy.ts` application-route reservations, so it was looked up as a public profile username and rewritten to the profile-not-found page *before* the Owner permission check. The fix reserves the `owner` slug and adds a Playwright regression that signed-out visitors reach the expected sign-in page, not the profile-not-found page. Owner authorization is unchanged and server enforced.

**Evidence:** [CI #44987255218](https://github.com/Truwty/snoozer-uk/actions/runs/44987255218) passed full tests including browser test; Render deployment `dep-dc17f456e07s73ci0emg` confirmed **live** at 05:04:49 UTC with the exact merged commit; post-deployment ERROR logs in the checked window were empty. No independent logged-in owner-browser smoke available from this environment.

---

## Snoozer Owner release — 22 November 2026

**Verified live:** [PR #40](https://github.com/Truwty/snoozer-uk/pull/40) merged as `2b93398f4a6118d3392abb2bc8522dd28089d299`; [CI #44986077461](https://github.com/Truwty/snoozer-uk/actions/runs/44986077461) passed audit, secrets, lint, typecheck, unit tests, disposable Supabase, production build and Playwright. Render deployment `dep-dc177s9ksfps7382fbe0` reports **live**, exact merged commit, and startup logs show Next.js ready. Post-deploy ERROR logs had zero entries in the checked window. Direct public HTTP probe could not be performed from the execution environment.

The confirmed verified `@trusnooze` account now has a database-only platform-owner role with non-expiring Studio entitlements and audited billing-diagnostics permission. The public badge is assigned server-side by published-profile ownership; ordinary users cannot set it. `/owner` provides authenticated aggregate metrics and bounded read-only profile inventory, linked from the owner's account menu. Privilege tests confirmed Owner access, normal-user denial, non-exposure of Owner-table mutations, and successful public badge lookup. The account identifier is deliberately excluded from migration source. Matching hosted migration: `20261122043142_platform_owner`.

**Not yet implemented:** arbitrary user administration, cross-account editing, bans, plan grants, sitewide switches or uncontrolled access to provider secrets. These require separate auditable owner-only operations, explicit confirmation and tests. The Owner badge's live visual appearance was not independently inspected through HTTP, although Render reported the deployment live and CI verified browser rendering.

---

## Platform Owner role and badge — 22 November 2026

**Database provisioned and verified:** the previously verified account that owns `@trusnooze` is assigned a private `snoozer.platform_owners` record and a separately scoped `billing_diagnostics` staff role. Assignment was performed directly against connected Supabase after confirming a verified existing user, and the UID is intentionally not committed to the public source tree. The `platform_owner` migration is tracked as `20261122043142_platform_owner.sql`.

**Security checks:** self-owner RPC succeeds; non-owner RPC is denied; `anon` has no Owner dashboard execution grant; authenticated users cannot mutate Owner table; `is_owner_profile('trusnooze')` resolves true; owner inherits built-in Studio entitlements via `effective_plan` without a Stripe purchase or charge. This is **not an unrestricted service-role token**. Cross-account writes, user bans, billing mutations and arbitrary SQL remain separately permissioned.

**Release:** Owner Control Centre at `/owner`, secure Owner navigation and published profile badge are tracked in [PR #40](https://github.com/Truwty/snoozer-uk/pull/40). Only mark UI live after CI and Render deployment confirmation.

---

## Release verification — Advanced Profile Animations & Effects (22 November 2026)

**Merged and deployed.** [PR #39](https://github.com/Truwty/snoozer-uk/pull/39) merged as commit `225d0568282464380f60105c75a04d0f0b7f6875`. [CI #418](https://github.com/Truwty/snoozer-uk/actions/runs/44983437078) passed on its final PR commit. Render service `snoozer-uk-staging` reports the merged commit live (deployment `dep-dc16nal9fdbs739v79dg`). The matching Supabase migration `20261122040354_advanced_profile_effects` was applied and directly checked. These are provider-confirmed release states, not a full independent production UI audit; a separate browser probe of the public domain was unavailable.

**Outstanding polish:** low-end mobile performance benchmarks and a richer multi-point cursor trail. The implemented trail remains a lightweight pointer-following visual treatment. Billing settings unchanged.

---

## Advanced profile animations & effects — verified implementation (22 November 2026)

**Core implementation tested.** The `feature/advanced-profile-effects` changes add a strictly validated versioned effect catalogue, six independently configurable layers (background, border, particles, links, typography and pointer interaction), Studio preview, native no-JavaScript visitor effects toggle, reduced-motion CSS, pause-offscreen effects, and Free/Plus/Pro/Studio entitlement enforcement. Public profiles fail closed to the free tier on expiry. Unit, SQL direct-RPC bypass, disposable Supabase, lint, typecheck, production build and Playwright tests passed in [CI #416](https://github.com/Truwty/snoozer-uk/actions/runs/44982821770) after resolving selector and hydration regressions.

**Database rollout:** migration `20261122040354_advanced_profile_effects.sql` applied to connected `snoozer-staging` Supabase project and directly verified (validator exists, valid payload accepted, Free paid effects rejected, Plus permitted). No Stripe/billing gate changes.

**Release verified:** PR #39 merged to `main` at commit `225d0568282464380f60105c75a04d0f0b7f6875`. Render deployment `dep-dc16nbnmocus73an48v0` reported `live` on 22 November 2026 at 04:15 UTC. The baseline is deployed. Direct public HTTP probing from the execution environment was unavailable; the deployment assertion is based on Render's status. Low-end mobile frame-rate validation and a full multi-point cursor trail remain feature-polish follow-ups.

Relevant sources: `src/lib/profile-effects.ts`, `src/components/effects-editor.tsx`, `src/components/profile-effects.tsx`, `supabase/migrations/20261122040354_advanced_profile_effects.sql`.

---

# Snoozer.uk — current development progress (21 November 2026)

## Legal information page / sole trader disclosure — 22 November 2026

Implemented `/legal` with substantive service, subscription, privacy, legal and contact disclosures and a plainly labelled, anchor-linked business identity section near the bottom. Public-facing brand remains Snoozer; personal operator identity is disclosed only in the required legal section, with `noindex` to limit search-engine catalogue exposure but no obfuscation or access restrictions. Linked the page from homepage footer, Terms, Pricing and other legal page navigation. **Postal/geographical address is NOT PROVIDED** and must be published where required before paid Checkout is activated. No legal/tax gate or payment switch was changed. CI covers link visibility, legal section access and mobile accessibility.

---

## Operator's seller/refund preferences — 22 November 2026

Confirmed by operator: Snoozer is a UK sole-trader trading name; support email `snoozersupport@snoozer.uk`; no UK VAT registration (reports below £90,000 taxable-turnover threshold); wants worldwide subscriptions; no voluntary refunds. Customer-facing terms and Help must always preserve statutory refund and cancellation rights. **These declarations do not constitute legal/tax approval**: sole trader legal identifying name and suitable business/geographical address remain unspecified; worldwide digital-service VAT/local tax obligations remain unresolved. Operator cannot complete a live card purchase; Stripe sandbox lifecycle is **not** end-to-end production acceptance. **Keep live checkout and legal/tax review gates OFF.** See [acceptance evidence](premium-live-acceptance.md).

---


## Verified LIVE webhook and sandbox payment probes — 22 November 2026

**Signed LIVE webhook: PASS.** Created and immediately cancelled a no-payment-method LIVE trial on Snoozer's actual Stripe account. Both LIVE Stripe events were recorded and processed in Supabase; Stripe has no pending webhooks for either event, and the customer's zero-value invoice was £0 paid/£0 due with zero charges. Live Checkout remains OFF.

**Sandbox provider acceptance:** £3 initial paid invoice, cancel-at-period-end, immediate cancellation and £3 test refund **PASS**; test Checkout session created but not paid; rejected card token `card_declined` occurred at attachment, not renewal. Actual recurring invoice renewal, dispute and integrated end-user paid entitlement **NOT PROVEN**. Test fixtures cancelled and product/price archived. [Complete evidence](premium-live-acceptance.md). Real billing gates remain disabled.

---


## Priority 1 billing-readiness work — 22 November 2026

Snoozer LIVE Stripe webhook `we_1UeKYyBYH85ysT1BSqAlpvsk` enabled with 14 configured events. [PR #35](https://github.com/Truwty/snoozer-uk/pull/35) hardens Checkout-to-user webhook-binding race retries, payment event and entitlement tests, exact preflight verification, subscriber disclosures and dynamic pricing copy. Real signed event delivery and payment acceptance **not yet proven**. Server and hosted DB Checkout gates remain OFF, zero live subscribers, no real charge or refund performed. See [acceptance evidence](premium-live-acceptance.md).

---


## Production release — 22 November 2026, 00:01 UTC

**Released:** persistent sign-in, multi-account switching, top-bar redesign, Snoozer Premium Pricing and first-party searchable Help Center. [PR #33](https://github.com/Truwty/snoozer-uk/pull/33) squash-merged as [7cd4fd8](https://github.com/Truwty/snoozer-uk/commit/7cd4fd8b1916d11ffbcdc78b13a5680e527cae05); [CI #44964090069](https://github.com/Truwty/snoozer-uk/actions/runs/44964090069) fully green including disposable Supabase E2E and WCAG checks; Render deploy `dep-dc130j0u01pc738k0cfg` **Live** 2026-11-22 00:00:46 UTC with zero checked ERROR-level logs. Duplicate PR #34 was closed unmerged. Direct external HTTP smoke unavailable through the web tool.

**Features:** 365-day secure HTTP-only SSR cookies, sitewide refresh, four remembered user sessions with isolated cookie namespaces and real Supabase verification, account-switcher dropdown/modal, add/switch/remove/local logout flows, shared responsive nav, new `/pricing`, searchable `/help` and article guides. Screens stay on Snoozer theme and Discord is not a navbar button (OAuth remains supported). Provider expiration/revocation and browser cookie clearing can still end sessions; indefinite provider access cannot be promised.

**Live billing status update:** Unlike the 21 November warning below, current Render startup key audit is **authenticated** with six verified Stripe prices, the correct account and billing portal. Checkout is **still disabled** and legal/provider acceptance checks remain outstanding. No live customer charge was performed as part of this release.

---


## LIVE key validation — 21 November 2026, 22:05 UTC

After the owner reported adding `STRIPE_PREMIUM_LIVE_API_KEY` to Render, PR [#30](https://github.com/Truwty/snoozer-uk/pull/30) deployed a read-only startup probe. The first safe log was `key:not_configured`. PR [#31](https://github.com/Truwty/snoozer-uk/pull/31) then added harmless whitespace trimming and distinct missing/invalid reporting. Both PRs passed full CI and merged to `main`. Latest Render deploy `dep-dc11am1ksfps73fgvjn0`, commit `512e8f2125b640e45de42bf15796938daf096f49`, confirmed **Live** at 22:05:32 UTC; checked logs contain no error entries.

**Definitive probe result:** `{"audit":"snoozer-premium-live-key","checkoutEnabled":false,"key":"invalid_format","prices":"not_checked","account":"not_checked","billingPortal":"not_checked"}` at 22:05:28 UTC. This means the key variable is **present** in the Render server environment but (even after trimming surrounding whitespace) is not a recognised `rk_live_...` or `sk_live_...` credential. It may contain a label, placeholder, publishable/test key, extra quotes or an incomplete value. The assistant **cannot see or recover the secret** and must not ask to paste it in chat.

**Owner action:** Open [Render Snoozer service Environment](https://dashboard.render.com/web/srv-dbts6jon74is73en2rjg) (correct service ID: `srv-dbts6jon74is73en2rjg`; link must use that exact ID), edit `STRIPE_PREMIUM_LIVE_API_KEY`, paste the actual complete restricted **LIVE** key from the main Snoozer Stripe account (no quotes or code fences), then **Save and deploy**. Verify the next startup log says `key:authenticated_for_snoozer_prices`, `prices:verified_six`; separately check `account` and `billingPortal` values. **Do not enable Checkout or webhooks yet**; live payment/lifecycle and legal requirements are still outstanding. Six live GBP Prices and their Supabase mappings were already completed and verified.


## Approved LIVE Premium prices — 21 November 2026

**COMPLETE:** Owner approved and I created six recurring GBP Prices on the main verified Snoozer LIVE Stripe account, and inserted all six matching Price IDs into hosted `snoozer.premium_live_prices`. Stripe GetPrices verified exactly six active LIVE Prices with the correct products, cadence and amounts; hosted `premium_live_preflight()` verified `approvedOffers=6` across Plus/Pro/Studio. The Product default Price is monthly for each plan.

| Tier | Monthly | Monthly Stripe ID | Annual | Annual Stripe ID |
| --- | ---: | --- | ---: | --- |
| Plus | £3 | `price_1UeLyLBYH85ysT1BICf5EPJr` | £30 | `price_1UeLyYBYH85ysT1BEz7ehZP4` |
| Pro | £6 | `price_1UeLycBYH85ysT1BqE6guCme` | £60 | `price_1UeLyfBYH85ysT1BABUEkalJ` |
| Studio | £12 | `price_1UeLyjBYH85ysT1Bg7JnkUTg` | £100 | `price_1UeLypBYH85ysT1BnlVlQOVH` |

**Charges have NOT been enabled or proven.** The database remains `checkoutEnabled=false`, `legalReviewed=false`, `currentSubscriptions=0`, `customers=0`, `unprocessedReceipts=0`. Stripe LIVE webhook remains disabled; a server-side LIVE restricted API key and genuine provider acceptance test are still outstanding. Stripe Tax remains intentionally deferred but liability is not waived. Exact activation handoff is in `docs/premium-live-launch.md`.


## Release verification — creator marketplace removed (21 November 2026)

**COMPLETE:** [PR #29](https://github.com/Truwty/snoozer-uk/pull/29) merged into `main` as [commit `55b9564`](https://github.com/Truwty/snoozer-uk/commit/55b9564533a6192d985c6dbda3a65e46704112fa). [CI #44949745031](https://github.com/Truwty/snoozer-uk/actions/runs/44949745031) passed secret audit, dependency audit, lint, TypeScript, unit tests, disposable Supabase migration, build and Playwright. Render deploy `dep-dc10h8qjnfac73fa24tg` confirmed **Live** 21 November 2026 at 21:11:50 UTC, exact merged commit; post-deploy ERROR logs checked for the period beginning 21:10 UTC found zero entries. An external direct HTTP smoke fetch could not be verified through the web tool, so do not represent it as independently performed.

**Only Snoozer Premium is sold.** 157 creator-marketplace source, test, UI and documentation files removed plus shared-path cleanup, and all `/store/*`, `/studio/products/*`, `/studio/memberships/*`, `/studio/donations/*`, `/studio/purchases/*`, `/studio/support/*`, `/studio/product-reports/*`, `/api/v1/commerce/*` paths now 404 under the site proxy. GitHub main tree audit found zero marketplace application files; historical SQL migrations intentionally remain.

Supabase retirement migration `20261121205733_retire_creator_marketplace_and_optional_tax` applied successfully. Four SQL CHECK constraints permanently require retired creator policy/offers/Ko-fi hooks `enabled=false`; marketplace RPC EXECUTE revoked from anon, authenticated and service_role. Confirmed old one paid £5 **SANDBOX** order preserved, and private PDF Storage bucket has no direct access policies. Nine creator-specific Render env keys cleared/forced false; three sandbox creator webhook destinations remain disabled. No historical payment/financial records deleted.

**LIVE Stripe products created on the VERIFIED MAIN Snoozer account**: Plus `prod_VfgMlUsOz4GELl`; Pro `prod_VfgMPjnzui1zGl`; Studio `prod_VfgMvCX05yAJSj`. Verified active live-mode and owned by Snoozer. Live Stripe Price count **6**, live subscriptions **0** and hosted Premium prices **6**; no actual LIVE payment was processed or proven. Live Checkout remains disabled by server+database launch gates. Stripe Tax was intentionally omitted at owner request: `automatic_tax.enabled=false`, removed tax-specific gating but **merchant tax obligations remain**. Live Billing Portal active, live signed webhook destination configured but disabled; restricted LIVE API key not installed/verified. Legal approval remains unconfirmed.

**Exact next blockers for working LIVE payments:** (1) Owner securely creates/installs a restricted LIVE Stripe key as `STRIPE_PREMIUM_LIVE_API_KEY` in Render; (2) completes seller/legal/consumer terms review; (3) verifies signed LIVE Stripe webhook and end-to-end subscription Checkout, renewal/failure/cancellation/refund/entitlement lifecycle; (4) enables live gate only after successful acceptance. Six prices are already approved and bound. Do not enable webhook or charging flags until verified. Read `docs/premium-live-launch.md` for exact steps.


## Delivered
- Profiles, login via email/Discord, public publishing and Studio, templates, gallery, private media, analytics, leaderboard, custom domains, consent and privacy UI.
- Production hosted in Render with GitHub and Supabase and passing core CI (most recent prior green CI: <https://github.com/Truwty/snoozer-uk/actions/runs/44946031912>).
- Snoozer's only monetisation direction: its own Premium Plus/Pro/Studio subscriptions, no third-party selling.
- LIVE merchant Stripe account verified, Premium Billing Portal configured with cancellation/invoice/card update, separate signed webhook destination provisioned but disabled, isolated gated Premium Checkout and reconciliation code deployed as PR #28.
- Three LIVE Stripe products created on 21 November 2026 (Plus `prod_VfgMlUsOz4GELl`, Pro `prod_VfgMPjnzui1zGl`, Studio `prod_VfgMvCX05yAJSj`). **These now have six approved LIVE recurring prices; Checkout is still disabled until credential and provider tests pass.**
- Database `snoozer.premium_live_policy` gated off; no live customers, subscriptions or grants on the last verification. Product sales must not be advertised as working.
- Marketplace retirement PR #29 was merged and verified deployed; 157 creator-specific files plus shared cleanup were removed, with historical financial data retained.

## Outstanding
- PR #29 is finished and the retired creator API is revoked for user and service credentials.
- Prices COMPLETE: six approved LIVE GBP recurring prices are bound and verified in Supabase.
- Restricted LIVE Stripe API key must be saved on Render; no live transaction can be proven until this is done.
- Owner legal/consumer terms review, production signed event proof and full billing lifecycle tests, deliverability tests, support/refund readiness, backup/restore and security advisor reviews.
- Stripe Tax deferred at owner request; the business still must determine any legal VAT/tax liability separately. Checkout set to disable automatic-tax calculation on PR #29.
- Stripe webhook disabled intentionally until live key, prices and testing. No real customer payment was created by this work.

## Source of truth
`docs/CONTINUE.md`, `docs/premium-live-launch.md`, `docs/feature-ledger.md`. Retired project features and their old tests are preserved only in Git history and retained financial records. Do not reopen creator commerce.
