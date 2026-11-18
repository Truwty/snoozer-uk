# Profile analytics

Stage 4 increment, 17 November 2026. Accessible from the selected profile's Studio through Analytics.

## Collection and privacy

Public pages render normal links and readable content without JavaScript. No analytics event is sent until the visitor explicitly allows analytics. The choice is stored as `snoozer-analytics-consent-v2` in this browser's localStorage and applies across Snoozer profiles. The original view-only choice is not automatically upgraded to the expanded scope. See [campaigns](analytics-campaigns.md). Storage failure keeps the choice only in memory. The preference is available on every public page, can be withdrawn, and syncs across tabs. GPC and Do Not Track disable collection. Withdrawing stops future collection; aggregate counts already recorded cannot identify the visitor.

The application stores profile ID, UTC day, integer view/click totals and random per-event UUIDs for daily replay prevention. It stores no IP address, full user agent, full referrer or cross-profile visitor identifier. Fresh V3 consent adds profile/day-scoped hashed browser observations; see analytics-browsers.md. Context reports store fixed source/device categories and registered creator campaign codes. Per-link reporting also stores the creator's published label, destination, revision and position; visitor-supplied URLs must exactly match that publication. Request logs at Render/Supabase have separate provider retention; this is not a claim about all infrastructure logs. The account ID used to exclude signed-in owners comes from server-validated Supabase Auth, is passed only through the trusted service RPC, and is not retained in analytics.

`POST /api/v1/analytics/view` accepts a strict JSON event (`kind: view | click`, username, UUID id, consent:true; click also includes one-based position and published URL). The server checks the exact configured origin, body/content-type limits, known crawler user agents, privacy headers and schema. Cross-origin calls cannot write via a browser. Origin and user agent checks do not prove a human visitor; raw HTTP clients can spoof them.

Only published profiles count. A click must match the current immutable publication's position and URL; draft links, stale publication links and forged destinations do not count. A changed publication may therefore drop a late click from an older open page. Links always navigate directly, even when the analytics service fails. This increment does not yet introduce opaque link redirects.

Views count once per rendered page instance. Reloads may count again. Clicks count primary and middle-button activations, not keyboard context-menu navigation. The client does not retry failed sends or block navigation. Counts are approximate event totals, never unique people or financial attribution. The separate browser report now computes daily browser CTR under fresh V3 consent.

## Storage boundaries and retention

Migration 20261110005500 enables RLS and revokes direct access from all application roles. Only service_role can call the write/maintenance RPCs; only verified owners can call the selected-profile read RPC. Deleting a profile cascades its aggregates and replay receipts.

Row locking serializes increments; (profile, UTC day, UUID, event kind) deduplicates daily delivery. Receipt UUIDs are independent random events, not browser or visitor IDs. Receipts are removed on the next UTC day during intake or maintenance. Replay prevention is scoped to the current day; a fabricated/replayed request with fresh IDs can inflate counts. A hard cap of 10,000 views and 10,000 clicks per profile per UTC day limits retained receipts. This is a storage guardrail, not complete anti-abuse protection or request-rate limiting.

Plan catalogue retention controls visible and retained daily totals: Free 30, Plus 180, Pro 730, Studio 1,095 UTC days. Intake purges expired data for that profile. `npm run cleanup:analytics` invokes service-only bounded maintenance for inactive profiles (up to 5,000 old receipts and 100 expired daily rows per invocation); repeat to drain backlog. Use ignored local environment or secure runner settings, never CLI key arguments or committed secrets. A native staging pg_cron runner is configured and its scheduled execution verified; see analytics-browsers.md. Read retention remains enforced if maintenance is delayed. Downgrades expire analytics outside the new window; unlike media this aggregate history is not recoverable after purge.

## Dashboard and export

Daily bar charts and a semantic data table show the same validated totals. Silver and green have accompanying text labels; exact values and UTC dates remain available in the table. Days without activity are omitted, explicitly labelled. The authenticated CSV contains only dates and integers, has no-store caching, attachment disposition and nosniff. An unauthenticated request returns 401; a different owner's profile returns no data (404 export, empty owner RPC result).

## Verification and remaining work

### Per-link increment

Migration 20261110005600 adds daily click totals by immutable publication position, label and destination. Reports combine matching published label/destination pairs across revisions and return the top 100 within the owner's current retention window. Counts already recorded before this migration remain daily-only; no data is fabricated to backfill attribution. A profile share lock prevents publication changes/pruning racing with link validation and recording. The daily row lock and event receipt still guard duplicates and the daily cap.

Per-link data cascades with daily retention and profile deletion. Read access remains verified-owner only with no direct table grants. The authenticated `breakdown=links` export uses the same permission boundary as daily CSV. Creator text fields are CSV quoted and formula-leading characters are neutralised; URL schemes are validated before rendering or exporting. Daily and per-link report failures are shown independently.

The per-link increment passes lint, typecheck, 141 Vitest tests, two audit-policy tests and production build, both locally and in [CI 44176380200](https://github.com/Truwty/snoozer-uk/actions/runs/44176380200). CI also passed 21 browser/HTTP checks with one expected missing-secret check skipped. The attributed Work link and both actual CSV downloads are included.

Migration 56 is applied and permission-checked on staging. Render deploy `dep-dbuc6oek1f9s739r0b5g` reached Live on d861c1c. Replaying a fresh anonymous QA click twice added one daily click and one per-link click under Example destination / https://example.com/. A forged unpublished destination added nothing. The owner dashboard showed one view, two daily clicks (one predates per-link collection) and one attributed click. The actual link CSV download matched that attribution. An anonymous CSV request returned 401. The earlier disposable Supabase startup failure did not recur in this run; its underlying cause remains unknown.

### Hosted evidence

Migration 55 is applied on snoozer-staging with RLS enabled, anonymous write execution denied and service-role write execution allowed. Render deploy `dep-dbubvic9v7es7383j7sg` reached Live on app commit 984261c. A labelled staging fixture confirmed signed-in owner opt-in left the dashboard empty; replaying one anonymous view and click HTTP fixture twice each produced exactly one view and one click. A wrong-origin request returned 403. Liveness and readiness returned 200. The actual authenticated CSV download contained those exact counts and date. The optional YouTube frame loaded its documented sample video UI and was removed with Hide; playback itself was not started.

[CI 44173960711](https://github.com/Truwty/snoozer-uk/actions/runs/44173960711) passed 126 Vitest, two audit-policy and 21 browser/HTTP tests (one expected missing-secret case skipped). Following run 44174839516 passed the additionally tracked 14 YouTube URL tests (140 total) but failed while starting the disposable Supabase stack before browser execution. Its startup log was redirected and no underlying cause was exposed; do not call that run passed. The next per-link run must verify the whole provider suite.

`tests/analytics.test.ts` checks consent, origin, bot/privacy signals, bounded bodies, strict fields, media types, durable failure handling and safe CSV values. `tests/database.test.ts` runs real migrations and verifies deduplication, published-link matching, owner exclusion, role denial, cross-owner isolation, retention, daily cap and deletion. All 125 unit/SQL tests pass locally with lint, typecheck and build.

`e2e/supabase.spec.ts` verifies the real consent/click/export/owner-exclusion journey and an axe dashboard check. This was the initial analytics increment. The current Milestone 4 core/staging exit, including campaign attribution, daily browser methodology, CTR and additional providers, is recorded in milestone-4-review.md. Advanced inventory and production gates remain open.
