# Snoozer.uk

A personal page for the links, work and projects you want to share. This repository contains the identity and publishing flows and is under active development. The launch roadmap and verification status are in [PROGRESS.md](docs/PROGRESS.md).

## Run locally

1. Install Node.js 24 LTS, npm and Docker.
2. Run `npm ci` and `npx --yes supabase@3.1.0 start` from the repository root. This starts the disposable Supabase database, Auth, Storage and email catcher.
3. Copy `.env.example` to `.env.local`. Fill the values from `npx --yes supabase@3.1.0 status` in your own terminal. Keep the service credential private.
4. Run `npm run dev`, visit [http://localhost:3000](http://localhost:3000), create an account and open the local [email catcher](http://127.0.0.1:54324) to verify it.
5. Claim a username in Studio, add links, [sections](docs/studio-sections.md), an avatar or [gallery images](docs/image-gallery.md), then publish your draft. Open the public URL in a private window to check visitor access.

`npx --yes supabase@3.1.0 db reset` destroys and rebuilds the **local** database. The migration files remain the source of truth. See [Supabase setup](docs/setup-supabase.md) for hosted settings and migration safeguards.

## Verification

```sh
npm run lint
npm run typecheck
npm test
npm audit
npm run build
npx playwright install chromium
npm run test:e2e
```

The browser smoke suite starts the production build on port 3000. To run the provider E2E cases, export the local Supabase settings as process environment variables and set `SNOOZER_TEST_LOCAL_SUPABASE=1` before building and running Playwright. See [Supabase setup](docs/setup-supabase.md) for the exact variables.

## Operations

- [Roadmap](docs/implementation-plan.md) and [numbered feature ledger](docs/feature-ledger.md)
- [Architecture decisions](docs/architecture-decisions.md) and [threat model](docs/threat-model.md)
- [Private GitHub setup](docs/github-private-repo.md), [Render deployment](docs/deploy-render.md) and [free-tier limits](docs/free-tier-feasibility.md)
- [Next session](docs/CONTINUE.md)
