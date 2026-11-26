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
- In the sampled 26 November 03:15–04:20 UTC Render metrics, memory ranged from approximately 225 MB to 273 MB against a 512 MiB limit. Render returned no HTTP latency or request-count time series for that sample.
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
| RLS enabled without a table policy | 116 | Verify private-schema access and table grants; preserve intentionally service-only tables |
| Security-definer functions executable by anon | 16 | Function-by-function public API and privilege review |
| Security-definer functions executable by authenticated | 177 | Verify identity/ownership checks and owner assurance; no blanket revocation |
| Unindexed foreign keys | 82 | Rank by workload, row counts and query plans before indexing |
| Unused-index notices | 25 | Establish usage window and write overhead before removal |
| Duplicate-index warning | 1 | Verify duplicate definition and dependencies before removal |
| Table without a primary key | 1 | Check whether published_profiles is a projection/materialised snapshot and choose an integrity-safe key |

Supabase also reports leaked-password protection as a warning; its Auth configuration should be verified and enabled where appropriate.

## Workload observations

The connected database's pg_stat_statements counters showed repeated scheduled work around publication dispatch, analytics retention cleanup, domain-request cleanup and Discord presence subscription reads. These operations are expected to recur, so call totals alone do not prove a performance problem. The next step is to inspect schedule frequency, query plans, lock waits, table growth and average/max latency before changing job cadence or SQL.

The Render metrics sample did not expose HTTP request counts or latency. Performance conclusions must therefore be based on a repeatable browser/Lighthouse baseline and a better request-metrics sample, not CPU/memory alone.

## Codebase findings

- The root layout forced every route into dynamic request-time rendering.
- Homepage and Help Centre stylesheets were imported by the root layout despite only being used on their respective route groups.
- Public profile cards statically imported optional YouTube, Spotify, Twitch, metadata and interactive widgets.
- The global application stylesheet is approximately 213 KB of source CSS; deeper stylesheet extraction requires selector/route analysis to avoid regressions.
- The server-side public-profile reader already uses React request memoisation. Persistent caching is not introduced until invalidation on publish, unpublish, rename, restriction and deletion can be proven.

## Implementation progress

- [x] Create isolated optimisation branch and draft PR; main remains unchanged.
- [x] Remove the root-level force-dynamic override.
- [x] Move homepage CSS to the homepage route.
- [x] Scope Help Centre CSS to a Help route layout.
- [x] Split optional public profile widgets into dynamic chunks with SSR retained.
- [x] Apply and verify the 14 outstanding 26 November migrations on connected staging.
- [x] Reconcile Premium documentation with owner-confirmed enabled payment state.
- [ ] Complete full CI for the final optimisation PR head.
- [ ] Complete function-by-function security-definer and RLS review.
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
- Of the authenticated-executable functions, 22 did not match a simple source-code identity-helper pattern. Manual inspection found that the account privacy and notification routines use `snoozer.privacy_actor()`, which requires a verified account and active auth session; public-read functions are intentionally exposed; remaining owner operations use the dedicated owner guard. This heuristic is not a substitute for reviewing every function body, so the review remains tracked.

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
