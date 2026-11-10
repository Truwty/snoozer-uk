# Supabase setup

## Disposable development stack

Run `npx --yes supabase@3.1.0 start` from the repository root with Docker running. Set `NEXT_PUBLIC_SUPABASE_URL` to the local Project URL, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to the local publishable or legacy anon key, and `SUPABASE_SERVICE_ROLE_KEY` to the local secret or legacy service-role key. Use the exact browser origin `http://localhost:3000` for `NEXT_PUBLIC_SITE_URL`. The local email catcher runs at port 54324.

For real provider browser tests, export all four values into the shell environment, then set `SNOOZER_TEST_LOCAL_SUPABASE=1`. Run `npm run build` followed by `npm run test:e2e` with port 3000 free. The provider suite refuses URLs other than the local CLI gateway. Use `npx --yes supabase@3.1.0 db reset` only for a disposable local stack.

## Hosted project

1. Select a dedicated Supabase Free project in an appropriate UK/EU region. Verify region, access, and resource budget before applying migrations.
2. Authenticate the CLI locally. Run `npx --yes supabase@3.1.0 link --project-ref YOUR_PROJECT_REF`. Confirm the intended project, review `db push --dry-run`, take a protected backup, then run `npx --yes supabase@3.1.0 db push`. Migrations create private buckets and the required functions.
3. In Auth URL Configuration set the canonical site URL and allowlist the exact `/auth/confirm` and `/reset-password` URLs for the active origin. Set the email provider to require confirmation, minimum password length 12, and configure real SMTP and provider rate limits.
4. Set the confirmation and password recovery subjects and bodies from `supabase/templates`. The templates pass `.TokenHash` to the corresponding Snoozer form. Test both email flows and expiry on staging. Disable SMTP link rewriting for token links.
5. Use the project URL and publishable key at build time and runtime. Set the service credential only in Render or ignored local configuration. Rebuild after rotating a publishable key or changing the URL. Rotate server secrets in the provider dashboard, redeploy, verify readiness and upload, then revoke retired credentials following the provider’s rotation sequence.

The application uses the Data API, so the web service needs no direct database connection string. Keep migration credentials outside the Render runtime. Supabase default hosted SMTP is limited to authorised team addresses and unsuitable for public registration. [Supabase custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
