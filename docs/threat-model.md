# Snoozer security threat model

**Reviewed:** 27 November 2026  
**Scope:** The web application, its Supabase project, media flows, billing integrations, Discord presence worker and GitHub Actions.

## Security objectives

1. A user can read or change only data that belongs to their verified account, except for intentionally public published profile data.
2. Drafts, account data, private media, notification content and Owner operations remain private.
3. Subscription access is granted only from provider-verified billing state and cannot be forged by a browser request or replayed webhook.
4. Public profile features cannot turn arbitrary user input into arbitrary server-side network requests or executable content.
5. A compromised public-facing request must not disclose server credentials or bypass database ownership checks.

## Assets and trust boundaries

| Asset | Trust boundary |
| --- | --- |
| Auth tokens, refresh tokens and MFA state | Browser-to-Supabase Auth; server validates the active identity |
| Drafts, account settings and private records | Next.js server actions to Supabase RPCs and private schema |
| Public profiles | Published snapshot projection; never expose draft tables |
| Media | Signed, non-overwriting upload to private staging; server validates then commits to private final bucket |
| Billing | Stripe signed webhook and provider read-back to server-only reconciliation |
| Owner controls | Verified account plus Owner role; sensitive writes require active AAL2 session |
| Discord presence | Separate worker to signed internal ingest API; minimal opt-in projections |
| Custom domains | Owner DNS challenge, Render association check, public IP and marker verification |

## Main threats and controls

### Authentication and account takeover

Threats include credential stuffing, phishing, stolen refresh tokens, callback confusion and account switching mistakes.

Controls observed in source:
- Supabase server-side session validation via `auth.getUser()`; browser-supplied account-list cookies are selectors, not identity claims.
- HttpOnly, SameSite=Lax cookies; Secure on HTTPS.
- OAuth is initiated server-side with PKCE. Identity-link callbacks verify the account that initiated the link.
- MFA uses TOTP, recovery codes and server-side consumption. Sensitive Owner writes check an active session and AAL2.
- Passwords have an application-level minimum of 12 characters; Supabase leaked-password protection is currently reported disabled (see [security audit](security-audit.md)).

Residual risk: authentication rate limits, leaked-password checks and email-provider quotas also depend on Supabase Auth configuration. Verify these settings in the provider dashboard.

### Broken access control and data exposure

Threats include IDOR, insecure direct object references, privilege escalation and exposure through public RPCs.

Controls observed:
- The application data schema `snoozer` has no USAGE privilege for `anon` or `authenticated`.
- No direct table grants to `anon` or `authenticated` were found in the `public` schema.
- Tables in private schemas use RLS; application operations are mediated by narrowly scoped database functions.
- All 408 `public` SECURITY DEFINER functions have an explicit empty `search_path` configuration. No function was executable by the SQL `PUBLIC` role in the reviewed database snapshot.
- Public RPC execution is restricted to 16 bounded read/availability projections. Authenticated RPCs rely on server-verified identity, session or Owner guard functions; mutating functions were separately screened for direct writes without those guards.

RLS enabled without policies is not itself an exposure when the schema is unexposed and the roles have no table grants. Do not add broad policies merely to clear an informational advisor notice.

### Media and file handling

Threats include malicious file payloads, overwrite attacks, path traversal and private media disclosure.

Controls observed:
- All 10 Storage buckets in the connected project are private.
- Uploads use server-generated owner-scoped paths and signed upload URLs with overwrite disabled.
- Audio/video handlers enforce size, extension and file-signature checks; image paths use image decoding and re-encoding.
- Final media access is resolved through database publication/ownership checks before a server-side download or short-lived signed URL.
- Account media export checks the verified account and exact media scope before downloading.

Residual risk: provider limits, storage quotas, processing resource limits and cleanup jobs need monitoring. A file signature is a format check, not malware scanning.

### Billing and webhook integrity

Threats include forged events, duplicate delivery, out-of-order events, cross-account binding, test/live confusion and entitlement manipulation.

Controls observed:
- Stripe signatures are checked against bounded raw request bodies before processing.
- Live handlers require `livemode`, reject unexpected Connect context, verify the configured Stripe account and read back provider objects.
- Event receipts, idempotency keys, owner/customer/session bindings and reconciliation guard the entitlement lifecycle.
- Refund, dispute and fraud events place risk holds; subscription entitlement state is derived from provider state and paid invoice verification.
- Recovery endpoints require a high-entropy bearer secret and constant-time digest comparison.

Never use general refactoring to change LIVE prices, keys, webhook endpoints or payment gates. The operator's current payment acceptance is recorded separately.

### Public content and external requests

Threats include stored XSS, unsafe links, SSRF and malicious embed content.

Controls observed:
- React renders profile text as text; user HTML, CSS and scripts are not accepted as profile content.
- A nonce-based Content Security Policy restricts scripts and frames; object embedding is disabled and framing is denied.
- External widget fetching is constrained to fixed GitHub/Discord API hosts, with redirects disabled, bounded response bodies and short timeouts.
- Custom-domain verification pins the requested address to a validated public IPv4 address and checks a DNS challenge, provider association and HTTPS marker.
- Normal outbound links are not fetched by the server.

Residual risk: visitors can still navigate to malicious user-supplied external sites, and third-party embeds can disclose visitor network/device information to their provider.

### Automation and supply chain

Threats include secret leakage, dependency compromise, excessive CI token permissions and unsafe untrusted pull-request execution.

Controls observed:
- CI permissions are read-only by default; deployment is not run from feature branches.
- GitHub Actions are pinned to commit SHAs in the current CI workflow.
- Gitleaks scans the checked-out repository tree; this audit adds a full-history Git scan.
- `npm run audit` checks development and production dependency trees.
- CI runs without persistent checkout credentials.

Residual risk: GitHub branch protection could not be independently confirmed through the connected GitHub integration. Review required checks, pull-request review settings and secret-scanning configuration in repository settings.

## Risk register

| Finding | Severity | Current disposition |
| --- | --- | --- |
| Supabase leaked-password protection disabled | Medium | Operator action; enable in Auth settings where supported by the project plan |
| Previous secret scan covered the working tree, not Git history | Medium | Full-history scan added to CI; CI result still required |
| GitHub branch protection status unavailable to this audit | Medium | Owner must verify repository settings |
| Render dashboard health-check path is empty although `render.yaml` specifies `/health/live` | Low | Configuration drift; reconcile in Render dashboard before relying on deployment health gating |
| Development dependency audit included a withdrawn picomatch advisory exception | Low | Advisory withdrawn upstream 18 November 2026; exception is being removed and audit made strict |
| No independent third-party penetration test | Informational | Not performed; automated checks are not a penetration test |

## Review limitations

This is a repository and connected-provider configuration review, not a guarantee that the service is unhackable. The review did not attack production accounts, submit real payment actions, inspect every historical Git object locally, perform a formal manual penetration test or independently verify GitHub branch protection. Open the linked audit report for exact queries, evidence and remaining actions.
