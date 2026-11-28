## Change

Describe what changed and why.

## Verification

- [ ] Latest-head CI passes (secret scan, dependency audit, lint, typecheck, unit/database tests, build and browser shards).
- [ ] Regression tests cover the changed behaviour and relevant denial/abuse cases.
- [ ] Documentation and environment-variable references are current.
- [ ] No production credentials, customer data or private user content are included.

## Database, security and rollback impact

- [ ] New schema/policy changes use a new migration; applied migrations are not rewritten.
- [ ] RLS, grants, SECURITY DEFINER search_path and function execute privileges have been reviewed.
- [ ] Authentication, ownership and AAL2 checks are enforced server-side and in the database where required.
- [ ] Storage, upload limits, path ownership and privacy impact are reviewed.
- [ ] Webhooks preserve signature verification, idempotency and reconciliation.
- [ ] Rollback/forward-fix compatibility is documented.

## Release boundary

- [ ] This PR does not change LIVE payment configuration, customer entitlements or credentials unless explicitly approved.
- [ ] Main-branch merge and Render deployment remain owner-controlled.
