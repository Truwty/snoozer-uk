<div align="center">

# Snoozer.uk

**A clean, self-hostable personal page for the links, work, and projects you want to share.**

[![Next.js](https://shields.io)](https://nextjs.org)
[![TypeScript](https://shields.io)](https://typescriptlang.org)
[![Supabase](https://shields.io)](https://supabase.com)
[![Playwright](https://shields.io)](https://playwright.dev)
[![License](https://shields.io)](LICENSE)

[Roadmap](PROGRESS.md) · [Architecture & Threat Model](docs/) · [Contributing](CONTRIBUTING.md) · [Security Policy](SECURITY.md)

</div>

---

## Snoozer

**Snoozer.uk** is an open-source identity and publishing platform built as a privacy-respecting, self-hostable alternative to proprietary link-in-bio services. 

### Key Features
* **Custom Username & Identity**: Claim unique handles and manage account verification.
* **Studio Publishing Flow**: Draft and publish custom link collections, media galleries, and avatars.
* **Disposable Local Stack**: Quickly spin up a local Supabase environment (Postgres, Auth, Storage, and Inbucket).
* **Quality Gates & Deployment**: Backed by strict TypeScript, Vitest, Playwright E2E suites, Docker, and Render configuration.

---

## Tech Stack & Quick Start

* **Tech Stack**: Next.js, React, TypeScript, Supabase (PostgreSQL, Auth, Storage), Vitest, Playwright, Docker, Render.
* **Prerequisites**: Node.js 24 LTS (`npm`), Docker.
* **Local Setup**:
  ```bash
  git clone https://github.com
  cd snoozer-uk
  npm ci
  npx --yes supabase@3.1.0 start
  cp .env.example .env.local
  # Populate local credentials from `npx --yes supabase@3.1.0 status`
  npm run dev
  ```
* **Database Reset**: `npx --yes supabase@3.1.0 db reset`

---

## Verification & Documentation

* **Testing**: Run `npm run lint`, `npm run typecheck`, `npm test`, `npm audit`, `npm run build`, and `npm run test:e2e`.
* **Resources**: Review [PROGRESS.md](PROGRESS.md), [docs/](docs/), [CONTRIBUTING.md](CONTRIBUTING.md), and [SECURITY.md](SECURITY.md).

<div align="center">
<sub>Built in the open · Maintained by <a href="https://github.com">@Truwty</a></sub>
</div>
