# Milestone 4 review

This review follows the master specification's delivery order and its explicit instruction to ship a tested critical subset while keeping unimplemented inventory items deferred. It is not a claim that all optional analytics and integration features, or the entire platform, are finished.

**Core/staging exit passed on 18 November 2026**, source 7f38cff / migrations through 59. Advanced inventory below remains unfinished work.

## Exit evidence

| Roadmap gate | Implemented path | Verification |
| --- | --- | --- |
| Privacy-aware events and attribution | Explicit consent; bot/GPC/DNT handling; server-validated owner exclusion; published-link validation; replay receipts; coarse source/device and registered campaigns | Unit/SQL, disposable browser and hosted staging evidence in analytics.md and analytics-campaigns.md |
| Charts and exports | UTC daily chart/table, per-link and campaign tables, owner-only downloads, formula-safe creator strings | Real CSV downloads, axe checks, unauthorised reads and failure states |
| Daily browser methodology and CTR | Fresh V3 consent, independent profile/day random codes, hashed deduplication, click-before-view handling, no people claims or cross-day unique sum | CI 44218187287 and hosted two-view/one-click → one-browser/100% CTR, actual CSV, owner/privacy/role checks pass |
| Retention | Plan-based owner reads; bounded intake/maintenance cleanup, deletion cascades | SQL tests pass; native pg_cron success at 2026-11-18 01:50 UTC removed the isolated old-hash fixture |
| Widget framework | Shared published links and typed, versioned public provider adapters; refresh leases, bounded payloads and provider budgets/backoff | CI 44187169499, actual staging GitHub and Discord public metadata |
| Embeds and graceful fallback | Separate YouTube/Twitch load/hide; Twitch sizing/parent/mute guards; no autoplay; ordinary outbound links survive failures | CI and hosted player/hide checks; Twitch offline state is verified, live playback is not |
| Revocation and isolation | Removed published integration links cannot read cached results; service-only writes/cache; verified owner-only reports | Disposable SQL/browser tests, staging privilege checks |

## Deliberate scope and entitlements

All shipped metrics, campaigns (up to 20 per profile) and consent-scoped widgets are available on every plan. Retention is Free 30 / Plus 180 / Pro 730 / Studio 1,095 days. Daily limits are 10,000 views and 10,000 clicks, not a promise of abuse prevention. Public metadata provider budgets are shared infrastructure safeguards, not premium quotas. There are no paid claims for unimplemented features.

| Deferred inventory | Decision and future work |
| --- | --- |
| Country aggregates (14.7) | No IP collection or untrusted country-header inference. Evaluate a trusted hosting signal or supported local geolocation data with a specific consent/retention review before release. |
| Owner-selected retention/timezone (14.14–15) | Current policy is plan-based UTC, explicitly labelled. Local-day rebucketing requires finer-grained aggregates and retention/cost review; relabelling a UTC bucket would be misleading. |
| Scheduled reports (14.17) | Wait for verified transactional email, destination confirmation, unsubscribe and delivery diagnostics in the launch work. Do not expose a non-working schedule control. |
| A/B assignment/statistical inference (14.18–19) | Generated campaign comparisons provide descriptive groundwork, with no causal/significance claims. Actual random assignment requires immutable variants, allocation revisions and prespecified statistical safeguards; tracked as separate growth work. |
| Real-time metrics (14.20) | Dashboard reads persisted data on navigation/reload. Streaming, push alerts and live counters are not advertised. Evaluate their free-tier load before implementation. |
| Stronger bot/rate controls | Existing UA/privacy checks, daily caps and replay deduplication are tested. They do not identify humans or stop spoofed clients. Distributed throttling and load drills remain scale/trust work. |
| Discord presence (11.1) | Server preview works without collecting a person's presence. Individual presence needs an authorised identity/session model; do not scrape it. |
| GitHub contributions (11.3) | Public repository statistics work. Contribution calendars require a supported API/permissions design, not profile HTML scraping. |
| Roblox showcase API (11.4) | Validated outbound game links work. Current official legacy-API guidance does not support relying on a user's session cookie for production; stable authorised metadata is deferred. No game/player statistics are fabricated. |
| First-party Twitch live status (11.6) | The official optional player supplies its own offline/online UI. A first-party badge needs a properly authenticated API, token lifecycle and refresh budget. |
| Other widgets (11.7–21) | Countdown and support links have existing working paths; remaining authorisation-dependent and user-content widgets stay individually tracked in feature-ledger.md for growth/trust work. |

No new provider accounts, paid workers, paid databases, Redis or paid cron service are needed for this milestone. Production billing, SMTP, domain cutover, moderation and production security/recovery gates remain separate milestones.

Final layout verification: d165408 is Live on dep-dbugbkgm7kps73caqesg. Test-only 4169bc6 passed CI 44219930318, including 375 px dashboard overflow/axe and desktop report column fit. See analytics-api.md for the shipped route contracts. No additional migrations or secrets were needed.
