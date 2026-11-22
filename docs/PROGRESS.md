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
