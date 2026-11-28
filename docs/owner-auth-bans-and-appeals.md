# Independent appeals and Supabase Auth provider bans

**Reviewed:** 27 November 2026

The independent `/appeal/external` route is available to signed-out users, including those blocked from Supabase Auth. The requester enters a moderation case UUID and the email previously verified on that account. A service-only RPC validates both without account enumeration; a 256-bit random single-use verification link is sent via Zoho Mail and expires after 15 minutes. A successful redeem creates an ordinary moderation appeal, subject to the maximum of two appeals per day and pending-appeal restrictions. Raw tokens are never stored in the database; only SHA-256 hashes are persisted.

## Provider-ban feature gate

The provider-ban code requires all three conditions: `SNOOZER_ENABLE_AUTH_BANS=true`, the server-side Supabase service-role key and a healthy Zoho Mail readiness check. The source defaults to disabled when any prerequisite is absent. The actual Render environment flag is not independently visible through the connected audit tools, so this document does not claim that provider-wide bans are enabled in production.

Before enabling provider-level bans:
1. Configure Zoho Mail HTTPS API OAuth credentials in Render (recommended on Render Free): `ZOHO_MAIL_REGION`, `ZOHO_MAIL_ACCOUNT_ID`, `ZOHO_OAUTH_CLIENT_ID`, `ZOHO_OAUTH_CLIENT_SECRET`, `ZOHO_OAUTH_REFRESH_TOKEN` and `SNOOZER_NOTIFICATION_FROM`. Alternatively use SMTP only on an SMTP-capable hosting plan with `ZOHO_SMTP_USER`, `ZOHO_SMTP_PASSWORD` and `ZOHO_SMTP_OUTBOUND_ENABLED=true`. A Supabase Auth SMTP sender does not supply these settings automatically.
2. With a disposable non-Owner staging account and an eligible moderation case, exercise the external appeal flow end-to-end. Confirm the email is accepted and arrives; consume the link once; verify replay is rejected, the moderation queue receives the appeal and no account session is required.
3. Check internal account-ban and Owner AAL2 checks with the staging account. Never test ban/unban using the protected Owner identity.
4. Only after the above, set server-only `SNOOZER_ENABLE_AUTH_BANS=true` on Render. Default absent/false deliberately disables provider bans and preserves existing in-app moderation.
5. In `/owner/users/[id]`, first create an actioned moderation case and apply an internal indefinite ban; then provide the case UUID, ban duration in hours and a reason to ban in Supabase Auth. The action requires AAL2, records an intent, calls the provider Admin API server-side, records the result and attempts to revoke existing sessions. This intentionally fails closed for protected Owners or missing cases.
6. Before provider unbanning, lift the internal restriction. Run the MFA-protected provider unban action (`ban_duration: "none"`). Review audit records after every operation. If a provider mutation succeeded but audit completion failed, the page reports reconciliation required; resolve it before retrying.

**Important:** Provider bans do not revoke already-issued JWTs by themselves. The app's verified-session database checks and internal restrictions remain mandatory. External appeal email depends on Zoho Mail sender health; if email is unavailable, users can contact `snoozersupport@snoozer.uk` for manual review. Never send case reasons in the verification email; do not log raw one-use tokens, email API keys or appeal text. Stripe retention is independent.

Supabase Auth reference: [Auth admin types](https://github.com/supabase/auth-js/blob/master/src/lib/types.ts), including `ban_duration: "none"`.
