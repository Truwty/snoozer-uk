# Contributing to Snoozer.uk

Thank you for your interest in contributing to **Snoozer.uk**! Whether you are fixing a typo, adding a new Studio block, writing Playwright tests, or refining database migrations, your contributions help build a better, privacy-first publishing platform.

---

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Database Migrations](#database-migrations)
- [Quality Gates & Testing](#quality-gates--testing)
- [Pull Request Process](#pull-request-process)
- [Reporting Issues & Security](#reporting-issues--security)

---

## 🤝 Code of Conduct

We are committed to fostering an open, welcoming, and respectful community. Please be constructive in code reviews, discussions, and issue threads. Harassment or exclusionary behaviour of any kind is not tolerated.

---

## 🛠 Getting Started

Ensure you have **Node.js 24 LTS**, `npm`, and **Docker** installed before setting up the repository locally.

1. **Fork & Clone the Repository**
   ```bash
   git clone https://github.com<your-username>/snoozer-uk.git
   cd snoozer-uk
   ```

2. **Install Dependencies**
   ```bash
   npm ci
   ```

3. **Start the Local Supabase Stack**
   ```bash
   npx --yes supabase@3.1.0 start
   ```

4. **Configure Local Environment Variables**
   ```bash
   cp .env.example .env.local
   npx --yes supabase@3.1.0 status
   ```
   Copy the local `API URL`, `anon key`, and `service_role key` into `.env.local`. **Never commit `.env.local` or expose service credentials.**

5. **Run the Development Server**
   ```bash
   npm run dev
   ```

---

## 🌿 Development Workflow

1. **Sync with `main`**: Always branch off the latest `main` branch.
   ```bash
   git checkout main
   git pull origin main
   ```

2. **Create a Feature or Fix Branch**: Use clear, descriptive branch names:
   * `feat/<short-description>` (e.g., `feat/custom-theme-tokens`)
   * `fix/<short-description>` (e.g., `fix/studio-draft-preview`)
   * `docs/<short-description>` (e.g., `docs/update-setup-guide`)
   * `test/<short-description>` (e.g., `test/auth-e2e-coverage`)

3. **Keep Changes Focused**: Submit small, atomic pull requests that address a single bug, feature, or improvement.

4. **Follow Commit Conventions**: Use clear, imperative commit messages (e.g., `feat: add markdown support to bio section` or `fix: enforce RLS policy on draft media`).

---

## 🗄 Database Migrations

All schema changes must be managed through declarative SQL migrations in `supabase/migrations/`.

* **Never modify production schemas manually.**
* Create a new migration file for schema, index, or Row-Level Security (RLS) policy updates.
* Test your migrations from scratch by resetting your local database:
  ```bash
  npx --yes supabase@3.1.0 db reset
  ```
* Verify that all RLS policies strictly separate **authenticated creator mutations** from **unauthenticated public reads**.

---

## 🧪 Quality Gates & Testing

Before opening a pull request, ensure every check in our verification pipeline passes locally:

```bash
# 1. Linting & Strict Type Checking
npm run lint
npm run typecheck

# 2. Security Vulnerability Audit
npm audit

# 3. Unit & Integration Tests
npm test

# 4. Production Build Check
npm run build

# 5. End-to-End Browser Smoke Tests
npx playwright install chromium
npm run test:e2e
```

*If you are modifying authentication or storage flows, run the full provider E2E suite by exporting your local Supabase environment variables and setting `SNOOZER_TEST_LOCAL_SUPABASE=1` before running Playwright.*

---

## 🚀 Pull Request Process

1. **Update Documentation**: If your change alters environment variables, CLI commands, or architecture, update `README.md`, `.env.example`, or `docs/` accordingly.
2. **Add Test Coverage**: New features should include Vitest unit tests (`tests/`) and, where applicable, Playwright E2E coverage (`e2e/`).
3. **Open a Pull Request**:
   * Provide a clear summary of **what** changed and **why**.
   * Link any relevant issues or roadmap items from `PROGRESS.md`.
   * Include screenshots or screen recordings for UI changes in Studio or public profiles.
4. **CI Verification**: Ensure all GitHub Actions checks pass before requesting a review.

---

## 🐛 Reporting Issues & Security

* **Bugs & Feature Requests**: Open a GitHub Issue with reproduction steps, expected behaviour, and environment details.
* **Security Vulnerabilities**: **Do not open a public issue for security flaws.** Follow the private reporting instructions in [`SECURITY.md`](SECURITY.md).
