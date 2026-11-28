# Render deployment and release procedure

**Reviewed:** 27 November 2026

## Current service

The main Snoozer web application runs on the Render service:

- Name: `snoozer-uk-staging`
- Service ID: `srv-dbts6jon74is73en2rjg`
- Region/runtime: Frankfurt, Node
- Plan: Free
- Branch: `main`
- URL: `https://snoozer-uk-staging.onrender.com`
- Main custom domain: `https://snoozer.uk`
- Auto-deploy: enabled for commits

The service name contains “staging”, but it is the connected main Snoozer web service. Check the Render dashboard before assuming that a new service or environment exists.

## Blueprint

The repository Blueprint is `render.yaml`. It defines:

- Node web service, Frankfurt, Free plan.
- Build: `npm ci --include=dev && npm run build && npm prune --omit=dev`.
- Start: `npm start`.
- Health check: `/health/live`.
- Commit-based automatic deployment from `main`.

**Configuration drift found on 27 November:** the connected Render service currently reports an empty health-check path even though the repository Blueprint specifies `/health/live`. Reconcile the health-check setting in the Render dashboard and verify that the endpoint returns the expected liveness response. Do not assume the Blueprint is already reflected in the live service.

## Safe release procedure

1. Create a focused feature or fix branch.
2. Open a pull request to `main`.
3. Require the latest-head CI aggregate `validate` check to pass. Review the file diff and security-sensitive database/secret changes.
4. Merge only with the repository owner's explicit approval.
5. Main-branch commits automatically deploy to the connected Render service. Do not trigger a second manual deploy after an automatic deployment has begun.
6. Verify the deploy's commit SHA and status in Render.
7. Check `/health/live` and `/health/ready`, then test the specific authenticated and public journeys affected by the change.
8. Monitor logs and relevant Supabase/Stripe queues. Roll back only when the old code is compatible with the current database schema; prefer forward-fix migrations for additive schema changes.

This documentation task does not authorise a merge, Render configuration change or deployment. The owner controls the release.

## Secrets and environment

Set runtime credentials only in Render's Environment page. Do not commit secrets or place them in `NEXT_PUBLIC_*`. Keep migration credentials out of the application runtime unless a documented operation explicitly requires them.

See [Supabase setup](setup-supabase.md) for authentication URLs, SMTP and migrations. See [security audit](security-audit.md) for current deployment findings.

## References

- [Render web services](https://render.com/docs/web-services)
- [Render health checks](https://render.com/docs/health-checks)
- [Render custom domains](https://render.com/docs/custom-domains)
