# Views Leaderboard

**Reviewed:** 28 November 2026. The public route exposes All Time Views and Monthly Top Views using eligible recorded analytics events; it does not claim unique visitors.

The public `/leaderboard` route ranks up to 50 published profiles that have the independent Views Leaderboard preference enabled. It displays the top three as featured profile cards and the remaining positions in a ranked table. Each profile links to its public page and uses the public avatar route.

## What is counted?

The leaderboard is built from the existing consented `profile_view_days` updates. Its database trigger runs only when the accepted view counter increases, **after** the existing origin, consent, bot/DNT/GPC, same-day receipt replay and owner-view filters. Click-only updates do not increase the leaderboard.

- All-time views live in `snoozer.profile_view_leaderboard.total_views` and do **not** expire with per-plan analytics retention.
- Current-month views live in `month_views`, anchored to a UTC calendar month. A subsequent month begins at zero; a month with no new views has no entries.
- The migration backfills the **still-retained** historical daily totals, not activity already deleted by plan-based retention. It is impossible to reconstruct earlier purged views. Do not claim the total is complete prior to this launch.
- These are **event** counts, not unique visitors. A reload may record another view. Per-profile daily recording remains capped by the existing backend at 10,000.
- Only currently published and activated profiles whose separate Views Leaderboard preference is enabled appear. Existing profiles inherit their published SEO-indexability choice until a creator saves a separate preference. Discover directory opt-out and search-engine indexing do not override an explicit leaderboard choice. Unpublishing or turning the leaderboard preference off immediately removes a profile from the public result without wiping its counters.
- Deleting a profile cascades to its leaderboard counts.
- Only the validated, capped `public.get_views_leaderboard('all'|'month')` RPC is exposed to anonymous readers. Raw analytics tables stay private; no visitor identifiers are exposed.

## Public presentation

- The period switcher keeps the existing `/leaderboard` and `?period=month` URLs and clearly identifies the active period.
- Positions one to three appear in a featured podium. The first-place profile receives stronger emphasis without changing the ranking order.
- Positions four to fifty remain in a compact, keyboard-accessible table with public avatar, display name, handle and recorded view count.
- Empty and temporarily unavailable states are distinct and provide a clear next step. The page keeps the database query and existing ranking rules unchanged.
- The counting, privacy and historical-retention explanation is available in a collapsed **How views are counted** disclosure, keeping the main ranking in focus.
- Small viewports stack the podium cards and metadata, retain touch-friendly period controls, and keep the ranking table within the viewport.

## Deployment order

1. Review and apply `supabase/migrations/20261120008000_views_leaderboard.sql` to the **intended hosted Supabase project** using your usual backed-up migration process; never reset the hosted database.
2. Deploy the matching web commit on Render. The public page shows a temporary-unavailable state if the migration has not run yet.
3. Open `/leaderboard` and switch between the two tabs.
4. Confirm a published profile with leaderboard visibility enabled appears **only after** a visitor who opted into analytics generates an eligible view. Test an unpublished profile or one with leaderboard visibility disabled stays hidden, even when the creator opted into Discover. The new migration and tests are exercised by the disposable Supabase CI stack.

## Independent discovery visibility preference

Feature #30 adds a separate per-profile **Show my profile on the Views Leaderboard** preference in Studio → Discovery. An explicit choice overrides the historic SEO-indexability fallback. Existing participation is preserved until a creator saves a preference. This setting is distinct from Discover directory opt-in and search-engine indexing; turning off directory discovery alone does not silently change leaderboard participation.
