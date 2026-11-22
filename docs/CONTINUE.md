## Owner administration — verified releases and remaining acceptance, 22 November 2026

**Released on main with full CI and hosted database migrations:**
- [PR #47](https://github.com/Truwty/snoozer-uk/pull/47) (commit `f36379652fa7a0318c51c3e3728809c6b16fb3e5`, [CI 44995471696](https://github.com/Truwty/snoozer-uk/actions/runs/44995471696) passed, hosted migration `20261122064925_owner_maintenance_mode`, Render `dep-dc194o2fngtc73f0dp4g` confirmed live): AAL2-gated audited public visitor maintenance switch with a 503 response and recovery/billing exemptions; existing effects switch now appears in Owner settings. Maintenance is **off by default**, independently confirmed in hosted settings.
- [PR #48](https://github.com/Truwty/snoozer-uk/pull/48) (commit `655d5e2284afcbddec00d359c9990167175afc29`, [CI 44995814847](https://github.com/Truwty/snoozer-uk/actions/runs/44995814847) passed, hosted migration `20261122065402_owner_privacy_notifications`, Render `dep-dc196gl6e07s73cn527g` confirmed live): authenticated privacy export/deletion **request intake and manual Owner review** with AAL2/audit, owner-only private queue and user status page; private **in-app** Owner action notifications for restriction, reinstatement, Premium grants/revocation, appeals. RPC permission check confirmed unauthenticated role cannot execute private functions. Automatic data exports/deletion, Stripe cancellation and outbound email are not implemented.
- [PR #49](https://github.com/Truwty/snoozer-uk/pull/49) (commit `7aa9ebbcbdfaeac8367df5bd2593eec25f2c1470`, [CI 44996348177](https://github.com/Truwty/snoozer-uk/actions/runs/44996348177) passed, Render `dep-dc19ah2jnfac73845v30` confirmed live): data requests and private notices remain accessible during visitor maintenance.
- [PR #50](https://github.com/Truwty/snoozer-uk/pull/50) (commit `879ace83926f41b7fea8224cc2c23e384d6430a8`, [CI 44996753842](https://github.com/Truwty/snoozer-uk/actions/runs/44996753842) passed): read-only, bounded and validated public incident status for Render, Supabase and Stripe in Owner system. **Render deploy queued/in progress at documentation write**; do not mark this feature live until Render verifies.

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

## Snoozer Owner release — 22 November 2026

**Verified live:** [PR #40](https://github.com/Truwty/snoozer-uk/pull/40) merged as `2b93398f4a6118d3392abb2bc8522dd28089d299`; [CI #44986077461](https://github.com/Truwty/snoozer-uk/actions/runs/44986077461) passed audit, secrets, lint, typecheck, unit tests, disposable Supabase, production build and Playwright. Render deployment `dep-dc177s9ksfps7382fbe0` reports **live**, exact merged commit, and startup logs show Next.js ready. Post-deploy ERROR logs had zero entries in the checked window. Direct public HTTP probe could not be performed from the execution environment.

The confirmed verified `@trusnooze` account now has a database-only platform-owner role with non-expiring Studio entitlements and audited billing-diagnostics permission. The public badge is assigned server-side by published-profile ownership; ordinary users cannot set it. `/owner` provides authenticated aggregate metrics and bounded read-only profile inventory, linked from the owner's account menu. Privilege tests confirmed Owner access, normal-user denial, non-exposure of Owner-table mutations, and successful public badge lookup. The account identifier is deliberately excluded from migration source. Matching hosted migration: `20261122043142_platform_owner`.

**Not yet implemented:** arbitrary user administration, cross-account editing, bans, plan grants, sitewide switches or uncontrolled access to provider secrets. These require separate auditable owner-only operations, explicit confirmation and tests. The Owner badge's live visual appearance was not independently inspected through HTTP, although Render reported the deployment live and CI verified browser rendering.

---

## Owner role — 22 November 2026

Platform-owner role assigned to the existing verified `@trusnooze` Supabase account via a private row, not profile metadata. Migration file `20261122043142_platform_owner.sql` contains no hardcoded user ID. Database checks confirm the verified badge, Studio tier override, privilege restrictions and Owner dashboard RPCs. [PR #40](https://github.com/Truwty/snoozer-uk/pull/40) introduces the public Owner badge, an owner-only `/owner` overview and navigation. Check CI, merge and Render deployment before marking the UI live.

**Limitations:** the Owner role grants the highest existing product entitlements and access to explicitly authorised admin tools, not blanket browser access to other users, secret API keys, Stripe actions or arbitrary SQL. Build audited user management, moderation and site-setting actions as separately secured follow-ups.

---

## Post-release follow-up — Advanced Profile Animations & Effects (22 November 2026)

The core approved feature is **merged and deployed** to Render staging, verified by [PR #39](https://github.com/Truwty/snoozer-uk/pull/39), [CI #418](https://github.com/Truwty/snoozer-uk/actions/runs/44983437078), and live Render deployment `dep-dc16nal9fdbs739v79dg` at commit `225d0568282464380f60105c75a04d0f0b7f6875`. Supabase migration `20261122040354_advanced_profile_effects` is applied. Do not rerun migration manually.

Next optional work: check real user profiles on the public domain, benchmark mobile frame rates and battery behaviour, extend the cursor trail and design polish, and update roadmap entries only after the separate improvements pass tests. The native visitor disable control is verified in Playwright and works without hydration. Render auto-deploy is disabled; deploy future code changes manually.

---

## Advanced Profile Animations & Effects — verified core / post-merge checks (22 November 2026)

The approved implementation is in [PR #39](https://github.com/Truwty/snoozer-uk/pull/39). [CI #416](https://github.com/Truwty/snoozer-uk/actions/runs/44982821770) passed full checks (lint, audit, TypeScript, unit/database, disposable Supabase, Next.js build and Chromium Playwright). The connected staging Supabase instance has the matching `20261122040354_advanced_profile_effects` migration applied and SQL verified. The visitor effects switch uses an accessible native checkbox so it works without hydration.

**Release check:** PR #39 was merged to `main` (`225d056`) and Render deploy `dep-dc16nbnmocus73an48v0` reported `live` on 22 November 2026 at 04:15 UTC. The six-layer baseline is deployed. Direct HTTP/live-user-session verification was not possible from this environment and should be included in routine operator smoke testing. Remaining enhancement work: fully animated multi-point cursor trail, low-end mobile FPS validation and additional visual polish. Free: gradient/entrances; Plus: two layers; Pro: four with interactive effects; Studio: six with exclusive presets. No billing switch changes.

---

# Development continuation — Snoozer.uk

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


## Priority 1 billing readiness — 22 November 2026

**Implementation in [PR #35](https://github.com/Truwty/snoozer-uk/pull/35):** public Pricing responds to the real application/database Checkout gates; Terms and Help explain recurring subscriptions, renewal, cancellation and support; startup preflight checks the exact Stripe webhook destination and 14 event types; new unit tests cover signed-webhook dispatch, retries, idempotence and provider-backed entitlement reconciliation.

**Provider action completed:** LIVE webhook `we_1UeKYyBYH85ysT1BSqAlpvsk` was enabled on the correct Snoozer LIVE Stripe account with all 14 event types. API key read-only authentication and six live GBP Prices were previously verified. **Checkout remains deliberately disabled** in Render and database; hosted preflight confirms zero live customers and subscriptions. No real charge has been processed. Actual signed webhook delivery, provider acceptance payments, renewal/refund/failure flows and seller/consumer disclosures require separate real-world verification. See [Premium acceptance matrix](premium-live-acceptance.md). Do not override the launch gates based solely on mock tests or configured webhook status.

---


## Latest continuation — 22 November 2026, 00:01 UTC (supersedes older key warning)

**COMPLETE AND LIVE: persistent sign-in, multi-account switching, shared navigation, Pricing and Help Center.** PR [#33](https://github.com/Truwty/snoozer-uk/pull/33) merged to main as [7cd4fd8](https://github.com/Truwty/snoozer-uk/commit/7cd4fd8b1916d11ffbcdc78b13a5680e527cae05). [CI #44964090069](https://github.com/Truwty/snoozer-uk/actions/runs/44964090069) passed audit/lint/typecheck/unit/Supabase/build/Playwright accessibility and integration checks. Duplicate PR #34 closed unmerged. Render deploy `dep-dc130j0u01pc738k0cfg` confirmed **live** 22 Nov 00:00:46 UTC, exact commit; subsequent ERROR-level logs contained no entries. External independent page fetch through the web tool was unavailable; do not claim an external HTTP smoke check.

- Supabase SSR sessions use secure HTTP-only 365-day browser cookies, sitewide refresh and isolated account slots (up to four saved accounts); Auth still controls revocation, session expiry and password resets. Email/password and Discord OAuth both retain independent sessions, with server-validated switching and per-account local sign-out. The account manager is a themed dropdown/dialog.
- Shared themed top navigation covers homepage, templates, leaderboard and Studio; Help Center at `/help` provides searchable first-party articles, and `/pricing` shows approved Snoozer-only Plus/Pro/Studio monthly/yearly prices and real plan allowances.
- Render startup preflight on this release **supersedes the old invalid-format diagnosis below**: `key:authenticated_for_snoozer_prices`, `prices:verified_six`, `account:verified`, `billingPortal:verified`. **`checkoutEnabled:false`** remains deliberate; no live payment processed or authorized. Do not enable live billing/webhooks until legal, lifecycle and provider acceptance checks are complete.
- Next verification: owner/browser manual sign-in after reopening the browser (including Discord), sign in with second account, switch and local logout; review customer-facing account UI on actual mobile devices. CI covers reload/navigation persistence and isolated multi-account browser sessions on disposable Supabase; actual close-and-reopen behaviour still needs a manual production-browser check. Keep live payment configuration gated.

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


## Product direction (binding, 21 November 2026)
Snoozer is a link-in-bio/profile platform. **Only Snoozer itself may sell Premium Plus, Pro and Studio subscriptions.** There is no third-party marketplace, seller onboarding, PDFs for sale, creator memberships, merchant tips, connected-account Checkout, or digital-product storefront. Do not rebuild those functions even if older git history/old specifications mention them.

## Exact current state
- Main verified Stripe LIVE merchant: `acct_1UdI9LBYH85ysT1B`.
- Three LIVE Stripe Products created: Plus `prod_VfgMlUsOz4GELl`, Pro `prod_VfgMPjnzui1zGl`, Studio `prod_VfgMvCX05yAJSj`. **Six owner-approved LIVE recurring Prices created and stored in Supabase; no genuine live payment accepted.**
- Stripe live Billing Portal `bpc_1UeKY2BYH85ysT1BioyXeK9C` configured; webhook `we_1UeKYyBYH85ysT1BSqAlpvsk` is DISABLED and its separate signing secret is stored on Render.
- Premium code from merged PR #28 runs on Render (commit `f03e231186ba6e16c339833b3bbb8f3121f4cb5d`). CI #44946031912 passed; hosted additive Premium database schema installed with RLS/private RPC checks. LIVE Checkout OFF; prices are now configured, but a restricted live API key, provider test and legal review remain before activation.
- Owner explicitly deferred Stripe Tax configuration. Checkout code uses `automatic_tax.enabled=false` on PR #29 branch; independent merchant tax obligations remain. Tax approval should NOT be silently fabricated or manually marked complete.
- Seller marketplace source/UI/API/routes removed merged to `main` in [PR #29](https://github.com/Truwty/snoozer-uk/pull/29). Historic creator SQL migrations and test payment records remain as audit evidence. Retirement migration has been applied to hosted Supabase with permanent policy constraints and revoked legacy RPCs.
- Render verified deployed main commit `55b9564533a6192d985c6dbda3a65e46704112fa`.

## What to work on next
1. Marketplace removal PR #29 is finished; verify the deployed 404 routes after any future releases.
2. Six LIVE recurring prices were approved, created and verified on Stripe and Supabase; no further price decisions needed unless the owner changes pricing.
3. Have owner create and securely install scoped LIVE key in Render. Verify live subscription Checkout only after price and legal/provider tests; never expose secret or create an actual charge on behalf of an unwitting customer.
4. Run `npm run billing:live:preflight`, validate signed webhooks, protected entitlement grants, cancellation, renewal, failure, refunds, disputes and customer support flows; review live emails, backup/restore, and auth security advisor warnings.
5. Preserve historical paid test orders/receipts and Git migration history; do not drop financial records or shut a connected Stripe account without separate review.

## Operations
Render service `srv-dbts6jon74is73en2rjg` in workspace `tea-d7omjhu7r5hc73dh1fd0`; Supabase project `edgptbiwswcdmmxzwhxv`; GitHub `Truwty/snoozer-uk`. Run `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e -- --workers=2`, and `npm run billing:live:preflight`.

See `docs/premium-live-launch.md` for exact requirements. Historical development checkpoints are in Git commits before PR #29 rather than active roadmap files.
