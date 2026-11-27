# Architecture decisions

**Reviewed:** 27 November 2026

These decisions apply across the current Snoozer application. New designs should preserve the security boundary and extend existing patterns rather than introduce a second source of truth.

## Application and data

- Use a stateless Next.js App Router application with React and strict TypeScript. The main web service runs on Render's Node runtime.
- Use Supabase Auth, PostgreSQL and Storage through the Data API. SQL migrations own schema, grants, RLS and transactional invariants; do not introduce a second migration history or application-side direct database pool.
- Keep private application tables in the unexposed `snoozer` schema. Use narrowly scoped RPCs and database-enforced ownership; do not add broad policies just to clear RLS advisor notices.
- All `SECURITY DEFINER` functions must use a locked search path and schema-qualified references. Review execution grants for `anon`, `authenticated` and SQL `PUBLIC` whenever a function is created or changed.
- Draft state remains private. Publish immutable snapshots and switch the published revision atomically after checking expected revision under a row lock.
- Centralise plan entitlements and quotas in database-backed policy rather than trusting UI controls or browser-supplied plan values.

## Identity and authorization

- Validate the current identity with Supabase Auth on the server. User IDs, profile IDs and account selector cookies supplied by the browser are not proof of ownership.
- Use verified session/identity helper functions for authenticated database mutations. Owner writes additionally require an active AAL2 session.
- Use server-initiated OAuth with PKCE. Identity linking must bind the callback to the account that started the flow.
- Keep service-role credentials server-only. Never place secrets in `NEXT_PUBLIC_*`, client components, source files or logs.

## Media and external integrations

- Use private Storage buckets and server-generated UUID paths. Signed uploads must not overwrite existing objects.
- Bound uploads and request bodies, validate file signatures, re-encode images and keep a database record of ownership/publication state.
- Public provider widgets may call only fixed, allow-listed provider APIs. Deny redirects, omit visitor credentials/headers, use short timeouts and bounded response bodies.
- Custom domains require a DNS challenge, verified provider association, safe public IPs and a pinned HTTPS challenge request.
- External embeds remain under provider control. Do not simulate player controls or imply provider availability that has not been checked.

## Analytics and privacy

- Use explicit consent for first-party analytics. Do not infer people or fingerprint visitors; do not add third-party analytics trackers without a separate privacy assessment.
- Retain only bounded aggregates and deduplication data. Label UTC periods and methodology accurately; event counts are not unique people.
- Privacy exports must clearly state their scope. A limited self-service archive must not be described as a complete statutory export.

## Billing

- Only Snoozer-owned Plus, Pro and Studio subscriptions are active products. Do not rebuild creator marketplace or Stripe Connect features.
- Verify webhook signatures against the raw bounded body before storing or processing events.
- Use idempotent receipts, provider read-back and reconciliation. Browser success pages do not grant entitlements.
- Keep live payment configuration and existing customer records unchanged in unrelated code/documentation work.

## Delivery and operations

- GitHub Actions CI is the quality gate for pull requests. Pin third-party actions to commit SHAs and grant only the minimum workflow permissions.
- The main Render service deploys from `main`; feature branches should not be deployed to production.
- Use a disposable local Supabase project for migration replay and provider tests. Never run destructive reset commands against hosted projects.
- Record what was tested, on which commit, and whether it was local, CI, hosted or operator-confirmed.
