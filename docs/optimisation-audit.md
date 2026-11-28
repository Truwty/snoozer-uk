# Snoozer platform optimisation and security review

**Review date:** 27 November 2026  
**Reviewed main commit:** `be0f0798e47d52cdba78f96bcd91af172ffda360`  
**Connected Render service:** `snoozer-uk-staging` (`srv-dbts6jon74is73en2rjg`)  
**Connected Supabase project:** `snoozer-staging` (`edgptbiwswcdmmxzwhxv`)

## Scope and payment boundary

The review covered repository architecture, authentication/session paths, Owner authorization, public API routes, uploads and exports, billing webhooks, database grants/RLS, Storage buckets, external fetches, CI and Render/Supabase configuration. Exact evidence and limitations are recorded in [security-audit.md](security-audit.md).

The operator has confirmed that live payments and subscriptions are working. This review must not disable Checkout, alter the six approved LIVE GBP prices, replace Stripe credentials or webhook configuration, revoke customer records, or change entitlements as part of general optimisation.

## Verified database posture

| Finding | 27 Nov result | Treatment |
| --- | ---: | --- |
| Public SECURITY DEFINER functions | 408 | All 408 set a locked `search_path` |
| Anonymous-executable functions | 16 | Bounded public projections |
| Authenticated-executable functions | 187 | Guarded account/Owner RPC surface |
| SQL `PUBLIC`-executable functions | 0 | No broad function grants observed |
| Public table grants to anon/authenticated | 0 | No direct access observed |
| Private `snoozer` schema USAGE to anon/authenticated | 0 | Schema remains unexposed |
| RLS enabled without policy | 130 | Informational under the current unexposed schema/grants |
| Public Storage buckets | 0 of 10 | All connected buckets private |

The previous audit's counts (116 RLS notices, 177 authenticated functions, 82 unindexed foreign keys) are historical and superseded. Current advisor output reports 83 unindexed foreign keys, one duplicate index, 25 unused indexes and one table without a primary key. Do not remove indexes or rewrite keys without workload and dependency analysis.

## Application controls

The source review found server-side Supabase identity checks, PKCE OAuth, MFA, AAL2 Owner writes, private Storage uploads, bounded request bodies, webhook signature verification, provider read-back and CSP/security headers. See [threat model](threat-model.md) for the boundary-by-boundary controls.

## Open work

1. Supabase leaked-password protection is disabled; enable it if available under the project's plan.
2. GitHub branch protection could not be read by the integration; owner verification is required.
3. Gitleaks previously scanned the checked-out tree only. This branch adds a full-history Git scan.
4. Render dashboard reports an empty health-check path although `render.yaml` sets `/health/live`.
5. Dependency audit had an obsolete picomatch exception; the advisory was withdrawn 18 November 2026 and the policy is being made strict again.
6. No formal external penetration test has been performed.

## Delivery evidence

Latest main CI observed: [Run #1312](https://github.com/Truwty/snoozer-uk/actions/runs/46021425902), passing on 27 November 2026. The security branch requires its own latest-head CI before it is accepted. No merge or Render deploy is part of this audit task.
