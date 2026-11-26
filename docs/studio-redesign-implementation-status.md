# Snoozer Studio redesign implementation status

This tracker records the current implementation against `Snoozer_Codex_Implementation_Plan.md`. A passing build does not mean every planned dashboard feature is complete.

## Branch and release state

- Branch: `feature/dashboard-video-fidelity`.
- Local starting HEAD for this follow-up: `05d9b38fa309b8383ce3cbe54d74efe160949661`.
- The previous PR for the earlier branch head was merged and closed. This follow-up has not been pushed or opened as a new PR yet.
- No merge to `main` and no Render deployment were performed.

## Implemented in this follow-up

- Studio command palette: Ctrl+K / Cmd+K opens a keyboard-accessible modal; text filters Studio destinations; arrows and Enter select; Escape closes; Tab is trapped; focus is restored; the modal adapts to narrow screens. Existing sidebar filtering remains.
- Analytics: added a real inclusive UTC 3-day range; retained the 7-day, 30-day, and all-retained-data ranges.
- Account overview: added a stable numeric profile UID; truthful retained view/click labels; an exact 7-day delta only when sufficient data is retained; five completion milestones; and provider connection status/actions.
- Account/security: username rename uses an atomic RPC, retains the previous URL as a permanent redirect, enforces a 30-day cooldown, and does not consume alias quota. Google/Discord unlink is confirmed, refuses to remove the last sign-in identity, and disconnects Discord Presence before unlinking. Marketing opt-in is explicit, persistent, and owner-scoped. Existing verified email change, MFA, device/session revocation, aliases, and gift-code claim flows remain.
- Badges: official badge display ordering is user controlled; added plan-version-backed custom badge quotas (Free 0 / Plus 3 / Pro 8 / Studio 20), owner-scoped custom badge CRUD, private storage, safe image processing, public visibility controls, and archive coverage. Custom badges remain outside official system/owner award flows.
- Profile editor: added rainbow/fuzzy/shuffle username effects, explicit location/visibility, and a persisted Swap Box Colours control with schema validation and a focused appearance test. Existing profile appearance/editor remains in use.
- Image Host: added `/studio/image-host` and retained `/studio/gallery`; the new screen reuses the existing private gallery upload/folder infrastructure and includes account-owned plain-text snippets with private/public modes, edit/delete, 16 KB content validation, a 25-item quota, and a `text/plain` public route.
- Templates: added favorites, last-used history, user uploads/create, community tab, reporting, declarative config validation, and an MFA-gated owner moderation queue. Community templates remain free and cannot contain executable code or arbitrary CSS/HTML.
- Auth fallback: when Supabase credentials are absent, protected account pages redirect to sign-in; the private account snapshot reports service unavailability rather than presenting it as an authenticated response. Added regression coverage for both cases.

## Requirement status

| Plan area | Status | Evidence / outstanding work |
| --- | --- | --- |
| Repository and architecture audit | Partial | Branch, PR, migrations, RLS, entitlements, actions, routes and tests inspected. A fresh connected-provider/production-schema audit still requires a configured Supabase project. |
| Shared foundations | Partial | Migrations `20261126090000`–`20261126090010` add username history, consent, export coverage, appearance fields, badge order/custom badges, community templates, Swap Box Colours, and private/public text pastes. No common audio/cursor/custom-domain asset foundation yet. |
| Account settings/security | Partial | Rename, email change, aliases, identity unlink, MFA, sessions and marketing preference work. Locale translations/persistence are absent. Gift purchase is still sandbox-only under the current Stripe gift implementation; no production gift purchase or buyer inventory is provided. |
| Account overview | Partial | Numeric UID, milestones, honest retained-data metrics and conditional 7-day delta exist. Percentile is intentionally omitted because the app has no suitable comparable population dataset. |
| Analytics | Partial | 3/7/30/all-time controls and existing reports/exports remain. No country report is produced because the privacy model has no consent-aware coarse-country aggregate. Full dashboard metric/date-range parity still needs authenticated E2E verification. |
| Badges | Partial | Official ordering/visibility and secure custom badge CRUD/quota are implemented. No styling/recolouring for official badges (to protect award integrity), and no full earned/locked/future catalogue redesign. |
| Profile customisation | Partial | Username effects, explicit location, and Swap Box Colours are added. Existing controls are retained. Discord avatar/decoration settings are absent because no authorized avatar-decoration data path exists. Complete reference layout comparison remains. |
| Asset uploader / Audio / Image Host | Partial | Dedicated Image Host route uses existing gallery storage/folders and now supports secured text pastes. It does not yet provide standalone binary asset URL management, custom domains/DNS/TLS, usage analytics, audio library/multiple tracks, or custom cursor. |
| Community templates | Partial | Favorites, recents, user submissions, report controls and owner moderation exist. Missing covers/creator profiles, tags/categories, marketplace search/sort/pagination, real usage ranking, and real ratings. Trending/ratings were not fabricated. |
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

Migrations are covered by the repository's PGlite migration tests. Applying them to a live Supabase project and validating deployed RLS/storage behavior was not done.

## Local verification

Latest results after the final code change in this follow-up:

- `npm test`: passed — 48 Vitest files / 360 tests, plus 10 Node tests.
- `npm run typecheck`: passed.
- `npm run lint`: passed with 0 errors and 6 warnings (existing unused imports/variables and an existing effect dependency warning; see command output).
- `npm run audit`: passed — zero dependency vulnerabilities.
- `npm run build`: passed — production Next.js build.
- `npm run test:e2e`: passed — 61 passed, 30 skipped; no failures. Supabase-dependent tests are skipped because this checkout has no `.env.local` or configured Supabase test project. Discord worker configuration is also absent and the app correctly starts without that worker.
- Focused auth regression E2E: 4 passed after the fail-closed fallback change.
- Secret scanning and final GitHub Actions checks are not yet recorded; run them after staging/pushing the final commit.

## Remaining blockers for full completion

- A configured Supabase test project/secrets are needed to run authenticated flows, storage/RLS integration, auth provider linking, and migration integration tests.
- Production gift checkout and purchased-link inventory are not supported by the current sandbox-only gift product path; production selling remains disabled rather than exposing a fake purchase control.
- The app has no locale translation architecture; a locale selector without translated pages would misrepresent functionality.
- There is no stored consent-aware country aggregate, authorized Discord avatar-decoration path, or reliable population dataset for percentile claims.
- Audio library/multi-track shuffle, custom cursor, richer Image Host (standalone binary URLs, custom domains, usage analytics), complete community marketplace metadata/filtering, and full reference visual parity remain to be implemented.
- Full CI completion depends on the final branch commit being pushed and the resulting GitHub Actions run finishing successfully.
