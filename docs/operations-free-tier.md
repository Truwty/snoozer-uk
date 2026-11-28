# Snoozer operations and capacity

**Reviewed:** 27 November 2026

This guide describes the current Free-plan operating model. Provider quotas and pricing can change; the Render and Supabase dashboards are authoritative for the account's current allowance. Do not copy historical quota figures into launch promises.

## Render

The connected web service is a Free Frankfurt Node service. Monitor:
- instance hours and sleep/wake behaviour;
- cold-start latency, memory and restarts;
- build duration and deployment failures;
- bandwidth and outbound requests;
- application errors, HTTP 5xx and health responses.

The repository contains `.github/workflows/keep-snoozer-awake.yml`, which pings the homepage on a ten-minute schedule. This is a keep-alive workaround, not an uptime guarantee or a substitute for an always-on service plan. It consumes GitHub Actions usage and should be reviewed if service plans or operating requirements change.

## Supabase

Monitor:
- database size and connection usage;
- Auth users and email rate limits;
- Storage object count, storage usage and egress;
- API and Postgres errors;
- scheduled cleanup, webhook receipt and reconciliation queues;
- security and performance advisor findings.

The connected project currently reports `ACTIVE_HEALTHY` and runs PostgreSQL 17.12. Keep local tests and hosted data separate.

## Capacity response

When a quota is approaching its limit:
1. Confirm the provider's measured usage and exact reset/billing period.
2. Protect existing users' ability to sign in, view published profiles and access their account data.
3. Apply a narrow, documented limit to new high-cost work such as uploads or registrations if needed.
4. Do not disable payments or remove customer entitlements as a generic capacity response.
5. Recheck health, queues and user journeys before restoring normal intake.

## Backups and recovery

Maintain protected database and Storage backups according to the current provider plan. A backup is not proven until a restore has been rehearsed in an isolated project.

Before a release that changes schema or storage:
- confirm a recent recoverable backup;
- test migrations from a clean local database;
- document forward-fix and rollback compatibility;
- verify Auth, RLS and Storage after restore;
- record restore time and data-loss window.

A formal production database-plus-object restore drill was not evidenced in this audit. Treat that as outstanding work, not as a completed safeguard.

## Related guides

- [Avatar and media cleanup](avatar-cleanup.md)
- [Supabase setup](setup-supabase.md)
- [Render deployment](deploy-render.md)
- [Security audit](security-audit.md)
