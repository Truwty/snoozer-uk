# Snoozer platform optimisation — audit and implementation record

**Audit date:** 26 November 2026  
**Baseline main commit:** c57d68733f5e3ebccd3ebc495b84788f406175db  
**Implementation branch:** optimization/full-platform-hardening  
**Tracking PR:** #114 (draft)

## Payment-preservation boundary

Live Snoozer Premium Checkout is intentionally enabled. The owner explicitly confirmed that the live payment configuration is valid and payments are meant to be accepted. This programme must not disable Checkout, modify the six LIVE GBP prices, change Stripe account or webhook configuration, rotate payment credentials, or alter the payment activation gates.

The connected Supabase project currently reports all three Premium policy flags true. Its preflight returns six approved offers, one customer, zero current subscriptions and zero unprocessed receipts. Render's 26 November 04:12:30 UTC startup audit verified the LIVE key, six prices, account and Billing Portal. The payment launch document has been corrected to reflect this state.

## Baseline environment

- Repository tree at the baseline commit contained 798 entries.
- Connected Render resource: free Frankfurt web service named snoozer-uk-staging, tracking main with commit-triggered auto-deploy.
- The service was configured with no HTTP health-check path, although the repository Blueprint defines /health/live and checksPass deployment triggering.
- In the refreshed 24-hour Render metrics sample ending 26 November 2026 05:08 UTC, memory samples ranged from approximately 227 MB to 311 MB against a 512 MiB (536,870,900-byte) limit. The latest sample was approximately 282.5 MB. CPU samples were low; Render returned no HTTP latency, request-count or instance-count time series. This is an infrastructure sample, not a route-level performance benchmark.
- The sampled Render application-error and HTTP 5xx log queries returned no entries. This is a bounded sample, not proof of zero production errors.

## Database migration reconciliation

The main branch contained 14 migrations dated 26 November 2026 that had not yet been recorded in the connected staging project's migration registry. They were applied in timestamp order and the Supabase migration history versions were reconciled to the exact repository versions.

Verified result:
- Latest migration: 20261126090013.
- Total recorded migrations: 160.
- Username rename, profile UID and redirect fields exist.
- Marketing preference, custom badge, community template and Image Host text-paste tables exist.
- The plan catalogue includes the custom badge quota column.
- All Premium payment gates remain true and all six LIVE offers remain available.

## Supabase advisory baseline after migration

These are advisor findings, not automatically confirmed vulnerabilities. The private application schema is intentionally protected from direct anon/authenticated table access. Review each item against actual grants, query plans, and application requirements.

| Advisor | Current count | Planned treatment |
| --- | ---: | --- |
| RLS enabled without a table policy | 116 | Reviewed: all 116 tables are in private `snoozer`; `anon` and `authenticated` have no schema USAGE or direct SELECT/INSERT grants. Preserve service-only design; do not add broad policies |
| Security-definer functions executable by anon | 16 | Reviewed as bounded public readers; retain only after visibility predicates and response fields remain tested |
| Security-definer functions executable by authenticated | 177 | 163 use identity/session/owner guard helpers; remaining 14 are STABLE read-only lookups with no mutation statements. No blanket revocation |
| Unindexed foreign keys | 82 | Rank by workload, row counts and query plans before indexing |
| Unused-index notices | 25 | Establish usage window and write overhead before removal |
| Duplicate-index warning | 1 | Verify duplicate definition and dependencies before removal |
| Table without a primary key | 1 | `published_profiles` is a profile-scoped snapshot history table. Existing UNIQUE `(profile_id, revision)` backs five foreign keys; a primary-key rewrite is not justified for a 23-row staging table |

Supabase also reports leaked-password protection as a warning; its Auth configuration should be verified and enabled where appropriate.

## Workload observations

The connected database's pg_stat_statements counters showed repeated scheduled work around publication dispatch, analytics retention cleanup, domain-request cleanup and Discord presence subscription reads. These operations are expected to recur, so call totals alone do not prove a performance problem. The next step is to inspect schedule frequency, query plans, lock waits, table growth and average/max latency before changing job cadence or SQL.

The Render metrics sample did not expose HTTP request counts or latency. Performance conclusions must therefore be based on a repeatable browser/Lighthouse baseline and a better request-metrics sample, not CPU/memory alone.

## Codebase findings

- The root layout still forces dynamic request-time rendering. Removing that override exposed a Server Action `Origin: null` regression in the password-reset E2E flow, so it was restored and is deferred until a route-isolated replacement is proven.
- Homepage, Help Centre, Pricing, Leaderboard, Discover and Studio styles have been moved to route-level stylesheets/layouts. Approximately 66,840 CSS characters were removed from the root global stylesheet, reducing it by about 31%.
- Public profile YouTube, Twitch and external metadata widgets are now separate dynamically loaded chunks with SSR retained. Spotify and the interactive widget shell remain server-rendered to preserve initial profile HTML and existing tests.
- Root global CSS was approximately 213 KB of source before extraction and is approximately 146 KB after route-specific extraction. Further extraction still needs selector ownership and cascade regression checks.
- The server-side public-profile reader already uses React request memoisation. Persistent caching is not introduced until invalidation on publish, unpublish, rename, restriction and deletion can be proven.

