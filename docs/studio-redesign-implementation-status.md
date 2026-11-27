# Snoozer Studio redesign implementation status

This tracker records the current implementation against `Snoozer_Codex_Implementation_Plan.md`. A passing build does not mean every planned dashboard feature is complete.

## Current release state — 26 November 2026

- Main commit at the start of this follow-up: `09df799a636195433355404eda253ff3c7b0bd82`.
- Dashboard video redesign PR #112, Studio expansion PR #113 and platform optimisation PR #114 are merged.
- The 14 migrations `20261126090000`–`20261126090013` were applied to the connected staging Supabase project. The migration registry was previously verified through `20261126090013`.
- Current follow-up branch: `feature/remove-profile-badges-fix-music`. It contains the temporary achievement-badge UI removal and Spotify/native-audio profile-player fixes.
- No merge or Render deployment has been performed for this follow-up branch. The live Premium payment gates, Stripe configuration and six LIVE offers are outside this change and remain untouched.

## Branch and release state

- Working branch: `feature/remove-profile-badges-fix-music`, based on main commit `09df799a636195433355404eda253ff3c7b0bd82`.
- A review PR for this follow-up will be opened after full CI verification.
- Keep this branch isolated until the owner reviews and explicitly approves a release.

## Implemented in this follow-up

- Studio command palette: Ctrl+K / Cmd+K opens a keyboard-accessible modal; text filters Studio destinations; arrows and Enter select; Escape closes; Tab is trapped; focus is restored; the modal adapts to narrow screens. Existing sidebar filtering remains.
- Analytics: added a real inclusive UTC 3-day range; retained the 7-day, 30-day, and all-retained-data ranges.
- Account overview: added a stable numeric profile UID; truthful retained view/click labels; an exact 7-day delta only when sufficient data is retained; five completion milestones; and provider connection status/actions.
- Account overview analytics: device totals and the profile-view chart now use the same exact seven UTC calendar dates, with zero-view dates represented in the chart; added an owner-authorized, retention-aware device aggregate RPC and error states.
- Account/security: username rename uses an atomic RPC, retains the previous URL as a permanent redirect, enforces a 30-day cooldown, and does not consume alias quota. Google/Discord unlink is confirmed, refuses to remove the last sign-in identity, and disconnects Discord Presence before unlinking. Marketing opt-in is explicit, persistent, and owner-scoped. Existing verified email change, MFA, device/session revocation, aliases, and gift-code claim flows remain.
- Badges: the public achievement-badge strip and Studio/Owner badge-management interfaces are temporarily disabled. Existing catalogue definitions, award records, private images and migrations are retained; no award history is deleted.
- Profile editor: added rainbow/fuzzy/shuffle username effects, explicit location/visibility, and a persisted Swap Box Colours control with schema validation and a focused appearance test. Existing profile appearance/editor remains in use.
- Image Host: `/studio/image-host` remains a separate tool with private image storage/folders and account-owned text pastes. The Studio Image Gallery route now redirects to Customize. Private image storage remains for profile backgrounds, audio cover art and custom icons; no public profile Gallery section is rendered.
- Templates: added favorites, last-used history, user uploads/create, community tab, reporting, declarative config validation, an MFA-gated owner moderation queue, and server-maintained use counts for approved community templates. Community templates remain free and cannot contain executable code or arbitrary CSS/HTML.
- Auth fallback: when Supabase credentials are absent, protected account pages redirect to sign-in; the private account snapshot reports service unavailability rather than presenting it as an authenticated response. Added regression coverage for both cases.

## Requirement status

