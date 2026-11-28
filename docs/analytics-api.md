# Analytics and public-widget API

**Reviewed:** 27 November 2026. These route contracts are implemented in the current main source; the latest code and CI take precedence over historical test-run notes.

These first-party routes are implemented. No browser receives service-role credentials. Read the consent/storage methodology in analytics-browsers.md and the provider boundaries in public-widgets.md.

## POST /api/v1/analytics/view

Require the exact configured site Origin, application/json and a body up to 4,096 bytes. The strict event has username, random UUID id, consent:true and kind:view or kind:click. A click also has one-based position (1–2,000) and the exact published HTTP(S) URL (up to 2,048 characters). Client-supplied actor or arbitrary extra fields are rejected.

Optional attribution fields: version (2 or 3), source (direct/search/social/video/developer/email/other), and campaign UUID. Only an active campaign belonging to this profile is attributed; other codes fall into No campaign. No arbitrary UTM strings or raw referrer are retained. Version 1/omitted attribution remains a legacy direct/unknown event.

Fresh version 3 can additionally include browser (v4 UUID) and browserDay (ISO UTC date), as a pair. The server ignores browser observations when its own UTC day differs. Version 2 cannot carry browser data. Only a profile/day-scoped hash reaches PostgreSQL. The server validates Supabase Auth to exclude the signed-in owner; the browser cannot choose that account ID.

Responses have no body and no-store caching:

| Code | Meaning |
| --- | --- |
| 204 | Intake acknowledged; filtered bots/privacy signals, owner visits, invalid publication destinations, inactive/unpublished profiles, cap and receipt replays can intentionally produce no count |
| 400 | Invalid UTF-8/JSON, schema or browser/date scope |
| 403 | Origin mismatch |
| 413 | Body too large |
| 415 | Wrong media type |
| 503 | Required Auth/persistence unavailable |

204 never means a unique human was identified. The shipped client does not retry or block navigation. Server RPC errors return 503, not fabricated success.

## GET /api/v1/analytics/export

Query profile must be a UUID. breakdown is days (default), links, traffic or browsers. A server-validated, email-confirmed owner session is required; origin is not used as a substitute for authentication on this read.

400 invalid query, 401 unconfirmed/absent account, 404 profile not owned, 503 Auth/database/schema failure. Success is a CSV attachment with private,no-store caching and nosniff. Dates and counts are validated. Creator labels/URLs are quoted and spreadsheet formula prefixes neutralised. Browser percentages are empty when the denominator is zero. None of the exports contain browser hashes.

Reports enforce the current plan's retention in owner-only read RPCs independently of scheduled cleanup. Link groups are capped at 100, traffic groups at 1,000. Daily reports are bounded by the maximum 1,095-day plan retention.

## POST /api/v1/widgets/public

Require the exact configured Origin, application/json and a body up to 512 bytes. Strict fields: username, published one-based position, provider (github or discord), consent:true. The caller cannot submit a URL or request private provider data.

The server reads the current published link before any cache hit. Removed/changed links cannot use an earlier cache entry. Responses contain only validated version-1 public metadata: provider, resource, title, description, stats and fetchedAt. The client checks the resource against its rendered link too.

400 invalid input/provider-link mismatch, 403 origin mismatch, 404 missing publication/link, 413 oversized body, 415 wrong media, 429 provider budget exhausted, 503 provider/cache/persistence unavailable. Retry-After communicates bounded retry timing where available. Responses are private,no-store and nosniff. Refresh leases and upstream error bodies never leave the server.

Only fixed provider hosts are contacted, without visitor cookies, credentials or incoming request headers. The ordinary outbound link works independently of the summary request. YouTube/Twitch embeds have their own explicit Load/Hide choices and do not call this endpoint.

## Operations

Never expose the private analytics/cache tables in a browser admin console. Use authorised SQL or service-only maintenance, retaining only aggregate diagnostics. The native job verification query is in supabase/operations/schedule-analytics-cleanup.sql. Inspect old hash/receipt and expired aggregate backlogs after pauses. Monitor 503/429 rates without recording raw event bodies or browser codes in application logs.

The current application does not claim a dedicated analytics alerting dashboard, unique-human detection, cross-day unique visitors or complete distributed abuse prevention.
