<div align="center">

# Snoozer.uk

**Own your corner of the internet.**  
*A privacy-first identity and profile publishing platform.*

[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](https://www.typescriptlang.org)
[![Supabase](https://img.shields.io/badge/Database-Supabase-3ecf8e)](https://supabase.com)
[![Tests](https://img.shields.io/badge/Tests-Vitest%20%26%20Playwright-brightgreen)](https://playwright.dev)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

[**Project status**](docs/PROGRESS.md) · [**Documentation**](docs/) · [**Contributing**](CONTRIBUTING.md) · [**Security policy**](SECURITY.md)

</div>

## Overview

Snoozer is a self-hostable profile and publishing platform built with Next.js, TypeScript and Supabase. It separates authenticated editing from public profile delivery and uses PostgreSQL Row-Level Security to protect private creator data.

## Features

- Public profile pages with configurable links, appearance and publishing controls.
- Studio editing with draft and published states.
- Analytics and privacy-conscious visitor measurement.
- Profile widgets and media galleries.
- Account security, moderation and owner administration.
- Custom-domain support and search-engine metadata controls.

Feature availability may vary by release. The project status and individual guides describe what is implemented; open pull requests and feature branches are not production releases.

## Technology

- Next.js App Router, React and TypeScript.
- Supabase Auth, PostgreSQL, Row-Level Security and Storage.
- Vitest for unit and database integration tests.
- Playwright for browser end-to-end tests.
- GitHub Actions for continuous integration.

## Local development

### Requirements

Use the Node.js version pinned in `.node-version`, npm, and Docker for the local Supabase test stack.

### Install

```bash
git clone https://github.com/Truwty/snoozer-uk.git
cd snoozer-uk
npm ci
cp .env.example .env.local
```

Populate `.env.local` only with disposable local credentials. Never copy production keys into a developer workstation, issue, pull request or commit.

### Start the local database

```bash
npx --yes supabase@3.1.0 start
```

Follow the local setup guide in [docs/setup-supabase.md](docs/setup-supabase.md). Run automated tests only against this disposable environment.

### Validate changes

```bash
npm run lint
npm run typecheck
npm run audit
npm test
npm run build
npm run test:e2e
```

## Documentation

The `docs/` directory contains feature guides, architecture notes, development instructions and operational safety guidance. Production credentials, customer records and private deployment identifiers must never be stored there.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Keep changes focused, add tests for new behaviour and ensure all required checks pass before requesting review.

## Security

Read [SECURITY.md](SECURITY.md) before reporting a vulnerability. Never publish credentials or personally identifying user data in issues or pull requests.
