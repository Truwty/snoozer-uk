# Snoozer engineering hand-off

**Last updated:** 27 November 2026

Read [PROGRESS.md](PROGRESS.md) for the current release state and [the documentation index](README.md) for maintained guides.

## Active branch

`security/comprehensive-audit-2026-11-27`, based on `main` at `be0f0798e47d52cdba78f96bcd91af172ffda360`.

## Work in this branch

- Full repository and Supabase security review.
- Refresh the README, contribution/security policy and operational documentation.
- Remove obsolete design/implementation trackers and the old private-repository guide.
- Change Gitleaks CI from a working-tree-only scan to a full Git-history scan.
- Remove the withdrawn picomatch advisory exception and require zero current npm audit findings.
- Add a dated audit report with evidence, limitations and operator actions.

## Release boundary

Do not merge this branch to `main`, change the Render service's branch, or trigger a Render deployment without an explicit owner instruction. The main Render service follows `main` with automatic deployment enabled; a future main-branch commit can therefore deploy automatically.

The operator has confirmed live payments and subscriptions work. Preserve all LIVE Stripe settings and entitlements unless the owner gives a specific billing instruction.

## Before closing the work

1. Open or update the PR from this branch.
2. Wait for the full latest-head CI result, including the new Git-history scan and all browser shards.
3. Resolve any secret scan, dependency, lint, type, database, build or browser failures.
4. Verify the GitHub branch protection configuration in repository settings.
5. Ask the owner to handle Supabase leaked-password protection and Render health-check drift.
6. Report the exact PR/CI state and remaining actions. Do not merge or deploy on the owner's behalf.
