# Independent appeals and Auth-provider bans

The independent `/appeal/external` route is available to **signed-out users**, including those blocked from Supabase Auth. The requester enters a moderation case UUID and the email previously verified on that account. A service-only RPC validates both without account enumeration; a 256-bit random single-use verification link is sent via Zoho SMTP and expires after 15 minutes. A successful redeem creates an ordinary moderation appeal, subject to the same maximum of two appeals per day and pending-appeal restrictions. Raw tokens are never stored in the database (only SHA-256 hashes).

### Required before enabling provider-level bans

1. Verify `ZOHO_SMTP_USER`, `ZOHO_SMTP_PASSWORD` and `SNOOZER_NOTIFICATION_FROM` in Render, and enable `ZOHO_SMTP_OUTBOUND_ENABLED=true` only after moving to an SMTP-capable plan (same Zoho sender as account notices). A Supabase Auth SMTP sender does **not** supply these settings automatically.
2. With a disposable non-Owner staging account and an eligible moderation case, exercise the external appeal flow end-to-end. Confirm the email is accepted and arrives; consume link once; verify replay is rejected, the moderation queue receives the appeal and no account session is required.
3. Check the internal account ban and Owner AAL2 checks with the staging account. **Never test ban/unban using the actual protected Owner identity.**
4. Only after the above, set server-only `SNOOZER_ENABLE_AUTH_BANS=true` on Render. Default absent/false deliberately disables provider bans and preserves existing in-app moderation. This flag is not part of any `NEXT_PUBLIC_` configuration.
5. In `/owner/users/[id]`, first create an actioned moderation case and apply an internal indefinite ban; then provide the case UUID, ban duration in hours and a reason to ban in Supabase Auth. The action requires AAL2, records an intent, calls the provider Admin API server-side, records the result and attempts to revoke existing sessions. This intentionally fails closed for protected Owners or missing cases.
6. Before provider unbanning, lift the internal restriction. Run the MFA-protected provider unban action (`ban_duration: "none"`). Review audit records after every operation. If a provider mutation succeeded but audit completion failed, the page reports reconciliation required; resolve it manually before retrying.

**Important:** Provider bans do not revoke already-issued JWTs by themselves. The app's verified-session database checks and internal restrictions are still mandatory. External appeal email depends on verified Zoho SMTP sender health; if email is down, the user can contact snoozersupport@snoozer.uk for manual review. Never send case reasons in the verification email; don't log raw one-use tokens, email API keys or appeal text. Project-specific deletion and Stripe retention are not changed.

Supabase Auth reference: https://github.com/supabase/auth-js/blob/master/src/lib/types.ts (ban_duration including `none`).

## CI baseline verification
The shared legal-disclosure baseline was repaired on main in [PR #55](https://github.com/Truwty/snoozer-uk/pull/55). This branch must pass the full GitHub Actions suite against that corrected base before being merged.
