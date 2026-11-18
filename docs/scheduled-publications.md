# Scheduled publications

Migration 63 freezes a saved draft into an immutable content snapshot, without changing the active page. Subsequent draft saves do not change that snapshot. Manual publish or taking a profile offline cancels the pending schedule, including an offline action on an already-unpublished profile. Cancellation never deletes content or changes the live page. One current schedule exists per profile; replacing it prepares a new snapshot.

All times are explicit UTC, one minute to 365 days ahead. Plus or higher is required both when capturing and when activating. Activation rechecks verified ownership, current plan features, custom-SEO eligibility, link limits and account-wide publication quota. A downgrade blocks execution without deleting the saved version or current page. Blocked versions must be reviewed and scheduled again. Deleted profiles cascade their schedules. A separate activation timestamp distinguishes prepared snapshots from versions that actually went live.

The account advisory lock is acquired before the profile lock, sharing the manual-publish quota boundary. Profile/schedule row locks and terminal states make retries idempotent. The batch runner is service-only, limited to 1–50 candidates, and skips busy work rather than hanging. Owners can check only their own due version; no caller can supply a simulated current time. Every activation keeps newer drafts intact. Retention protects active and pending snapshots beyond the usual twenty recent versions, without unbounded version growth.

## Operation

After applying migration 63, run supabase/operations/schedule-publications.sql on the existing authorised Supabase database. It registers only snoozer-publications-v1 once per minute; it needs no paid service, external worker, HTTP secret or wake-up pings. Observe an actual naturally scheduled execution and a dedicated staging-only publication before claiming automatic delivery works. Registering the job alone is not proof.

Studio checks whether that named cron job is active. If it is not configured, Studio explicitly states that automatic publication is unavailable and that the owner must check the version after its due time. With the job active, minute-level checks are approximate, not an execution-time guarantee. Supabase pauses, database failures, quota contention and backlogs can delay jobs. Use the owner Check due publication action or the bounded service-only RPC to recover. No in-memory timer or sleeping Render process is required.

The setup script bounds its own cron log retention to seven days. Inspect job_run_details for success/failure and publication_schedules for pending/blocked states. Disabling this one job stops automatic checks; it does not silently discard schedules or prevent explicit owner checks. Do not drop shared pg_cron or unrelated jobs.

## Verification

Local PostgreSQL regressions cover frozen content versus newer drafts, private/hidden content, entitlement and ownership denial, time boundaries, explicit offline/cancel, idempotent execution, repeated replacement beyond twenty versions, bounded batches and account publication quotas after a downgrade. Browser coverage is implemented for capture, no early publication, preserved later draft, due owner execution and cancellation. Hosted native cron registration and natural execution passed on 18 November: the dedicated phase5-qa-20261118 fixture activated version5 at09:19 UTC and retained draft revision6. See PROGRESS.md.
