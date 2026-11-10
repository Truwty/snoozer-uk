# Progress — 10 November 2026

Milestone 0 scaffolding and the first Milestone 1 implementation are in the repository. Milestone 1 remains open pending full Supabase verification and profile deletion.

## Implemented

- Next.js App Router with React, TypeScript and Tailwind. Render Free Blueprint, Dockerfile, CI, environment template, threat model and operational guides.
- Supabase email/password signup, explicit verification, sign-in, reset and logout. Configured templates for the local CLI stack and hosted setup instructions.
- Atomic username claim, availability lookup and reserved routes. One page per verified account and 20 ordered links per page.
- Owner-only drafts, three themes, live responsive preview, optimistic revision checks, immutable published snapshots, unpublish, link sharing, canonical metadata and opt-in indexing.
- Three SQL migrations under `supabase/migrations`. Private avatar staging, signed direct upload, bounded raster decoding, WebP generation, private derivatives and active-publication checks.

## Verification evidence

| Command | Evidence | Result |
| --- | --- | --- |
| `npm test` | `tests/profile.test.ts`, `tests/avatar.test.ts`, `tests/database.test.ts`. Canonical names, malformed links and image rejection, actual SQL migration constraints, cross-owner denial, revision conflicts, publication and avatar isolation. | 10 passed |
| `npm run lint`, `npm run typecheck`, `npm run build` | ESLint, Next route types, strict TypeScript and production compiler. | Passed |
| `npm audit` | Locked production and development dependency tree. Resolved the initial development minimatch advisory via a scoped override. | 0 reported vulnerabilities |
| `npm run test:e2e -- --workers=2` with `PLAYWRIGHT_CHANNEL=msedge` | Six homepage widths, anonymous Studio redirect, liveness and four mobile axe scans. Fixed the brand label mismatch and reran. | 12 passed, 2 provider tests skipped |
| Render JSON Schema | Validated the Blueprint against the public Render schema. | Passed. Render deployment remains unverified. |
| `npx --yes supabase@3.1.0 start` | The local stack requires a container engine. | Blocked locally. Docker and Podman unavailable. |

The embedded PostgreSQL tests execute the actual application migrations with small adapters for Supabase-specific roles and catalogues. They do not verify hosted Auth, Storage or network behaviour. The provider suite covers registration through publishing and password recovery, plus concurrent claims and direct storage denial.

## Remaining

- The private `Truwty/snoozer-uk` repository was created and the source was pushed. The first CI run passed concurrent claims and cross-user storage denial. Its full browser journey reached avatar upload and draft save, then caught a blank HTTP 404 for unpublished profiles with JavaScript disabled. The fix returned a readable 404 in a local HTTP regression check. A fresh CI run is required for the full flow.
- Hosted Supabase configuration, transactional email, Render Free deployment, restart testing, domain/TLS, capacity benchmarks and recovery rehearsal are unverified.
- Complete profile deletion, durable orphan cleanup, abuse and quota controls, and browser coverage for authenticated Studio. Then continue with Studio history and advanced media, Stripe and Ko-fi, analytics, creator commerce, moderation, admin and the remaining [feature ledger](feature-ledger.md).
