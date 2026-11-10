# Avatar cleanup

Studio's permanent profile deletion removes the profile, draft, links and publish history in one database transaction. The account stays usable. Snoozer permanently retires the old username to protect people following old links. A verified account can claim its first replacement immediately, then one replacement per 24 hours. The limit applies to claiming, so users can always delete their profile.

Each profile has a separate storage namespace. Migration 20261110000400 keeps existing profiles on their existing storage paths. A deletion queues the retired namespace, including unpublished uploads and processed avatars. The new profile receives a new namespace and starts with a revision above the deleted profile's last revision. Old editor tabs and signed uploads therefore cannot change the replacement profile. Published avatar URLs stop resolving as soon as the profile is deleted.

## Process the queue

1. Set the intended project's `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in a secure operator environment. The command also reads ignored `.env.local` if present. Check the project URL before running the command.
2. Run `npm run cleanup:avatars` from the repository root on Node.js 24 or 26. It processes at most ten due jobs and up to 40 orphaned processed avatars. It exits nonzero if cleanup needs a retry.
3. Schedule this command on an authorised runner or run it manually on an agreed cadence. No hosted schedule is configured. Run batches again if the queue is growing.
4. Investigate repeated failures before running `npm run cleanup:avatars -- --retry-failed` to requeue dead jobs. The worker deliberately stops if a namespace contains unexpected keys or more objects than the application allows.

Jobs first become due three hours after deletion to cover the signed upload window. A worker leases each job for five minutes, removes objects through the Storage API, verifies that both buckets are empty for the scope, and acknowledges completion using its lease token. Interrupted jobs can run again after lease expiry. Explicit failures retry with backoff and stop after eight failures. The command can run while Render is asleep.

On active profiles, the worker also sweeps processed avatars older than 24 hours if neither the current draft nor any retained publication references them. Processed avatar keys are unique, so a later upload uses a different path. This sweep is safe to run again after a partial failure.

Active-profile pending uploads still use a reusable path. Expiring them safely needs distinct paths for upload attempts. Account deletion, legal holds and backup retention remain separate work. Configure and monitor the hosted runner before accepting production uploads.

[Supabase signed upload URLs](https://supabase.com/docs/reference/javascript/storage-from-createsigneduploadurl) · [Supabase Storage object deletion](https://supabase.com/docs/guides/storage/management/delete-objects)
