# Owner notification email delivery

**Reviewed:** 27 November 2026. The account inbox is the durable user-facing record; email dispatch remains an optional, separately configured delivery channel.

The existing private account-notification inbox remains the source of truth. The outbox migration `20261122082150_owner_notification_delivery.sql` queues *new* Owner notices only (older notices are not automatically remailed). Delivery is at-least-once, with claim leases, 5 attempts and exponential retry backoff; duplicate delivery after a crash is possible. The mailer uses the verified TLS Zoho SMTP server `smtppro.zoho.uk:465`. SMTP login and credentials from Supabase Auth are **not** automatically available to Next.js; configuring the Supabase Auth SMTP sender alone does not turn on this worker.

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

The 22 November manual scheduler smoke exposed an HTTP 307 on the public custom domain. The workflow therefore calls the **fixed, verified Render service hostname** `https://snoozer-uk-staging.onrender.com/api/internal/owner-notices/dispatch` directly (the app explicitly allows `/api/` at that host). The bearer token must not follow redirects.\n\nA five-minute, non-overlapping GitHub Actions dispatcher is provided at `.github/workflows/owner-notice-dispatch.yml`. It is **disabled until explicitly enabled**. To activate, set GitHub Actions repository secret `OWNER_EMAIL_DISPATCH_TOKEN` to the **exact same value** as the server-only Render environment variable, then set GitHub Actions repository variable `OWNER_EMAIL_SCHEDULE_ENABLED=true`. Do not substitute an OAuth/Zoho token or create a different dispatch token: the app endpoint will reject it. Configure at GitHub repo Settings → Secrets and variables → Actions, and only enable after a real test message reaches a controlled inbox. The job checks the API's status and delivery failure count, and creates/closes a GitHub issue for actionable failures; it does not log recipient addresses or credentials. GitHub Actions scheduled tasks may be delayed and are not a hard real-time delivery SLA. Use workflow_dispatch to smoke-test after enabling. Avoid additional concurrent cron workers because the queue already uses leases, but send operations are at-least-once, not exactly-once.

Alternative: run an independently authenticated Render cron or Supabase pg_cron/net job with the same endpoint and token stored securely (e.g. Supabase Vault); never put the token in plain SQL or source control.

## Queue-health monitoring (optional after migration + deploy)

The service-only RPC `service_owner_notice_queue_health()` returns aggregate **total, undelivered, leased, overdue and exhausted** counts without addresses or message content. An authenticated internal GET at `/api/internal/owner-notices/health` uses the same long `OWNER_EMAIL_DISPATCH_TOKEN` as the dispatcher; unknown or unauthorised requests return HTTP 404. The GitHub Actions dispatch workflow can alert and open an incident issue if any jobs are `exhausted` (all five attempts used) or `overdue` (eligible for >30 minutes without a current claim). A zero-sent batch alone cannot prove backlog health.

**Activation sequence:** first apply migration `20261122202438_owner_notice_queue_health.sql` and deploy the route to Render; verify the protected endpoint and existing dispatch run. Only then set GitHub Actions repository variable `OWNER_EMAIL_QUEUE_HEALTH_ENABLED=true`. Leave this variable absent/false during rollout to avoid false outage incidents. Reuse the existing dispatch secret; do not create another token. Queue status counts can reveal operational conditions, so never serve them publicly.

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

Official API source: https://www.zoho.com/mail/help/api/post-send-an-email.html ; OAuth: https://www.zoho.com/mail/help/api/using-oauth-2.html ; Zoho Mail region info: https://www.zoho.com/mail/help/api/getting-started-with-api.html .
