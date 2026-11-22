# Owner notification email delivery

The existing private account-notification inbox remains the source of truth. The outbox migration `20261122075500_owner_notification_delivery.sql` queues *new* Owner notices only (older notices are not automatically remailed). Delivery is at-least-once, with claim leases, 5 attempts and exponential retry backoff; duplicate delivery after a crash is possible. The mailer uses the verified TLS Zoho SMTP server `smtppro.zoho.uk:465`. SMTP login and credentials from Supabase Auth are **not** automatically available to Next.js; configuring the Supabase Auth SMTP sender alone does not turn on this worker.

## Required server-only Render settings

**Preferred on Render Free: Zoho Mail HTTPS API** (outbound 443, no SMTP port restrictions):

- `ZOHO_MAIL_REGION`: `uk`, `eu` or `com` — **must match the Zoho Mail data centre shown in the webmail address**. The API hosts are fixed to the region; arbitrary URLs are never accepted.
- `ZOHO_MAIL_ACCOUNT_ID`: the numeric Zoho Mail account ID from the authenticated Get All User Accounts API; this is not the SMTP username or Zoho User ID.
- `ZOHO_OAUTH_CLIENT_ID` and `ZOHO_OAUTH_CLIENT_SECRET`: a confidential client registered in the Zoho Developer/API Console.
- `ZOHO_OAUTH_REFRESH_TOKEN`: an offline refresh token granted by the mailbox owner with the narrow `ZohoMail.messages.CREATE` scope, using the matching region's Zoho OAuth server. Never commit or paste it into the site/chat.
- `SNOOZER_NOTIFICATION_FROM`: the sending mailbox address, e.g. `snoozersupport@snoozer.uk`.

**Alternative on an SMTP-capable paid hosting plan:**

- `ZOHO_SMTP_USER`: your Zoho mailbox login, normally `snoozersupport@snoozer.uk`.
- `ZOHO_SMTP_PASSWORD`: the mailbox-specific Zoho SMTP/app password, kept private in Render.
- `ZOHO_SMTP_OUTBOUND_ENABLED=true`: enable only after confirming that the hosting plan permits outgoing SMTP and connectivity works.
- `SNOOZER_NOTIFICATION_FROM`: `snoozersupport@snoozer.uk`, matching the verified SMTP mailbox.
- `OWNER_EMAIL_DISPATCH_TOKEN`: independent, randomly generated secret with at least 32 characters, never exposed in browser env values or Git.

Never use `NEXT_PUBLIC_` for these keys. The route `POST /api/internal/owner-notices/dispatch` returns 404 without the bearer token. Do not copy the token into GitHub issues, logs or client code. An Owner with AAL2 can also run a small batch from `/owner/system`.

## Hosting limitation and readiness gate

**Render Free blocks outbound SMTP ports 25, 465 and 587.** The server now prefers Zoho's documented HTTPS Mail API (OAuth token refresh plus POST /api/accounts/{accountId}/messages) when its credentials are configured. The Mail API works through standard HTTPS outbound access. SMTP is used only when API credentials are absent and `ZOHO_SMTP_OUTBOUND_ENABLED=true` explicitly allows it on a capable hosting plan. On Render Free keep that flag absent/false. This does not modify Supabase Auth SMTP or private in-app notifications. The Mail API requires additional private Zoho OAuth credentials, separate from your SMTP password.

On `/owner/system`, use **Send test email to my verified Owner address** once the Zoho HTTPS Mail API (or permitted SMTP) is configured. This requires Owner MFA AAL2 and a confirmed Owner email, and sends only to that address. It does not create an account grant or moderation action. Provider acceptance is not proof of inbox delivery.

## Scheduled delivery

Configure a trusted scheduler (e.g. a Render cron job or Supabase pg_cron/net with a Vault-stored secret) to make a POST request every 5 minutes to `https://www.snoozer.uk/api/internal/owner-notices/dispatch` with header `Authorization: Bearer <OWNER_EMAIL_DISPATCH_TOKEN>`. The dispatcher returns only the count of accepted and failed deliveries, never user emails. Do not enable a scheduler before confirming environment credentials and a recipient-controlled test email in staging. If using Supabase pg_cron, use Vault secrets and never embed tokens as literal SQL.

## Verification

1. Enable a staging sender and token. Use a staging-only account and a known Owner action to create a notice.
2. Confirm the notice appears in the account inbox; run the Owner manual dispatch with verified MFA; verify delivery and the outbox row marked `delivered_at`.
3. Simulate a provider 429 or network timeout; confirm attempt count and next-attempt backoff; ensure no infinite resend.
4. Confirm unauthenticated requests to the dispatcher return 404 and ordinary users cannot call the service-role claim/finalize functions.
5. Inspect Zoho sent-mail/delivery status and the controlled recipient inbox: a successful API response or SMTP `250` means accepted, not proof of final recipient delivery.
6. Leave credentials unset or scheduler disabled if real delivery verification cannot be completed. In-app notifications remain available.

Do not send sensitive moderation reasons or audit notes by email; only generic notification titles/bodies are delivered.

## SMTP provider migration

The transport uses Zoho Mail HTTPS API or Zoho SMTP for Owner notices and independently verified external appeals; it does **not** change Supabase Auth SMTP. The API uses fixed regional HTTPS endpoints and narrow OAuth permissions; the optional SMTP connection uses TLS certificate validation on port 465 and fails closed on network or provider errors. Zoho mail credentials are never printed or stored in the repository. New account notices remain in the private inbox if the outbox dispatcher is unconfigured.

## CI baseline verification
The shared legal-disclosure baseline was repaired on main in [PR #55](https://github.com/Truwty/snoozer-uk/pull/55). This branch must pass the full GitHub Actions suite against that corrected base before being merged.

Official API source: https://www.zoho.com/mail/help/api/post-send-an-email.html ; OAuth: https://www.zoho.com/mail/help/api/using-oauth-2.html ; Zoho Mail region info: https://www.zoho.com/mail/help/api/getting-started-with-api.html .