| Plan area | Status | Evidence / outstanding work |
| --- | --- | --- |
| Repository and architecture audit | Partial | Branch, PR, migrations, RLS, entitlements, actions, routes and tests inspected. A fresh connected-provider/production-schema audit still requires a configured Supabase project. |
| Shared foundations | Partial | Migrations `20261126090000`–`20261126090013` add username history, consent, export coverage, appearance fields, badge order/custom badges, community templates, Swap Box Colours, private/public text pastes, seven-day device analytics, usage counts, and the searchable/paginated community listing RPC. No common audio/cursor/custom-domain asset foundation yet. |
| Account settings/security | Partial | Rename, email change, aliases, identity unlink, MFA, sessions and marketing preference work. Locale translations/persistence are absent. Gift purchase is still sandbox-only under the current Stripe gift implementation; no production gift purchase or buyer inventory is provided. |
| Account overview | Partial | Numeric UID, milestones, honest retained-data metrics and conditional 7-day delta exist. Percentile is intentionally omitted because the app has no suitable comparable population dataset. |
| Analytics | Partial | 3/7/30/all-time controls and existing reports/exports remain. No country report is produced because the privacy model has no consent-aware coarse-country aggregate. Full dashboard metric/date-range parity still needs authenticated E2E verification. |
| Badges | Temporarily disabled | Public badge rendering, Studio navigation/management and Owner badge management redirect to their dashboards. Catalogue, awards, private images and migration history are retained; no award data is deleted. |
| Profile customisation | Partial | Username effects, explicit location, and Swap Box Colours are added. Existing controls are retained. Discord avatar/decoration settings are absent because no authorized avatar-decoration data path exists. Complete reference layout comparison remains. |
| Asset uploader / Audio / Image Host | Partial | Direct profile image/video upload controls and the private multi-track audio library are implemented in the Studio branch. Audio/video bucket migrations are not yet applied to the connected staging database. Image Host remains a separate product for private asset management and text pastes. |
| Community templates | Partial | Favorites, recents, user submissions, report controls, owner moderation, real aggregate use counts, and server-side title/description search, newest/popular sorting, and pagination exist. Missing covers/creator profiles, tags, and real ratings. No trending or rating claims are fabricated. |
| Navigation / interaction / responsive fidelity | Partial | Main Snoozer destinations are preserved and command palette behavior is implemented. Dashboard screenshot parity and keyboard/accessibility checks at all requested widths (especially 1440, 1280, 768, 375, 320) are not complete. |
| Regression / release readiness | Partial | Unit/database, static checks, build and unauthenticated browser suite pass locally; Supabase-backed flows and latest GitHub Actions for a new commit remain outstanding. |

## Migrations

- `supabase/migrations/20261126090000_profile_username_changes.sql`
- `supabase/migrations/20261126090001_account_marketing_preferences.sql`
- `supabase/migrations/20261126090002_archive_new_profile_preferences.sql`
- `supabase/migrations/20261126090003_profile_name_effects.sql`
- `supabase/migrations/20261126090004_profile_location_control.sql`
- `supabase/migrations/20261126090005_profile_badge_order.sql`
- `supabase/migrations/20261126090006_custom_profile_badges.sql`
- `supabase/migrations/20261126090007_archive_custom_badges.sql`
- `supabase/migrations/20261126090008_community_template_hub.sql`
- `supabase/migrations/20261126090009_swap_profile_box_colours.sql`
- `supabase/migrations/20261126090010_image_host_text_pastes.sql`
- `supabase/migrations/20261126090011_overview_seven_day_devices.sql`
- `supabase/migrations/20261126090012_community_template_usage_counts.sql`
- `supabase/migrations/20261126090013_community_template_listing.sql`
- `supabase/migrations/20261126090012_community_template_usage_counts.sql`

Migrations are covered by the repository's PGlite migration tests. All 14 migrations listed above were subsequently applied to the connected Supabase staging project and the registry was verified through version 20261126090013. Deployed RLS/storage and authenticated feature acceptance remain part of the ongoing verification.

## Local verification

Latest local checks for the current working tree:

- `npm test`: passed — 48 Vitest files / 360 tests, plus 10 Node tests.
- `npm run typecheck`: passed.
- `npm run lint`: passed with 0 errors and 6 existing warnings (unused imports/variables and an effect dependency warning).
- `npm run audit`: passed — zero dependency vulnerabilities.
- `npm run build`: passed — production Next.js build.
- `npm run test:e2e`: passed — 61 passed, 30 skipped; no failures. Supabase-dependent tests are skipped locally because this checkout has no `.env.local`; GitHub CI used disposable Supabase and passed those flows on the preceding commit.
- Focused auth regression E2E: 4 passed after the fail-closed fallback change.
- GitHub Actions run `45749347497` passed all jobs on commit `8984d9b5e2864726d4bb584ae1acee9b4fb61f95`. Run `45750232432` initially failed on the new overview E2E assertion because the test had not navigated from the claim flow to `/studio`; after adding that navigation, run `45750704183` passed every job. The current server-side community listing migration needs a fresh CI run after push.

## Remaining blockers for full completion

- A configured Supabase test project/secrets are needed to run authenticated flows, storage/RLS integration, auth provider linking, and migration integration tests.
- Production gift checkout and purchased-link inventory are not supported by the current sandbox-only gift product path; production selling remains disabled rather than exposing a fake purchase control.
- The app has no locale translation architecture; a locale selector without translated pages would misrepresent functionality.
- There is no stored consent-aware country aggregate, authorized Discord avatar-decoration path, or reliable population dataset for percentile claims.
- Audio library and background video upload paths have been added but still require the staging database migrations and live staging verification. Richer Image Host (standalone binary URLs, custom domains, usage analytics), complete community marketplace metadata/filtering, and full reference visual parity remain open.
- Full CI must be rerun after the current overview alignment change is pushed. PR #113 remains draft while substantive plan gaps above remain.
