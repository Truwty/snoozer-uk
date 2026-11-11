# Progress — 11 November 2026

Milestone 0 scaffolding and the Milestone 1 profile lifecycle are in the repository. Hosted rollout and advanced abuse controls remain open.

## Implemented

- Next.js App Router with React, TypeScript and Tailwind. Render Free Blueprint, Dockerfile, CI, environment template, threat model and operational guides.
- Supabase email/password signup, explicit verification, sign-in, reset and logout. Configured templates for the local CLI stack and hosted setup instructions.
- Atomic username claim, availability lookup and reserved routes. One page per verified account and 20 ordered links per page.
- Owner-only drafts, three themes, live responsive preview, optimistic revision checks, immutable published snapshots, unpublish, link sharing, canonical metadata and opt-in indexing.
- Thirteen SQL migrations under `supabase/migrations`. Private avatar staging, signed direct upload, bounded raster decoding, WebP generation, private derivatives and active-publication checks.

- Permanent profile deletion retires the username and queues media cleanup. Replacement profiles have separate storage and reject stale editor writes. See [avatar cleanup](avatar-cleanup.md).

- Milestone 2 started with owner-only publish history, version previews and restore to draft. Publishing a restored draft creates a new publication. The current live page stays in place until then.

- Studio saves valid drafts after a one-second pause. It retains edits made while a save is pending and lets owners copy unsaved edits or load the saved version after a revision conflict. Publishing and avatar removal remain explicit.

- The avatar cleanup worker also sweeps processed files older than 24 hours on active profiles when neither the draft nor a retained publication references them.

- Avatar staging uses a distinct key for each attempt. Studio expires attempts after 24 hours and permits 12 new attempts per UTC day per profile. Discard and completion retire the old key, and cleanup can remove expired staged files safely.

- Studio supports undo and redo for profile fields and links during the current editor session, including edits already autosaved. Keyboard focus follows added, moved and removed links.

- Studio text sections support headings and multiline plain text. The editor can add, reorder and remove up to six sections, with autosave and undo. Publishing and history restore include ordered section snapshots.
- Studio and the public gallery include three first-party templates. Creators can preview privately, apply colours alone, or add starter text when their draft has no sections.

- Studio offers wide, 375 px and 320 px previews. Profile card spacing and type respond to the card width so a phone preview on a desktop follows the same rules as the public page.

- Studio image galleries support private uploads, draft reordering and removal, and publication snapshots. The media worker now clears expired gallery attempts and unreferenced assets. An operator command blocks gallery images across draft, live page and retained history, with a recorded case reference. See [Studio image gallery](image-gallery.md).

- Studio now has private media folders for current draft and retained history images. Folder operations use their own revision and leave public gallery order unchanged. See [Studio image gallery](image-gallery.md).

- Studio sections now support Text, Callout and Quote. Callouts and attributed quotes use the shared preview, public renderer and publication history. See [Studio sections and templates](studio-sections.md).

- Card spacing and corners use built-in choices shared by Studio and public pages. Appearance settings are saved in drafts, included in immutable publications and restored with history.

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
| [GitHub Actions 42922122949](https://github.com/Truwty/snoozer-uk/actions/runs/42922122949) | Template gallery and Studio selection, starter application, section ordering, literal HTML-like text, publish and history restore. | 17 unit/SQL and 16 browser tests passed |
| [GitHub Actions 42922738910](https://github.com/Truwty/snoozer-uk/actions/runs/42922738910) | Full disposable Supabase suite, with browser comparison of Studio and public card widths and title sizes at 320 and 375 pixels. | 17 unit/SQL and 16 browser tests passed |
| Local gallery verification | Raster orientation, metadata stripping, disguised and animated input rejection, pixel limits, owner-only media access, snapshot ordering, restore, cleanup selection, upload quotas and idempotent takedowns. | 22 unit/SQL tests and 13 browser smoke tests passed locally; four provider tests skipped locally |
| [GitHub Actions 42924787549](https://github.com/Truwty/snoozer-uk/actions/runs/42924787549) | Initial gallery run: signed upload and disguised raster rejection reached the expected UI, but the test matched both the validation alert and the Next.js navigation announcer. The assertion now targets the validation message. | 20 unit/SQL and 16 of 17 browser tests passed |
| [GitHub Actions 42925475389](https://github.com/Truwty/snoozer-uk/actions/runs/42925475389) | Verified valid upload, draft isolation, reorder, publication, removal and retained private access. The takedown test read the Studio preview URL before client navigation finished; the test now loads the public page explicitly and checks the media path. | 22 unit/SQL and 16 of 17 browser tests passed |
| [GitHub Actions 42926076818](https://github.com/Truwty/snoozer-uk/actions/runs/42926076818) | Full suite on disposable Supabase verified signed uploads, private buckets and readiness, reorder and publish, retained history access, and the operator command blocking both public and owner image routes. | 22 unit/SQL and 17 browser tests passed |
| Local folder verification | Embedded PostgreSQL checks validation, cross-owner access, stale folder revisions, profile replacement, unfiling on deletion, and unchanged public snapshots. | 23 unit/SQL tests passed locally |
| [GitHub Actions 42927327264](https://github.com/Truwty/snoozer-uk/actions/runs/42927327264) | Private folders verified on disposable Supabase: create, move, filter after reload, rename and delete at phone width, axe scan and no change to public gallery order or metadata. | 23 unit/SQL and 17 browser tests passed |
| Local section types | Real SQL rejects unknown types and preserves text, callout and quote order through draft changes, publish and restore. | 23 unit/SQL tests passed locally |
| [GitHub Actions 42927900939](https://github.com/Truwty/snoozer-uk/actions/runs/42927900939) | Callouts and quotes preview, publish and restore against disposable Supabase, alongside the private folder regressions. | 23 unit/SQL and 17 browser tests passed |
| Local appearance verification | SQL rejects unknown keys and values, accepts old save requests, keeps draft choices private and restores snapshot values. | 24 unit/SQL tests passed locally; provider browser verification pending |
| Render JSON Schema | Validated the Blueprint against the public Render schema. | Passed. Render deployment remains unverified. |
| `npx --yes supabase@3.1.0 start` | The local stack requires a container engine. | Blocked locally. Docker and Podman unavailable. |

The embedded PostgreSQL tests execute the actual application migrations with small adapters for Supabase-specific roles and catalogues. They do not verify hosted Auth, Storage or network behaviour. [GitHub Actions run 42827654246](https://github.com/Truwty/snoozer-uk/actions/runs/42827654246) passed all 10 unit/SQL tests and 14 browser tests against disposable Supabase. It covered registration through publishing and password recovery, concurrent claims, and direct storage denial.

The first deletion CI run caught accessible names on Studio reorder buttons that differed from their visible labels. The labels were corrected. A later run stalled on optional Ubuntu font downloads, so CI now installs only the headless Chromium binary on the hosted runner.

## Remaining

- The private `Truwty/snoozer-uk` repository was created and the source was pushed. The first CI run passed concurrent claims and cross-user storage denial. Its full browser journey reached avatar upload and draft save, then caught a blank HTTP 404 for unpublished profiles with JavaScript disabled. The fix returned a readable 404 in a local HTTP regression check and passed the full CI rerun.
- Hosted Supabase configuration, transactional email, Render Free deployment, restart testing, domain/TLS, capacity benchmarks and recovery rehearsal are unverified.
- Configure hosted cleanup scheduling and extend abuse controls. Continue Milestone 2 with more theme controls and interactive blocks. The wider moderation dashboard, notices and appeals remain open in the [feature ledger](feature-ledger.md).
