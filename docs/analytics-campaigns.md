# Campaigns and coarse traffic reports

Stage 4 increment, 17 November 2026. Migration 20261110005700.

## Creator workflow

Analytics → Campaign links creates an opaque UUID-based utm_campaign link for a named campaign. Names stay owner-only in Studio/reports and CSV; the public link contains only the generated code. There are up to 20 saved campaigns per profile across all current plans, an infrastructure guardrail independent of paid allowances. Creating the same trimmed, case-sensitive name again returns the same code, including at capacity. Campaigns can be paused/resumed; pausing stops new attribution to that campaign without breaking the public page or deleting prior totals.

Reports compare campaign/source/device event totals over the same current-plan retention window. Counts are descriptive, approximate events, not unique people, causal lift or statistical significance. Up to 1,000 aggregate groups are returned. Older daily/link counts are not retroactively assigned campaign/source/device dimensions. The traffic CSV uses the same verified owner boundary and formula-safe quoting as the other analytics exports.

## Visitor consent and minimisation

The expanded scope requires a fresh explicit opt-in stored in snoozer-analytics-consent-v2. The original view-only choice is never automatically upgraded. New events carry version:2; legacy events receive only direct/no-campaign/unknown defaults. Withdrawing v2 consent also updates the legacy opt-out key so older open tabs stop. A legacy-tab opt-out similarly turns off v2 in updated tabs.

After consent, the browser reduces referrer URLs to fixed source categories: direct, search, social, video, developer, email or other. No referrer host/path/query is transmitted in the event. A small allowlist maps recognised utm_source values to those categories; unknown text is discarded. Only syntactically valid generated UUID campaign codes leave the browser. Other query parameters, utm_medium/content/term and unregistered raw campaign names are never collected.

The server reduces the already-received user agent to mobile, tablet, desktop or unknown, without storing the full string. These heuristics can misclassify devices and missing/suppressed referrers appear as direct. GPC, DNT, crawler filtering, exact origin, body limits, account validation for self-exclusion and literal consent:true remain enforced. No visitor identifier, IP address, fingerprint or visitor history is added.

## Durable boundaries

Campaign management serialises on the owner-checked profile row. Event collection holds a profile share lock, so pausing and publication changes have a defined cutover. Only active codes belonging to that profile can receive attribution. Foreign, paused and unknown codes fall back to the no-campaign bucket; responses do not reveal campaign ownership or existence. The nil UUID is an internal aggregate bucket, never an account identity.

One event receipt guards all daily/link/context increments in the same transaction. Replay cannot assign a previously counted event to another group. Counts remain subject to the global per-profile daily cap. Context rows cascade with daily retention and profile deletion. Campaign definitions persist with the profile for repeat use; they contain creator metadata, not visitor records.

RLS is enabled and direct access revoked for campaign/context tables. Only verified owners can create/toggle/list campaigns or read reports. Only the server service role can invoke the new contextual event writer. The old six-argument writer remains compatible with previously deployed apps and emits no new personal context. No new provider, credentials, paid infrastructure, scheduler or browser cookie is required.

## Verification

Local lint, typecheck, 163 Vitest tests, two audit-policy tests and production build pass. Tests cover minimisation, spoofed source hosts, unsupported query text, legacy consent, device categories, owner isolation, foreign/paused campaigns, idempotent creation, replay, capacity and unsafe CSV labels. The disposable browser journey now includes legacy-choice re-consent, creator campaign setup, pause/resume, recognised UTM source attribution and actual traffic CSV download.

CI 44180646763 passed the campaign browser journey and all 163 Vitest/two audit-policy tests. Migration 57 is applied on staging; app 80ce59c is Live on Render deploy [redacted deployment id]. The staging owner created a generated campaign, paused/resumed it, and downloaded the actual traffic CSV. Replaying an anonymous v2 QA event twice counted once. A paused code fell into No campaign; resuming attributed again. Final traffic CSV: campaign email/mobile views 2; No campaign email/mobile views 1. The QA campaign is left paused and browser analytics consent remains off. Do not apply migration 57 twice. This increment does not implement unique visitors, CTR, geographical lookup, timezone rebucketing, scheduled reports, A/B assignment or additional provider APIs.
