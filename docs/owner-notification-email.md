# Owner notification email delivery

The existing private account-notification inbox remains the source of truth. The outbox migration `20261122075500_owner_notification_delivery.sql` queues *new* Owner notices only (older notices are not automatically remailed). Delivery is at-least-once, with claim leases, 5 attempts and exponential retry backoff; duplicate delivery after a crash is possible. SMTP login and credentials from Supabase Auth are **not** automatically available to Next.js; configuring the Supabase Auth SMTP sender alone does not turn on this worker.

## Required server-only Render settings

- `BREVO_API_KEY`: Brevo transactional email API key (keep secret).
- `SNOOZER_NOTIFICATION_FROM`: sender address verified in Brevo, e.g. `snoozersupport@snoozer.uk`.
- `OWNER_EMAIL_DISPATCH_TOKEN`: independent, randomly generated secret with at least 32 characters, never exposed in browser env values or Git.

Never use `NEXT_PUBLIC_` for these keys. The route `POST /api/internal/owner-notices/dispatch` returns 404 without the bearer token. Do not copy the token into GitHub issues, logs or client code. An Owner with AAL2 can also run a small batch from `/owner/system`.

## Scheduled delivery

Configure a trusted scheduler (e.g. an existing Render cron job or Supabase pg_cron/net with a Vault-stored secret) to make a POST request every 5 minutes to `https://www.snoozer.uk/api/internal/owner-notices/dispatch` with header `Authorization: Bearer <OWNER_EMAIL_DISPATCH_TOKEN>`. The dispatcher returns only the count of accepted and failed deliveries, never user emails. Do not enable a scheduler before confirming environment credentials and a recipient-controlled test email in staging. If using Supabase pg_cron, use Vault secrets and never embed tokens as literal SQL.

## Verification

1. Enable a staging sender and token. Use a staging-only account and a known Owner action to create a notice.
2. Confirm the notice appears in the account inbox; run the Owner manual dispatch with verified MFA; verify delivery and the outbox row marked `delivered_at`.
3. Simulate a provider 429 or network timeout; confirm attempt count and next-attempt backoff; ensure no infinite resend.
4. Confirm unauthenticated requests to the dispatcher return 404 and ordinary users cannot call the service-role claim/finalize functions.
5. Inspect Brevo transaction status externally: a successful API response indicates acceptance, not proof of final recipient delivery.
6. Leave credentials unset or scheduler disabled if real delivery verification cannot be completed. In-app notifications remain available.

Do not send sensitive moderation reasons or audit notes by email; only generic notification titles/bodies are delivered.
