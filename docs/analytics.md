# Profile analytics

Stage 4 increment, 17 November 2026. Accessible from the selected profile's Studio through Analytics.

## Collection and privacy

Public pages render normal links and readable content without JavaScript. No analytics event is sent until the visitor explicitly allows analytics. The choice is stored as `snoozer-analytics-consent` in this browser's localStorage and applies across Snoozer profiles. Storage failure keeps the choice only in memory. The preference is available on every public page, can be withdrawn, and syncs across tabs. GPC and Do Not Track disable collection. Withdrawing stops future collection; aggregate counts already recorded cannot identify the visitor.

The application stores profile ID, UTC day, integer view/click totals and random per-event UUIDs for daily replay prevention. It stores no IP address, user agent, referrer, visitor identifier or clicked URL in the analytics tables. Request logs at Render/Supabase have separate provider retention; this is not a claim about all infrastructure logs. The account ID used to exclude signed-in owners comes from server-validated Supabase Auth, is passed only through the trusted service RPC, and is not retained in analytics.

`POST /api/v1/analytics/view` accepts a strict JSON event (`kind: view | click`, username, UUID id, consent:true; click also includes one-based position and published URL). The server checks the exact configured origin, body/content-type limits, known crawler user agents, privacy headers and schema. Cross-origin calls cannot write via a browser. Origin and user agent checks do not prove a human visitor; raw HTTP clients can spoof them.

Only published profiles count. A click must match the current immutable publication's position and URL; draft links, stale publication links and forged destinations do not count. A changed publication may therefore drop a late click from an older open page. Links always navigate directly, even when the analytics service fails. This increment does not yet introduce opaque link redirects.

Views count once per rendered page instance. Reloads may count again. Clicks count primary and middle-button activations, not keyboard context-menu navigation. The client does not retry failed sends or block navigation. Counts are approximate event totals, never unique people, CTR or financial attribution.

## Storage boundaries and retention

Migration 20261110005500 enables RLS and revokes direct access from all application roles. Only service_role can call the write/maintenance RPCs; only verified owners can call the selected-profile read RPC. Deleting a profile cascades its aggregates and replay receipts.

Row locking serializes increments; (profile, UTC day, UUID, event kind) deduplicates daily delivery. Receipt UUIDs are independent random events, not browser or visitor IDs. Receipts are removed on the next UTC day during intake or maintenance. Replay prevention is scoped to the current day; a fabricated/replayed request with fresh IDs can inflate counts. A hard cap of 10,000 views and 10,000 clicks per profile per UTC day limits retained receipts. This is a storage guardrail, not complete anti-abuse protection or request-rate limiting.

Plan catalogue retention controls visible and retained daily totals: Free 30, Plus 180, Pro 730, Studio 1,095 UTC days. Intake purges expired data for that profile. `npm run cleanup:analytics` invokes service-only bounded maintenance for inactive profiles (up to 5,000 old receipts and 100 expired daily rows per invocation); repeat to drain backlog. Use ignored local environment or secure runner settings, never CLI key arguments or committed secrets. No hosted runner is configured yet; read retention remains enforced even if maintenance is delayed. Downgrades expire analytics outside the new window; unlike media this aggregate history is not recoverable after purge.

## Dashboard and export

Daily bar charts and a semantic data table show the same validated totals. Silver and green have accompanying text labels; exact values and UTC dates remain available in the table. Days without activity are omitted, explicitly labelled. The authenticated CSV contains only dates and integers, has no-store caching, attachment disposition and nosniff. An unauthenticated request returns 401; a different owner's profile returns no data (404 export, empty owner RPC result).

## Verification and remaining work

`tests/analytics.test.ts` checks consent, origin, bot/privacy signals, bounded bodies, strict fields, media types, durable failure handling and safe CSV values. `tests/database.test.ts` runs real migrations and verifies deduplication, published-link matching, owner exclusion, role denial, cross-owner isolation, retention, daily cap and deletion. All 125 unit/SQL tests pass locally with lint, typecheck and build.

`e2e/supabase.spec.ts` adds the real browser consent/click/export/owner-exclusion journey and an axe dashboard check. Pending disposable CI and hosted staging verification. This increment does not complete Stage 4: per-link breakdown, attribution, unique visitor methodology, CTR, custom retention/timezones, scheduled reports, experiments, stronger anti-abuse controls and provider integrations remain open.
