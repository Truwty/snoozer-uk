# Progress — 10 November 2026

Milestone 0 scaffolding and the Milestone 1 profile lifecycle are in the repository. Hosted rollout and advanced abuse controls remain open.

## Implemented

- Next.js App Router with React, TypeScript and Tailwind. Render Free Blueprint, Dockerfile, CI, environment template, threat model and operational guides.
- Supabase email/password signup, explicit verification, sign-in, reset and logout. Configured templates for the local CLI stack and hosted setup instructions.
- Atomic username claim, availability lookup and reserved routes. One page per verified account and 20 ordered links per page.
- Owner-only drafts, three themes, live responsive preview, optimistic revision checks, immutable published snapshots, unpublish, link sharing, canonical metadata and opt-in indexing.
- Eight SQL migrations under `supabase/migrations`. Private avatar staging, signed direct upload, bounded raster decoding, WebP generation, private derivatives and active-publication checks.

- Permanent profile deletion retires the username and queues media cleanup. Replacement profiles have separate storage and reject stale editor writes. See [avatar cleanup](avatar-cleanup.md).

- Milestone 2 started with owner-only publish history, version previews and restore to draft. Publishing a restored draft creates a new publication. The current live page stays in place until then.

- Studio saves valid drafts after a one-second pause. It retains edits made while a save is pending and lets owners copy unsaved edits or load the saved version after a revision conflict. Publishing and avatar removal remain explicit.

- The avatar cleanup worker also sweeps processed files older than 24 hours on active profiles when neither the draft nor a retained publication references them.

- Avatar staging uses a distinct key for each attempt. Studio expires attempts after 24 hours and permits 12 new attempts per UTC day per profile. Discard and completion retire the old key, and cleanup can remove expired staged files safely.

- Studio supports undo and redo for profile fields and links during the current editor session, including edits already autosaved. Keyboard focus follows added, moved and removed links.

- Studio text sections support headings and multiline plain text. The editor can add, reorder and remove up to six sections, with autosave and undo. Publishing and history restore include ordered section snapshots.
- Studio and the public gallery include three first-party templates. Creators can preview privately, apply colours alone, or add starter text when their draft has no sections.

## Verification evidence

| Command | Evidence | Result |
| --- | --- | --- |
| `npm test` | `tests/profile.test.ts`, `tests/avatar.test.ts`, `tests/database.test.ts`. Canonical names, malformed links and image rejection, actual SQL migration constraints, cross-owner denial, revision conflicts, publication and avatar isolation. | 13 passed locally after adding deletion, queue and version restore coverage |
| `npm run lint`, `npm run typecheck`, `npm run build` | ESLint, Next route types, strict TypeScript and production compiler. | Passed |
| `npm audit` | Locked production and development dependency tree. Resolved the initial development minimatch advisory via a scoped override. | 0 reported vulnerabilities |
| `npm run test:e2e -- --workers=2` with `PLAYWRIGHT_CHANNEL=msedge` | Six homepage widths, anonymous Studio redirect, liveness and four mobile axe scans. Fixed the brand label mismatch and reran. | 12 passed, 2 provider tests skipped |
| [GitHub Actions 42831324792](https://github.com/Truwty/snoozer-uk/actions/runs/42831324792) | Disposable Supabase with actual Auth and Storage. Version restore and republish, authenticated Studio and public-page axe scans, profile deletion, signed upload after deletion, and worker cleanup that preserves the replacement profile’s files. | 13 unit/SQL tests and 14 browser tests passed |
| [GitHub Actions 42832744852](https://github.com/Truwty/snoozer-uk/actions/runs/42832744852) | Autosave persistence, public-page isolation, changes made during an in-flight save and conflict recovery across two tabs. | 13 unit/SQL and 15 browser tests passed |
| [GitHub Actions 42833454025](https://github.com/Truwty/snoozer-uk/actions/runs/42833454025) | Processed avatar sweep migration and worker on disposable Supabase. SQL tests cover aged orphan selection, draft and history protection, and access control. | Passed |
| [GitHub Actions 42908138432](https://github.com/Truwty/snoozer-uk/actions/runs/42908138432) | Disposable Supabase verified signed upload replay after discard, replacement staging and profile cleanup. SQL tests cover stage expiry and the per-profile attempt limit. | 16 unit/SQL and 15 browser tests passed |
| [GitHub Actions 42908876092](https://github.com/Truwty/snoozer-uk/actions/runs/42908876092) | Current Studio and asset baseline. Verified keyboard reordering, focus following the moved link, undo and redo across autosaves, stale-tab recovery, upload replay isolation and profile cleanup. | 16 unit/SQL and 15 browser tests passed |
| Render JSON Schema | Validated the Blueprint against the public Render schema. | Passed. Render deployment remains unverified. |
| `npx --yes supabase@3.1.0 start` | The local stack requires a container engine. | Blocked locally. Docker and Podman unavailable. |

The embedded PostgreSQL tests execute the actual application migrations with small adapters for Supabase-specific roles and catalogues. They do not verify hosted Auth, Storage or network behaviour. [GitHub Actions run 42827654246](https://github.com/Truwty/snoozer-uk/actions/runs/42827654246) passed all 10 unit/SQL tests and 14 browser tests against disposable Supabase. It covered registration through publishing and password recovery, concurrent claims, and direct storage denial.

The first deletion CI run caught accessible names on Studio reorder buttons that differed from their visible labels. The labels were corrected. A later run stalled on optional Ubuntu font downloads, so CI now installs only the headless Chromium binary on the hosted runner.

## Remaining

- The private `Truwty/snoozer-uk` repository was created and the source was pushed. The first CI run passed concurrent claims and cross-user storage denial. Its full browser journey reached avatar upload and draft save, then caught a blank HTTP 404 for unpublished profiles with JavaScript disabled. The fix returned a readable 404 in a local HTTP regression check and passed the full CI rerun.
- Hosted Supabase configuration, transactional email, Render Free deployment, restart testing, domain/TLS, capacity benchmarks and recovery rehearsal are unverified.
- Configure hosted cleanup scheduling and extend abuse controls. Continue Milestone 2 with additional block types, a media gallery and asset moderation, then the remaining [feature ledger](feature-ledger.md).
