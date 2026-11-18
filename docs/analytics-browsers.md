# Daily browser observations and CTR

Migration 59 adds daily browser counts and clicked-browser CTR. A browser counts only after a recorded view. It becomes a clicked browser after at least one valid published-link click on the same UTC day. Click-before-view delivery is handled atomically: the later view increments both metrics. Replays and subsequent reloads/clicks do not increment the browser metrics again. Event totals still count each accepted event.

These are approximate browser observations, never unique people. Different devices, private browsing, cleared storage or renewed consent may count again. Counts cannot be summed across days as unique visitors. CTR is clicked browsers / daily browsers × 100, bounded by database invariants. No denominator renders an em dash and exports an empty percentage. Historical counts are not backfilled. Daily totals include some events without browser codes, so coverage differs.

## Consent and privacy boundary

Version 3 requires a fresh explicit opt-in; existing version-1/2 choices are not upgraded. The preference remains across Snoozer profiles on this browser. Each profile and UTC day has an independent random UUID in localStorage. It is created only after consent and only emitted if storage is writable. There is no fingerprint, IP-derived ID, global visitor ID or ephemeral fallback that would count every reload as a new browser.

The browser never reuses an expired day's code. It removes expired codes on a later visit; closed browsers can retain old strings until a visit or manual site-data clearing. Withdrawal removes all Snoozer browser codes and propagates opt-out to old consent keys. Blocked storage permits page-local event consent but emits no browser code. GPC/DNT disable analytics. Source/device/campaign choices remain within the consent boundary.

The server rejects malformed or incomplete code/date pairs. It ignores browser data under older scopes or when the client date differs from the server UTC date. It hashes username, UTC date and random code before PostgreSQL. The private deduplication table contains only profile/day/hash and two booleans; no campaign, referrer, device, user/account ID or precise visit time is linked to it. Normal server-validated owner exclusion still applies. Infrastructure logging has its own retention; this describes app persistence.

Only service-role RPCs can write. Direct table access is revoked from all app roles with RLS enabled. Verified owners see aggregate reports, not hashes; other owners receive no rows. Both earlier write RPCs and the daily event CSV remain compatible. The browser CSV has the same owner/origin-independent authenticated read boundary, private no-store caching and attachment/nosniff headers.

## Cleanup

Intake deletes the profile's previous-day hashes. Maintenance deletes up to 5,000 old browser hashes, 5,000 old event receipts and 100 plan-expired aggregate days per call. Aggregate deletion cascades traffic and per-link rows; profile deletion cascades all analytics.

The operator-only [scheduler SQL](../supabase/operations/schedule-analytics-cleanup.sql) uses the existing Supabase database's native pg_cron extension. It schedules bounded maintenance every five minutes and cleans only its own completed run logs older than seven days, at most 500 per call. It does not call HTTP endpoints, keep Render awake or provision anything. Paused databases do not run jobs; resume requires a backlog check. At scale, monitor backlog and execution time instead of assuming the bounded batches guarantee a deletion deadline.

Before production: confirm scheduled successes, old receipt/hash backlog, expired aggregate backlog and provider retention. A failed schedule never reveals expired aggregate data because owner reads independently enforce plan retention. Registration alone is not evidence of execution.

## Verification checkpoint

Local lint, typecheck, build, 192 Vitest tests and two audit-policy tests pass. Tests cover profile/day independence, writable storage, fresh consent, strict payloads, hashing/skew, click-before-view/replay/owner exclusion, cap, deletion, expiry and safe CSV/zero denominator. Expanded disposable browser coverage checks actual consent, code removal, repeat visits, owner exclusion, CTR dashboard and browser CSV. CI, migration 59 and hosted scheduler/browser verification are pending.
