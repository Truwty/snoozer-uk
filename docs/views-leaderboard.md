# Views Leaderboard

The public \`/leaderboard\` route has **All Time Views** and **Monthly Top Views** tabs. Each ranks the top 50 published profiles with the independent Views Leaderboard preference enabled by *recorded view events*, with live public avatar/name/handle links.

## What is counted?

The leaderboard is built from the existing consented \`profile_view_days\` updates. Its database trigger runs only when the accepted view counter increases, **after** the existing origin, consent, bot/DNT/GPC, same-day receipt replay and owner-view filters. Click-only updates do not increase the leaderboard.

- All-time views live in \`snoozer.profile_view_leaderboard.total_views\` and do **not** expire with per-plan analytics retention.
- Current-month views live in \`month_views\`, anchored to a UTC calendar month. A subsequent month begins at zero; a month with no new views has no entries.
- The migration backfills the **still-retained** historical daily totals, not activity already deleted by plan-based retention. It is impossible to reconstruct earlier purged views. Do not claim the total is complete prior to this launch.
- These are **event** counts, not unique visitors. A reload may record another view. Per-profile daily recording remains capped by the existing backend at 10,000.
- Only currently published and activated profiles whose separate Views Leaderboard preference is enabled appear. Existing profiles inherit their published SEO-indexability choice until a creator saves a separate preference. Discover directory opt-out and search-engine indexing do not override an explicit leaderboard choice. Unpublishing or turning the leaderboard preference off immediately removes a profile from the public result without wiping its counters.
- Deleting a profile cascades to its leaderboard counts.
- Only the validated, capped \`public.get_views_leaderboard('all'|'month')\` RPC is exposed to anonymous readers. Raw analytics tables stay private; no visitor identifiers are exposed.

## Deployment order

1. Review and apply \`supabase/migrations/20261120008000_views_leaderboard.sql\` to the **intended hosted Supabase project** using your usual backed-up migration process; never reset the hosted database.
2. Deploy the matching web commit on Render. The public page shows a temporary-unavailable state if the migration has not run yet.
3. Open \`/leaderboard\` and switch between the two tabs.
4. Confirm a published profile with leaderboard visibility enabled appears **only after** a visitor who opted into analytics generates an eligible view. Test an unpublished profile or one with leaderboard visibility disabled stays hidden, even when the creator opted into Discover. The new migration and tests are exercised by the disposable Supabase CI stack.

## Screenshot alignment

The desktop page follows the supplied reference: dark gradient title area, pill tabs, ranked table, medal-tinted top three rows, public avatars, usernames, and right-aligned view counts. The homepage header, body and footer link to the leaderboard. Small viewports use a compact table with touch-friendly links.


## Independent discovery visibility preference

Feature #30 adds a separate per-profile **Show my profile on the Views Leaderboard** preference in Studio → Discovery. An explicit choice overrides the historic SEO-indexability fallback. Existing participation is preserved until a creator saves a preference. This setting is distinct from Discover directory opt-in and search-engine indexing; turning off directory discovery alone does not silently change leaderboard participation.
