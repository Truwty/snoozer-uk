# Snoozer.uk — release and engineering status

**Last reviewed:** 27 November 2026  
**Default branch:** `main`  
**Reviewed main commit:** `be0f0798e47d52cdba78f96bcd91af172ffda360`

## Current platform state

- Snoozer's public website is live. The main Render service is `snoozer-uk-staging` (`srv-dbts6jon74is73en2rjg`), Frankfurt, Node, Free plan, tracking `main`. Render reports auto-deploy on commit is enabled.
- The connected Supabase project `snoozer-staging` (`edgptbiwswcdmmxzwhxv`) is `ACTIVE_HEALTHY`, PostgreSQL 17.12. The migration history contains 172 migrations, latest `20261127145557_homepage_stats`.
- Snoozer sells its own Plus, Pro and Studio subscriptions only. Creator marketplace/seller onboarding remains retired.
- The operator has confirmed that live payments and subscriptions are working. Do not disable Checkout, change the six approved LIVE prices, replace the Stripe account/webhook or alter payment gates as part of unrelated work.
- The Status Page has a separate repository/service and is not part of this application. The main repository still contains `/help` routes. A standalone Help Centre Render service was not present in the connected Render service inventory during this review, so do not describe Help Centre hosting as independently verified here.

## Latest main-branch CI

[CI run #1312](https://github.com/Truwty/snoozer-uk/actions/runs/46021425902) passed on the reviewed main commit on 27 November 2026. This is evidence for that commit only; every new pull request must pass its own latest-head CI.

The pipeline currently runs dependency audit, secret scanning, ESLint, TypeScript, unit/database tests, production build and five Playwright shards. This security branch extends secret scanning to Git history and removes the withdrawn dependency-advisory exception; its final status must be taken from its own PR checks.

## Current work

Branch: `security/comprehensive-audit-2026-11-27`

Scope:
- Review authentication, account/session selection, MFA, Owner permissions, RLS/RPC grants, storage, uploads/exports, custom domains, webhooks, external fetches, CI and deployment configuration.
- Record the verified database posture and the remaining operator actions in [security-audit.md](security-audit.md).
- Refresh the active product and operations documentation and remove superseded implementation/planning documents.
- Run CI on the exact pull-request head; do not merge or deploy this branch without the owner's explicit instruction.

## Outstanding security/operations actions

1. Enable Supabase leaked-password protection if the current project plan supports it; the connected advisor currently reports it disabled.
2. Verify GitHub branch protection and required checks in repository settings. The connected API could not read branch protection.
3. Review the full-history Gitleaks result and rotate any confirmed historical credentials.
4. Reconcile the Render dashboard health-check path: the live service reports an empty path while `render.yaml` specifies `/health/live`.
5. Complete the security branch's CI and review the final diff before release.

## Source of truth

- Product and engineering docs: [documentation index](README.md)
- Security posture: [security audit](security-audit.md) and [threat model](threat-model.md)
- Live subscriptions: [Premium launch operations](premium-live-launch.md)
- Feature reference: [feature ledger](feature-ledger.md)