## Implementation progress

- [x] Create isolated optimisation branch and draft PR; main remains unchanged.
- [ ] Remove the root-level force-dynamic override (deferred after the password-reset Server Action regression; the root dynamic baseline is retained).
- [x] Move homepage CSS to the homepage route.
- [x] Scope Help Centre CSS to a Help route layout.
- [x] Split optional public profile widgets into dynamic chunks with SSR retained.
- [x] Apply and verify the 14 outstanding 26 November migrations on connected staging.
- [x] Reconcile Premium documentation with owner-confirmed enabled payment state.
- [x] Full CI on PR head `c1427149ab156114a39495974fc9cc983a01ae68`: run [#45758701026](https://github.com/Truwty/snoozer-uk/actions/runs/45758701026) passed all security/quality jobs, unit/database tests, five Playwright shards and aggregate `validate`.
- [x] Complete SQL privilege/RLS/SECURITY DEFINER risk triage and Storage path review (read-only evidence; not a formal penetration test).
- [ ] Prioritise foreign-key indexes using measured query plans.
- [ ] Investigate duplicate and unused indexes with a sufficiently long usage window.
- [ ] Profile and optimise scheduled database work where measurements justify changes.
- [ ] Establish browser performance baselines and compare post-change results.
- [ ] Complete responsive, accessibility and account/billing regression checks.
- [ ] Update all continuation and operational documentation.

## Release boundary

No changes from this optimisation branch have been merged into main. No Render deployment has been manually triggered. The connected Render service tracks main and auto-deploys main commits; keep implementation on this branch until the owner reviews the final PR.

The connected Supabase target inspected for migration reconciliation is the staging project. Do not apply these changes to another database without separately verifying its identity, current migration history and release approval.


## Security advisory triage detail

A second read-only SQL pass after the migrations established:

- All 379 public-schema SECURITY DEFINER functions have a function-level `search_path` setting; none of the inspected public functions is missing it.
- The 116 RLS-enabled tables reported without policies have no direct SELECT or INSERT privilege granted to either `anon` or `authenticated` (zero tables with either privilege). Their policy-free state is consistent with private/service-only access, not a demonstrated public-table exposure.
- The 16 anonymous-executable SECURITY DEFINER functions are primarily deliberate public reads (published profile, leaderboard, profile existence/address resolution, published styling tier, sitemap, maintenance/effects state, username availability, public community template, public badge artwork and public text paste). Verify returned columns and owner/public visibility predicates rather than revoking these wholesale.
- Of the 177 authenticated-executable functions, 163 include `snoozer.verified_user()`, `auth.uid()`, `snoozer.privacy_actor()` or `snoozer.admin_actor()` in their function body. The other 14 are all `STABLE` and their bodies contain no `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE` or dynamic `EXECUTE` statement; they are bounded read-only helpers such as public metadata/status resolution and lookups. This source/privilege classification found zero unguarded mutating functions in that 14-function subset. It is a static SQL review, not a formal penetration test.

The leaked-password-protection advisor warning remains to be checked in Supabase Auth settings. The current connector provides read-only project/database controls but does not expose this Auth setting as a supported mutation.

## Branch protection follow-up

GitHub reports branch protection disabled on `main`, with no required status checks. The available GitHub connector exposes read operations for protection/rulesets but not their administration. Before this branch is merged, the repository owner should enable a main-branch rule requiring a pull request and successful aggregate `validate` status, disallowing force pushes and deletions, and requiring the appropriate review policy. This optimisation work does not change repository administration settings.


## Scheduled workload interpretation

The cumulative query statistics align with the configured job and worker cadences:

- Publication dispatch: 11,228 calls at a mean of approximately 6.64 ms. The registered `snoozer-publications-v1` cron job runs once per minute and processes at most ten due publications.
- Domain-request cleanup: 11,150 calls at a mean of approximately 5.00 ms. This cleanup runs alongside the once-per-minute publication job.
- Analytics retention cleanup: 2,334 calls at a mean of approximately 23.31 ms. The registered analytics cleanup runs every five minutes.
- Discord subscription reads: 4,379 calls at a mean of approximately 16.33 ms. The Discord worker refreshes subscriptions every 60 seconds; it sends heartbeat updates every 30 seconds.

These counters are cumulative and do not indicate a fault by themselves. At current measured means, the repeated scheduled work is not an optimisation target. Monitor the maximum latency, table growth, lock waits and failed cron runs as volume increases. Do not reduce publication cadence or disable cleanup simply to reduce call counts.

## Index decision at the audited staging scale

The live application tables currently contain only a small number of rows (for example, six profiles and 23 published profile snapshots). The advisor's 82 missing-FK-index notices include retired creator-marketplace/sandbox tables and foreign keys already covered by a different access path. The 25 unused-index notices are not sufficient evidence to remove indexes because staging has low data volume and the observation window is limited.

No index was added or removed during this audit. In particular:
- Preserve the existing ordered/composite keys used by profile and publication snapshots.
- Revisit owner/profile composite FK indexes only where query plans or cascade/delete costs demonstrate benefit.
- Do not drop the duplicate-looking sandbox checkout key/primary-key index before confirming constraints, dependencies and the historical-data retention requirements.
- Re-run index usage measurement after meaningful traffic or a sustained observation period.


## Seven-day scheduled job reliability sample

A direct read-only query of `cron.job_run_details` at 26 November 2026 04:35 UTC returned the following results:

| Job | Schedule | Runs in last 7 days | Successful | Other statuses | Mean run duration |
| --- | --- | ---: | ---: | ---: | ---: |
| Analytics cleanup | Every 5 minutes | 2,016 | 2,016 | 0 | 64.25 ms |
| Creator retention | At :17 and :47 each hour | 305 | 305 | 0 | 35.54 ms |
| Publications | Every minute | 10,080 | 10,080 | 0 | 46.99 ms |

All three jobs were active and the latest completed runs were on 26 November. This is a healthy seven-day sample. No schedule frequency changes or job rewrites are justified by the current data. Preserve these values as the baseline and monitor failure rate, run duration and backlog as traffic grows.


## Follow-up correction after browser regression review

The initial removal of the root `force-dynamic` rendering override was reverted on the optimisation branch after the full Playwright run exposed a Server Action origin failure in the profile/password-reset lifecycle flow. The safer baseline is retained until that interaction can be isolated in a focused test. No claim is made that global request-time rendering has been optimised yet.

A route-specific tablet/mobile header layout is now being added for non-homepage pages. It moves the shared navigation into its own second row at tablet widths and allows links to wrap on smaller screens; the homepage retains its separate art-directed header. The homepage stylesheet cascade is also kept in its original order: the rules formerly in root styles.css remain before the dedicated homepage stylesheet rules.

## Expanded access-control and Storage review — 26 November 2026

The latest read-only SQL review verified the advisor findings against actual privileges and the deployed application call paths:

- All 116 policy-free RLS tables are in `snoozer`. Both `anon` and `authenticated` lack `USAGE` on that schema and have no direct `SELECT` or `INSERT` grants on those tables. No public-schema table without policies was found by this review. The application exposes bounded RPCs from `public` and uses a server-side service client for its private schema. No RLS policies were added.
- All 379 `public` SECURITY DEFINER functions have function-level `search_path` configuration (zero missing). In `public`, 16 functions are executable by `anon`; the reviewed set consists of public-facing reads and status/lookup helpers with explicit public/published predicates where the data is user content. The 177 authenticated-executable functions comprise 163 with a recognisable identity/session/owner helper and 14 additional `STABLE` read-only functions without mutation statements. No broad EXECUTE revocations were made.
- The two `snoozer` SECURITY DEFINER routines that report EXECUTE grants to `anon`/`authenticated` remain unreachable through the API roles because neither role has `USAGE` on the `snoozer` schema.
- `snoozer.admin_actor()` delegates to `verified_user()`, requires a platform-owner identity, and for writes checks AAL2 plus a current session row. `snoozer.privacy_actor()` requires a confirmed email and a current Auth session. `snoozer.verified_user()` validates email confirmation, session validity, enrolled-TOTP AAL2 and account restrictions.
- The six Storage buckets are all private (`public=false`) with MIME and per-file size limits. `storage.objects` has RLS enabled and no direct policies, so there is no direct browser object policy. Upload actions call `requireAccount()`, use the server-only `storageAdmin()` client, create scoped signed upload tokens, and validate/process/commit files server-side. Public media routes resolve publication visibility via database RPCs before reading private objects using the service role. This is the code-path review; negative unauthenticated Storage acceptance tests and an independent penetration test remain separate assurance work.
- The single `no_primary_key` notice is on `snoozer.published_profiles`. Its original primary key was intentionally dropped in `20261110005100_profile_scoped_constraints.sql` during the move to profile-scoped snapshot relationships. The table retains a UNIQUE `(profile_id, revision)` key referenced by five foreign keys, and staging contains 23 rows with 23 distinct non-null pairs. Replacing that unique key with a primary key would require coordinated dependency changes and is not a meaningful scale optimisation at current table size; leave it unchanged.
- The leaked-password protection warning still requires verification in Supabase Auth settings. The available project/database connector does not expose this Auth setting for read or write.

## Render drift and remaining performance evidence

The active Render service still has an empty `healthCheckPath`, while the checked-in Blueprint declares `/health/live`. The service tracks `main` with commit-triggered auto-deploy, and no deployment or service setting was changed. Reconcile this configuration only as a separately reviewed release operation.

The current Render metric endpoint continues to return no HTTP request count, p95 latency or instance-count series. Route-level Lighthouse/Web Vitals and authenticated Studio/Discover profiling have not yet been collected. Therefore this audit does not claim a proven LCP/INP improvement or a measured page-speed percentage. The completed CSS and optional-widget splitting reduce global stylesheet and initial optional widget loading scope, but route-level before/after browser measurements remain outstanding.