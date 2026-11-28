# Supabase setup and operations

**Reviewed:** 27 November 2026  
**Connected project:** `snoozer-staging` (`edgptbiwswcdmmxzwhxv`), region `eu-west-1`.

## Disposable local stack

Use Node.js 24 and the repository-pinned Supabase CLI version:

```bash
npm ci
npx --yes supabase@3.1.0 start
cp .env.example .env.local
npx --yes supabase@3.1.0 status
```

Set these values in the ignored `.env.local` file:

- `NEXT_PUBLIC_SITE_URL=http://localhost:3000`
- `NEXT_PUBLIC_SUPABASE_URL` to the local API URL
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to the local publishable key (or legacy anon key emitted by the CLI)
- `SUPABASE_SERVICE_ROLE_KEY` to the local secret/service-role key

The local email catcher is normally available at port 54324. Keep service-role credentials server-side. Never put them in a client component, browser bundle, public variable or committed file.

For provider-backed browser tests, export the four values into the process environment and set `SNOOZER_TEST_LOCAL_SUPABASE=1`. The E2E safety guard accepts only a local CLI gateway. Use `npx --yes supabase@3.1.0 db reset` only for this disposable local stack.

## Hosted migration procedure

Hosted database changes are release operations:

1. Confirm the project reference and region in the Supabase Dashboard.
2. Confirm a protected backup exists and is recoverable.
3. Authenticate the Supabase CLI in the operator environment.
4. Link to the exact intended project:
   ```bash
   npx --yes supabase@3.1.0 link --project-ref YOUR_PROJECT_REF
   ```
5. Review pending changes:
   ```bash
   npx --yes supabase@3.1.0 db push --dry-run
   ```
6. Review migration order, table grants, RLS, function execution grants, `SECURITY DEFINER` and Storage policies. Only then apply the reviewed migrations:
   ```bash
   npx --yes supabase@3.1.0 db push
   ```
7. Verify the remote migration registry, relevant schema, grants, RLS, bucket privacy and feature journeys.

Never run `db reset` against a hosted project. Do not edit applied migration files; create a new migration for every schema/policy change.

## Auth configuration

In Authentication settings:

- Set the canonical Site URL to `https://snoozer.uk`.
- Add only exact, required redirect URLs for `/auth/callback`, `/auth/confirm` and `/reset-password`, plus explicitly trusted staging/local origins when testing.
- Require email confirmation and retain Secure Email Change.
- Set the minimum password length to at least 12 characters to match the application checks.
- Configure production SMTP, delivery diagnostics and provider rate limits. Default hosted SMTP is not suitable for public registration.
- Enable leaked-password protection where the account plan supports it. The connected security advisor currently reports it disabled. Supabase documents this feature as available on Pro plan and above; see [password security](https://supabase.com/docs/guides/auth/password-security).

The application uses TOTP MFA and recovery codes. Sensitive Owner database writes require AAL2 and a currently valid Auth session. Test enrollment, challenge, recovery-code consumption, session revocation and factor removal against disposable accounts before changing Auth settings.

## OAuth providers

Discord and Google credentials belong in Supabase Auth provider configuration, not source code or browser variables. Use the exact Supabase callback shown by the provider configuration. The app callback is `https://snoozer.uk/auth/callback`; add the trusted host to Supabase's redirect allow-list.

Discord sign-in uses `identify email`. Discord Presence identity linking is a separate authenticated `linkIdentity` flow and uses `identify`. Keep “Allow users without an email” disabled because Snoozer requires a confirmed email. Verify linking/unlinking with an existing account; never merge identities based only on an unverified email.

Google login and Google identity linking are separate flows. The link callback must return to the same initiating Snoozer user. Do not add automatic account-merging logic.

## Email templates

Use the templates under `supabase/templates`. Confirmation and recovery templates pass `.TokenHash` to the matching Snoozer route. Test expiry and single-use behaviour in staging. Disable email-link rewriting for Auth token links if it changes the token URL.

## Runtime credentials

The web service uses the Supabase Data API; it does not need a direct PostgreSQL connection string. Keep migration credentials outside the Render runtime.

- Publishable key and project URL may be public.
- Service-role key is server-only and bypasses RLS; restrict it to the intended server operations.
- Stripe, Ko-fi, Discord and Render credentials must be stored as server environment secrets.
- Rotate a credential in the provider first, update the runtime secret, redeploy, verify the new integration and revoke the retired credential.

See [security audit](security-audit.md) for current database grants and advisor results.
