# Snoozer.uk

**Own your corner of the internet.**

Snoozer is a profile and publishing platform built with Next.js, TypeScript and Supabase. People create a public profile in Studio, publish links and content, and manage their account, privacy and subscription from one place.

> **Project status:** active development, pre-v1.0. The public website is live. Changes proposed on feature branches are not production changes until reviewed and released.

## Product boundaries

- Public creator profiles with a private Studio editor and revision-aware publishing.
- Profile customisation, links, sections, widgets, audio and background video.
- Account security features including email verification, multi-account sessions, authenticator MFA, recovery codes and session revocation.
- Consent-controlled first-party analytics and creator discovery preferences.
- Snoozer-owned Plus, Pro and Studio subscriptions. Creator marketplace and seller onboarding are retired.
- Optional Discord presence and official third-party embeds. External providers control their own availability and policies.

Snoozer does not promise that user-created links or embedded third-party content are safe. Visitors should use normal web-safety precautions.

## Technology

| Area | Implementation |
| --- | --- |
| Web application | Next.js App Router, React, TypeScript |
| Authentication | Supabase Auth with server-side session validation |
| Database | Supabase PostgreSQL, migrations, RLS and transactional RPCs |
| Media | Private Supabase Storage buckets and server-validated uploads |
| Payments | Stripe Billing for Snoozer-owned subscriptions |
| Quality | ESLint, TypeScript, Vitest, PGlite and Playwright |
| Hosting | Render Node web service; separate Discord presence worker |

## Run locally

### Requirements

- Node.js 24 (the version used by CI; see `.node-version`)
- npm
- Docker, for the disposable local Supabase stack
- Git

### Setup

```bash
git clone https://github.com/Truwty/snoozer-uk.git
cd snoozer-uk
npm ci
npx --yes supabase@3.1.0 start
cp .env.example .env.local
npx --yes supabase@3.1.0 status
```

Copy the local API URL, publishable/anon key and service-role/secret key from the local Supabase status output into `.env.local`. Use `http://localhost:3000` for `NEXT_PUBLIC_SITE_URL`. Keep every service-role key and provider secret server-side. Never use production credentials in a local test environment.

Start the application:

```bash
npm run dev
```

Open `http://localhost:3000`. Local email verification messages are available through the disposable Supabase mail catcher. Do not run destructive database commands against a hosted project.

## Quality checks

Run the same core checks used by CI:

```bash
npm run audit
npm run lint
npm run typecheck
npm test
npm run build
```

For browser tests:

```bash
npx playwright install chromium
npm run test:e2e
```

Provider-backed tests require the disposable local Supabase environment and the test-only environment flag described in [Supabase setup](docs/setup-supabase.md). GitHub Actions runs the browser suite in isolated shards against disposable Supabase instances.

## Documentation

Start at the [documentation index](docs/README.md). Key references:

- [Security policy](SECURITY.md) and [current security audit](docs/security-audit.md)
- [Threat model](docs/threat-model.md)
- [Development progress](docs/PROGRESS.md)
- [Architecture decisions](docs/architecture-decisions.md)
- [Render deployment](docs/deploy-render.md)
- [Supabase setup](docs/setup-supabase.md)
- [Billing operations](docs/billing-operations.md)

## Security

Please report vulnerabilities privately. Do not publish exploit details, credentials, customer data or proof-of-concept attacks against the live service. Read [SECURITY.md](SECURITY.md) first.

## License

Snoozer is distributed under the [MIT License](LICENSE).
