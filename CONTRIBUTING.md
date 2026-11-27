# Contributing to Snoozer.uk

Thanks for considering a contribution. This guide describes the development and review process for the current Next.js and Supabase application.

## Before you start

Use:

- Node.js 24, as pinned in `.node-version`
- npm (install exactly from `package-lock.json` with `npm ci`)
- Docker for the disposable local Supabase stack
- Git and a GitHub account

Read the [architecture decisions](docs/architecture-decisions.md), [threat model](docs/threat-model.md) and [security policy](SECURITY.md) before changing authentication, database, storage, billing or deployment code.

## Local setup

```bash
git clone https://github.com/Truwty/snoozer-uk.git
cd snoozer-uk
npm ci
npx --yes supabase@3.1.0 start
cp .env.example .env.local
npx --yes supabase@3.1.0 status
npm run dev
```

Populate `.env.local` from the disposable local Supabase output. Never copy production keys or live Stripe credentials into a development environment.

## Branches and commits

Create a focused branch from the latest `main`:

```bash
git switch main
git pull --ff-only
git switch -c fix/short-description
```

Use descriptive branch prefixes such as `fix/`, `feat/`, `docs/` and `test/`. Keep each pull request focused. Use imperative commit messages, for example `fix: restrict private media export to its owner`.

## Database changes

- Add a new, timestamped SQL migration under `supabase/migrations/`.
- Do not rewrite a migration already applied to a shared or hosted project.
- Prefer additive, reversible changes; document any unavoidable data migration.
- Explicitly review grants, RLS, function ownership, `SECURITY DEFINER` and `search_path`.
- Test the migration chain on a disposable local database.
- Never run `db reset` against a hosted project or manually edit production data as part of a code change.

## Security-sensitive changes

For authentication, Owner permissions, private data, storage and billing:

- Validate identities with Supabase Auth on the server; never trust a browser-supplied user ID as proof of ownership.
- Enforce ownership and business invariants in the database as well as the application.
- Keep service-role credentials in server-only runtime configuration.
- Bound request bodies, validate schemas and use non-overwriting private upload paths.
- Verify webhook signatures before processing and make event handling idempotent.
- Add regression tests for unauthorised, cross-account and replay attempts.

Do not weaken payment gates, rotate production payment credentials or change live subscription prices in a general feature pull request.

## Required local checks

```bash
npm run audit
npm run lint
npm run typecheck
npm test
npm run build
```

For browser changes:

```bash
npx playwright install chromium
npm run test:e2e
```

Provider tests must use disposable local Supabase and test credentials. Never point an automated test at customer accounts or live payment methods.

## Pull request checklist

- [ ] The change is narrowly scoped and has a clear rationale.
- [ ] Tests cover expected behaviour and relevant negative/authorization cases.
- [ ] Database changes use a new migration and pass migration replay.
- [ ] Environment variables and documentation are updated.
- [ ] No credentials, personal data, production logs or generated artifacts are committed.
- [ ] CI passes on the exact pull-request head.
- [ ] User-visible behaviour and operational impact are described.

Do not merge or deploy on behalf of the repository owner unless they explicitly ask for that action.
