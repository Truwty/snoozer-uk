# Feature #20 — Restricted GDPR erasure executor (operator acceptance)

## Scope

This is a **real, narrow erasure workflow**, not a general automatic GDPR guarantee. Only an Owner with a verified AAL2 session can run it, and only for a user with an open/review deletion request whose identity, Stripe billing, processors, retention and subscriptions have been documented in the Owner evidence table. No customer account is deleted during deployment.

The executor is **disabled by default**. The Render server-only switch `SNOOZER_ENABLE_SAFE_PRIVACY_ERASURE=true` exposes the irreversible action on Owner → Privacy for an eligible deletion request. It requires the Owner to type `ERASE <request UUID>`. Leave disabled until a disposable live acceptance cycle and legal review pass.

The preparation function refuses: Owner accounts, an unverified recipient, Stripe customer/checkout references, creator products or memberships, private avatar/gallery/storage-owner records, and any NO ACTION or RESTRICT FK into the target Auth identity. Other data relationships can still cause Auth's atomic deletion to fail; the application then records a failed job instead of falsely marking a request complete. Supabase Storage objects must be erased separately through the Storage API, never by directly deleting Storage metadata. Objects uploaded by a service key may not have an owner ID, so all historical media must be separately inventoried. Transactions, legal retention, disputes, subscriptions, Stripe processor exports and support/Zoho records are **not automatically deleted**.

## Audit and completion

1. The Owner reviews the request, exports, identity and legal holds; records the requested evidence without claiming erasure was done.
2. Owner AAL2 prepares a `privacy_erasure_jobs` record and immutable audit trail. The privileged server reads the exact subject from the database, not the form.
3. Supabase `auth.admin.deleteUser(subject)` performs the Auth/DB cascade. If it fails, the failure is recorded; the account remains in place.
4. The service-role completion function verifies that the Auth row and all direct owned app rows are gone; only then does it mark local app/media/erasure evidence true.
5. Zoho sends a completion email to the verified email captured before deletion. A failed email must not turn a successful erasure into a claimed completion. An Owner must follow up if it failed.
6. The Owner must still independently verify retention/processor obligations and complete the privacy request through the existing evidence-based Owner MFA review. **No checkbox can bypass the database evidence gates**.

Audit event actors are set to NULL automatically when their non-Owner Auth identity is deleted, preserving minimised historical action records without retaining an Auth FK. The verified Owner actor and privacy request ID remain.

## Acceptance and production restrictions

- On disposable local Supabase, prove normal users and anonymous users cannot invoke erasure, AAL1 is denied, AAL2 can prepare only verified deletion requests with complete prerequisites, active restrictions block deletion, and a no-data disposable Auth user is deleted and produces accurate audit/evidence.
- Verify local and CI build/lint/test/E2E pass before merge.
- Apply migration `20261122222400_owner_safe_privacy_erasure.sql` only after CI; confirm anon/service/Owner RPC privileges.
- Deploy Render, leave the erasure flag OFF until a real controlled disposable end-to-end run.
- Independently sign off on a full export, actual Storage removal, Stripe subscription and invoice retention, paid commerce, OAuth and external processors before claiming general GDPR fulfilment.
- Never run this executor on a paid customer, an Owner, a user with private Storage, or a user with a legal hold.

## Remaining separate #20 acceptance

- Provider-level ban/unban must produce **two succeeded rows** in `snoozer.provider_ban_operations` for a disposable account and successful post-unban login. Mere button clicks do not satisfy this check.
- Real Owner AAL2 browser acceptance, initial Discord/email registration on/off, alert restoration, live billing regression and Supabase Auth leaked-password protection require independent evidence.
