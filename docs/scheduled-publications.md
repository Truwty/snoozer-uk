# Scheduled publications

**Reviewed:** 27 November 2026

Scheduled publication freezes a saved draft into an immutable content snapshot without changing the active page. Subsequent draft saves do not change that snapshot. Manual publish or taking a profile offline cancels the pending schedule, including an offline action on an already-unpublished profile. Cancellation never deletes content or changes the live page. One current schedule exists per profile; replacing it prepares a new snapshot.

All times are explicit UTC, one minute to 365 days ahead. Plus or higher is required both when capturing and when activating. Activation rechecks verified ownership, current plan features, custom-SEO eligibility, link limits and account-wide publication quota. A downgrade blocks execution without deleting the saved version or current page. Blocked versions must be reviewed and scheduled again. Deleted profiles cascade their schedules. A separate activation timestamp distinguishes prepared snapshots from versions that actually went live.

The account advisory lock is acquired before the profile lock, sharing the manual-publish quota boundary. Profile/schedule row locks and terminal states make retries idempotent. The batch runner is service-only, limited to 1–50 candidates, and skips busy work rather than hanging. Owners can check only their own due version; no caller can supply a simulated current time. Every activation keeps newer drafts intact. Retention protects active and pending snapshots beyond the usual twenty recent versions, without unbounded version growth.

## Hosted scheduler

The migration is `20261118006300_scheduled_publications`. The companion script `supabase/operations/schedule-publications.sql` registers the job `snoozer-publications-v1` once per minute. It requires Supabase `pg_cron`; it does not depend on a Render process, external worker, HTTP secret or keep-awake pings.

**Connected Supabase check on 27 November 2026:** the job `snoozer-publications-v1` is present in `cron.job`, has schedule `* * * * *` and is active. This confirms registration, not that every future scheduled publication will execute without delay. Supabase pauses, database failures, quota contention and backlogs can delay jobs.

Studio checks whether the named cron job is active. If it is not configured, Studio explicitly states that automatic publication is unavailable and that the owner must check the version after its due time. With the job active, minute-level checks are approximate, not an execution-time guarantee. Use the Owner **Check due publication** action or the bounded service-only RPC to recover. Inspect `cron.job_run_details` for success/failure and `snoozer.publication_schedules` for pending/blocked states. Disabling this one job stops automatic checks; it does not silently discard schedules or prevent explicit owner checks. Do not drop shared `pg_cron` or unrelated jobs.

## Verification

Local PostgreSQL regressions cover frozen content versus newer drafts, private/hidden content, entitlement and ownership denial, time boundaries, explicit offline/cancel, idempotent execution, repeated replacement beyond twenty versions, bounded batches and account publication quotas after a downgrade. Browser coverage exercises capture, no early publication, preserved later draft, due owner execution and cancellation. The recorded 18 November hosted fixture execution is historical evidence; verify the current `cron.job` and latest CI before making a new release claim.
