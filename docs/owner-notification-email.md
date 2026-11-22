# Owner notification email delivery

The existing private account-notification inbox remains the source of truth. The outbox migration `20261122075500_owner_notification_delivery.sql` queues *new* Owner notices only (older notices are not automatically remailed). Delivery is at-least-once, with claim leases, 5 attempts and exponential retry backoff; duplicate delivery after a crash is possible. The mailer uses the verified TLS Zoho SMTP server `smtppro.zoho.uk:465`. SMTP login and credentials from Supabase Auth are **not** automatically available to Next.js; configuring the Supabase Auth SMTP sender alone does not turn on this worker.

## Required server-only Render settings

- `ZOHO_SMTP_USER`: your Zoho mailbox login, normally `snoozersupport@snoozer.uk`.
- `ZOHO_SMTP_PASSWORD`: the mailbox-specific Zoho SMTP/app password. Enter it in Render privately; do **not** paste it into chat, Git or browser code.
- `SNOOZER_NOTIFICATION_FROM`: `snoozersupport@snoozer.uk`, matching the verified SMTP mailbox.
- `OWNER_EMAIL_DISPATCH_TOKEN`: independent, randomly generated secret with at least 32 characters, never exposed in browser env values or Git.

Never use `NEXT_PUBLIC_` for these keys. The route `POST /api/internal/owner-notices/dispatch` returns 404 without the bearer token. Do not copy the token into GitHub issues, logs or client code. An Owner with AAL2 can also run a small batch from `/owner/system`.

## Hosting limitation and readiness gate

**Render Free blocks outbound SMTP ports 25, 465 and 587.** Therefore Snoozer's Next.js app cannot reach Zoho SMTP on this plan, even if Supabase Auth (which sends from Supabase infrastructure) can. The mailer now fails closed unless `ZOHO_SMTP_OUTBOUND_ENABLED=true` is set after upgrading to an SMTP-capable hosting plan and verifying the connection. Keep the flag absent/false on Render Free. This does not change Supabase Auth SMTP or in-app notifications. An HTTPS Zoho Mail API transport would require its own OAuth authorisation; it is not currently implemented.

On `/owner/system`, use **Send test email to my verified Owner address** once outgoing SMTP is permitted. This requires Owner MFA AAL2 and a confirmed Owner email, and sends only to that address. It does not create an account grant or moderation action. SMTP acceptance is not proof of inbox delivery.

## Scheduled delivery

Configure a trusted scheduler (e.g. a Render cron job or Supabase pg_cron/net with a Vault-stored secret) to make a POST request every 5 minutes to `https://www.snoozer.uk/api/internal/owner-notices/dispatch` with header `Authorization: Bearer <OWNER_EMAIL_DISPATCH_TOKEN>`. The dispatcher returns only the count of accepted and failed deliveries, never user emails. Do not enable a scheduler before confirming environment credentials and a recipient-controlled test email in staging. If using Supabase pg_cron, use Vault secrets and never embed tokens as literal SQL.

## Verification

1. Enable a staging sender and token. Use a staging-only account and a known Owner action to create a notice.
2. Confirm the notice appears in the account inbox; run the Owner manual dispatch with verified MFA; verify delivery and the outbox row marked `delivered_at`.
3. Simulate a provider 429 or network timeout; confirm attempt count and next-attempt backoff; ensure no infinite resend.
4. Confirm unauthenticated requests to the dispatcher return 404 and ordinary users cannot call the service-role claim/finalize functions.
5. Inspect Zoho sent-mail/delivery status and the controlled recipient inbox: an SMTP `250` acceptance means queued, not proof of final recipient delivery.
6. Leave credentials unset or scheduler disabled if real delivery verification cannot be completed. In-app notifications remain available.

Do not send sensitive moderation reasons or audit notes by email; only generic notification titles/bodies are delivered.

## SMTP provider migration

This transport uses Zoho SMTP for Owner notices and independently verified external appeals; it does **not** change Supabase Auth SMTP. The SMTP connection uses TLS certificate validation on port 465 and fails closed on network or provider errors. Zoho mail credentials are never printed or stored in the repository. New account notices remain in the private inbox if the outbox dispatcher is unconfigured.

## CI baseline verification
The shared legal-disclosure baseline was repaired on main in [PR #55](https://github.com/Truwty/snoozer-uk/pull/55). This branch must pass the full GitHub Actions suite against that corrected base before being merged.
