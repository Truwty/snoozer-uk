# Snoozer security audit

**Review date:** 27 November 2026  
**Repository:** `Truwty/snoozer-uk`  
**Reviewed main commit:** `be0f0798e47d52cdba78f96bcd91af172ffda360`  
**Security branch:** `security/comprehensive-audit-2026-11-27`  
**Connected Supabase project:** `snoozer-staging` (`edgptbiwswcdmmxzwhxv`)  
**Scope:** repository source, SQL migrations, tests, GitHub Actions, Render service configuration and connected Supabase security/performance advisors.

## Executive result

The review did not identify a confirmed unauthenticated path to private account tables, drafts, private media or Owner operations in the checks described below. The database has useful defence-in-depth: no direct public-role grants to application tables, private Storage buckets, scoped RPCs, server-side identity checks, and hardened SECURITY DEFINER search paths.

This is **not** a claim that Snoozer is unhackable or that every conceivable exploit has been ruled out. The immediate configuration item is Supabase leaked-password protection, which is disabled. GitHub branch protection could not be inspected through the connected integration. The security branch's full-history secret scan and strict dependency audit passed on commit `5f9f261dafdc1221bc11e6f17499c551eedbc516` in [CI run #1317](https://github.com/Truwty/snoozer-uk/actions/runs/46035177139). A subsequent documentation-only correction is being checked separately.

## Repository and application surface

The main branch contained 702 tracked files in the reviewed tree, including 365 source files, 178 Supabase files (172 migrations), 53 test files, 17 E2E files, 10 scripts, 48 documents and GitHub workflow/configuration files.

Review covered:
- Supabase Auth, saved-account cookies, OAuth/PKCE callback, MFA and recovery flows.
- Owner authorization and privileged database functions.
- Public profile reads, public widgets, guestbook/polls and external provider requests.
- Gallery, avatar, audio and background-video upload, serving and export.
- Stripe LIVE webhook, subscription reconciliation and recovery routes; Ko-fi webhook.
- Discord presence HMAC ingest, worker-facing API and public projection.
- Custom-domain DNS/provider/HTTPS verification.
- CSP, proxy routing, CI workflows, npm dependency policy and environment configuration.

This was a source and configuration review. It did not include destructive testing or a formal third-party penetration test against production.

## Database evidence

The connected Supabase project was `ACTIVE_HEALTHY`, PostgreSQL 17.12, in `eu-west-1`.

| Check | Observed result | Assessment |
| --- | ---: | --- |
| Public-schema SECURITY DEFINER functions | 408 | Inventory reviewed through database catalog queries |
| SECURITY DEFINER functions with explicit locked `search_path` setting | 408 / 408 | **PASS** |
| Executable by SQL `PUBLIC` role | 0 | **PASS** |
| Executable by `anon` | 16 | Public read/availability endpoints; retain only as intentional projections |
| Executable by `authenticated` | 187 | Application RPC surface; mutation helpers screened |
| Direct table grants to `anon` or `authenticated` on public tables | 0 | **PASS** |
| `USAGE` on private `snoozer` schema for `anon` / `authenticated` | false / false | **PASS** |
| Storage buckets public | 0 / 10 | **PASS** |
| RLS-enabled tables without policies | 130 (128 `snoozer`, 2 `public`) | Informational; direct grants and callable functions reviewed separately |

The function catalog query found **zero** public SECURITY DEFINER functions without an explicit `search_path` setting. Function definitions use a locked empty search path and schema-qualified objects. The 16 anonymous-callable functions return published profile projections, public metadata, availability, leaderboard or similar deliberately public information. The authenticated surface includes Owner and account operations; the SQL review found that authenticated functions performing direct table mutations referenced the project's verified identity, privacy-actor or Owner-actor guard helpers.

The 128 RLS-without-policy notices in schema `snoozer` are not equivalent to exposed tables: `anon` and `authenticated` have no USAGE on that schema. The other two notices are the public Status bug-report tables `public.status_bug_reports` and `public.status_bug_report_rate_limits`. Both have RLS enabled and **neither `anon` nor `authenticated` has SELECT, INSERT, UPDATE or DELETE grants** on either table. Those tables are accessible to the server's `service_role` only.

