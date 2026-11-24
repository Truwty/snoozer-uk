# Developer handover

This document is the public developer handover for Snoozer. It intentionally contains no production credentials, customer identifiers, private deployment references or account-specific operational notes.

## Repository

- Repository: [Truwty/snoozer-uk](https://github.com/Truwty/snoozer-uk)
- Release branch: `main`
- Stack: Next.js, React, TypeScript, Supabase/PostgreSQL, Vitest and Playwright.
- Runtime versions: see `.node-version` and `package.json`.

## Local setup

1. Install the Node.js version pinned by `.node-version`.
2. Install dependencies with `npm ci`.
3. Copy `.env.example` to `.env.local` and use only disposable local/test credentials.
4. Start the local Supabase stack using the version pinned in `.github/workflows/ci.yml`.
5. Apply migrations to the disposable local database.
6. Run the required checks before opening or updating a pull request.

## Validation commands

```bash
npm run lint
npm run typecheck
npm test
npm run audit
npm run build
npm run test:e2e
```

The browser suite that requires database-backed fixtures must use a disposable local Supabase environment. Never point automated tests at a production database.

## Database and release safety

- Keep schema changes in ordered files under `supabase/migrations/`.
- Validate the complete migration sequence on a disposable local database.
- Do not apply migrations to hosted production databases as part of a code-only change.
- Keep all provider keys, service-role credentials, signing secrets and OAuth refresh tokens in the hosting provider's secret manager.
- Never place real user records, account identifiers, payment references or production logs in documentation, fixtures or issue reports.
- Do not mark a feature released solely because a branch exists or a pull request is mergeable.

## Security review

Use the repository's Gitleaks checks for both the working tree and reachable Git history. Review results before bypassing any finding. If a real credential was committed, revoke or rotate it with its provider even after removing it from Git history.

## Continuing work

Start from the latest `main`, inspect the relevant feature documentation and migrations, and preserve the existing security boundaries. Update the public documentation when behaviour changes. Keep owner-only, customer-specific and deployment-specific evidence outside the public repository.
