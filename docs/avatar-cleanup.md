# Avatar and private-media cleanup

**Reviewed:** 27 November 2026

Studio's permanent profile deletion removes the profile, draft, links and publish history in one database transaction. The account stays usable. Snoozer permanently retires the old username to protect people following old links. A verified account can claim its first replacement immediately, then one replacement per 24 hours. The limit applies to claiming, so users can always delete their profile.

Each profile has a separate storage namespace. Migration `20261110000400_profile_deletion` keeps existing profiles on their existing storage paths. A deletion queues the retired namespace, including staged uploads, processed avatars and gallery images. The new profile receives a new namespace and starts with a revision above the deleted profile's last revision. Old editor tabs and signed uploads therefore cannot change the replacement profile. Published avatar URLs stop resolving as soon as the profile is deleted.

## Process the queue

1. Set the intended project's `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in a secure operator environment. The command also reads ignored `.env.local` if present. Check the project URL before running the command.
2. Run `npm run cleanup:avatars` from the repository root on Node.js 24 or 26. It processes at most ten due jobs and up to 40 orphaned processed avatars and 40 abandoned uploads. It also collects up to 100 unreferenced gallery registry entries and sweeps up to 100 orphan files per gallery bucket. It exits nonzero if cleanup needs a retry.
3. Schedule this command on an authorised runner or run it manually on an agreed cadence. **No dedicated cleanup cron or GitHub Actions workflow was verified in this audit.** Do not assume cleanup runs automatically.
4. Investigate repeated failures before running `npm run cleanup:avatars -- --retry-failed` to requeue dead jobs. The worker stops if a namespace contains unexpected keys. Large known batches are handled across retries.

Jobs first become due three hours after deletion to cover the signed upload window. A worker leases each job for five minutes, removes objects through the Storage API, verifies that all four media buckets are empty for the scope, and acknowledges completion using its lease token. Interrupted jobs can run again after lease expiry. Explicit failures retry with backoff and stop after eight failures. The command can run while Render is asleep.

On active profiles, the worker also sweeps processed avatars older than 24 hours if neither the current draft nor any retained publication references them. Processed avatar keys are unique, so a later upload uses a different path. This sweep is safe to run again after a partial failure.

Each new upload attempt uses a separate path and stays active for 24 hours. Studio allows 12 new attempts per profile per UTC day, and retrying an existing attempt does not consume another slot. The worker deletes an abandoned staging file once the file is 24 hours old and its attempt is retired or expired. Account deletion, legal holds and backup retention remain separate work.

## Safety requirements

Use a least-privilege operator environment and never commit or paste the service-role key. Do not run cleanup against an unverified project or use a production credential in a local test. Review the job counters and failed namespaces before requeueing a job. Test the command against disposable Supabase first when changing its behaviour.

[Supabase signed upload URLs](https://supabase.com/docs/reference/javascript/storage-from-createsigneduploadurl) · [Supabase Storage object deletion](https://supabase.com/docs/guides/storage/management/delete-objects)