The associated `public.submit_status_bug_report` RPC is **invoker-security**, not SECURITY DEFINER; it has `search_path = ''`, and execute is granted only to `service_role`. Its source validates and bounds input, applies a per-fingerprint three-per-hour rate limit, and inserts the report. This was checked against the live catalog and the migration. These two advisor notices therefore do not indicate direct public table access. Do not add blanket policies or grants merely to silence the notices.

### Storage

All 10 buckets in the connected project are private. Upload handlers use signed, non-overwriting staging paths and enforce application-level bounds and file-type checks before commit. Private downloads are resolved through owner/publication RPCs.

A private `product-files` bucket remains from the retired creator marketplace. It is not public. It was not deleted in this audit because bucket contents and retention obligations must be checked before removing storage.

### Advisor findings

Security advisor:
- One warning: leaked-password protection disabled.
- Sixteen anonymous-executable SECURITY DEFINER findings and 187 authenticated-executable findings. These were triaged against grants, schema exposure, function settings and source bodies; the counts alone are not vulnerabilities.
- 130 RLS-enabled/no-policy informational notices: 128 private-schema application tables and two public Status bug-report tables with no direct grants to `anon` or `authenticated`, as detailed above.

Performance advisor:
- 83 foreign keys reported without covering indexes.
- One duplicate-index warning.
- 25 unused-index notices.
- One table without a primary key (`snoozer.published_profiles`).

These are performance/maintenance candidates, not reasons to add permissions or remove indexes blindly. Use workload, query plans, write cost and foreign-key usage before changing them.

## Application controls verified in source

| Surface | Controls observed |
| --- | --- |
| Session identity | Supabase `auth.getUser()` server-side checks; HttpOnly, SameSite=Lax cookies; account-selection cookies are not treated as authentication |
| OAuth | Server-initiated PKCE; identity-link callback checks initiating account identity |
| MFA / Owner | TOTP and hashed recovery codes; database Owner writes require active session and AAL2 |
| Public data | Published snapshot projections; draft/private schemas are not read directly by visitors |
| User uploads | UUID-scoped paths, signed non-overwriting uploads, bounded size, content-signature validation and private Storage |
| External fetches | Fixed GitHub/Discord hosts, redirects denied, credentials omitted, 5-second timeout and 100 KB response cap |
| Custom domains | DNS challenge, Render association check, public IPv4 validation, pinned HTTPS marker request |
| Stripe | Raw-body signature verification, request-size cap, live-mode/account checks, provider read-back, receipt replay protection and reconciliation |
| Discord ingest | HMAC SHA-256, timestamp freshness window, strict schema, body-size limit and service-side writes |
| HTTP policy | Nonce-based CSP, `object-src 'none'`, `frame-ancestors 'none'`, HSTS, nosniff, no-referrer and restrictive Permissions-Policy |

## Findings and required actions

| ID | Severity | Finding | Required action |
| --- | --- | --- | --- |
| SA-01 | Medium | Supabase leaked-password protection is disabled | Enable it in Supabase Auth settings if available on the project's plan. Supabase documents this feature as Pro plan and above; confirm plan eligibility before treating it as a code defect. |
| SA-02 | Medium | GitHub branch protection could not be read by the connected integration | Owner should verify required CI checks, review requirements, force-push restrictions and deletion restrictions in repository settings. The API returned 403 for branch protection; this audit cannot infer that protection is enabled. |
| SA-03 | Resolved in this branch | Previous Gitleaks workflow scanned the working tree, not commit history | CI now fetches full history and runs Gitleaks in Git mode. Run #1317 passed on commit `5f9f261dafdc1221bc11e6f17499c551eedbc516`; the six known exact fingerprints are individually documented. |
| SA-04 | Low | Render configuration drift | The Render service currently reports an empty health-check path, while `render.yaml` specifies `/health/live`. Reconcile the dashboard configuration. |
| SA-05 | Resolved in this branch | Dependency audit code still carried a time-boxed exception for GHSA-fc5q-39xc-vjpf | GitHub withdrew the advisory on 18 November 2026. This branch removes the exception and makes any audit finding fail; strict full and production dependency audits passed in run #1317. |
| SA-06 | Informational | No independent production penetration test | Not performed. Consider a scoped independent test before materially increasing account volume or data sensitivity. |
| SA-07 | Informational | Six known Gitleaks history matches | Three deterministic Discord test IDs, one fake repeated-character Render key and two hits for one historical Supabase Auth user UUID were reviewed. The UUID is not an authentication secret but is a public account-correlation exposure; see the residual action below. |

## Full-history secret scan

The full-history Gitleaks run scanned 2,266 commits and reported six matches. Each match was reviewed against its source and history:

| Count | Location/type | Assessment |
| ---: | --- | --- |
| 3 | Synthetic Discord snowflake literals in test fixtures | False positives; fixed test identifiers, not bot tokens, application secrets or user credentials |
| 1 | Repeated-character fake Render key in a domain-verification test | False positive; `"x".repeat(32)` is a deliberately invalid test value |
| 2 | Same Supabase Auth user UUID in two INSERT statements in the retired Owner seed migration | Not a credential, password or session token. It is a public account identifier that maps to the current Owner account and can be used for account correlation. Treat as a privacy exposure, not as an authentication bypass. |

The repository-level `.gitleaksignore` contains only the six exact fingerprints above, with comments. It does not suppress any rule globally or any other path/line. The retired migration file is no longer in the current source tree, but its contents remain in public Git history.

**Residual privacy action:** no Git history rewrite was performed. Removing the historical identifier from every commit would require a coordinated history rewrite, force-update of repository refs and consideration of GitHub's cached objects/forks/clones. Do not claim the identifier has been erased. A history rewrite is an owner-approved, disruptive operation and is not required to rotate a provider credential because the value is not an authentication secret.

## Current CI and deployment evidence

- Latest observed main-branch CI: [Run #1312](https://github.com/Truwty/snoozer-uk/actions/runs/46021425902), completed successfully on 27 November 2026.
- Security branch CI: [Run #1317](https://github.com/Truwty/snoozer-uk/actions/runs/46035177139), completed successfully against commit `5f9f261dafdc1221bc11e6f17499c551eedbc516`. It passed full-history Gitleaks, strict npm audit, lint, TypeScript, unit/database tests, production build and all five Playwright shards.
- The Render web service is `snoozer-uk-staging`, on `main`, Free Frankfurt Node service. Render currently reports auto-deploy enabled for commits.
- The live Render service dashboard reports no configured HTTP health-check path, despite the repository Blueprint containing `/health/live`.
- The repository's `/rulesets` API returned an empty array. Branch-protection inspection returned 403, so required review/check settings remain unverified.
- This security branch has not been merged and no Render deployment has been triggered by this work.
- No Supabase schema, grants, policies, Auth settings or project settings were changed during this review.
- Live Stripe prices, credentials, webhook configuration, payment gates and customer entitlements were not changed.

## Acceptance criteria for closing this audit

- [ ] Enable Supabase leaked-password protection (or record the plan limitation and mitigation).
- [ ] Verify GitHub branch protection and required status checks in repository settings.
- [x] Full-history Gitleaks scan passes with the six reviewed exact fingerprints ignored; investigate any additional finding as a possible secret exposure.
- [x] Strict npm audit passes for both full and production dependency trees.
- [x] All CI jobs passed on security branch commit `5f9f261dafdc1221bc11e6f17499c551eedbc516` in run #1317; revalidate after subsequent changes.
- [ ] Render dashboard health check is reconciled with `/health/live`.
- [x] Re-run Supabase security and performance advisors; latest results recorded in this document.
- [ ] Complete a scoped manual penetration test before treating the project as independently security-assessed.

## References

- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase password security and leaked-password protection](https://supabase.com/docs/guides/auth/password-security)
- [GitHub Advisory GHSA-fc5q-39xc-vjpf — withdrawn 18 November 2026](https://github.com/advisories/GHSA-fc5q-39xc-vjpf)
- [Gitleaks Git scan](https://github.com/gitleaks/gitleaks)
- [Render web-service health checks](https://render.com/docs/health-checks)
