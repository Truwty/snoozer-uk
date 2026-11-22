# Supabase Auth signup hook rollout

The email registration setting already blocks email/password signup in the app, but it cannot alone prevent newly created Discord OAuth users. The new optional **Before User Created** Auth hook enforces the same Owner-controlled flag in the Auth provider **before creating a user**.

1. Apply `20261122073000_owner_signup_hook.sql` to the intended Supabase project and check that `public.snoozer_before_user_created(jsonb)` exists and only `supabase_auth_admin` has execute permission.
2. Open Supabase Dashboard → Authentication → Hooks → Before User Created. Select PostgreSQL function `public.snoozer_before_user_created`, enable and save. This Auth configuration step is required because applying SQL alone does **not** activate the hook.
3. With registrations enabled, test both email/password signup and a new Discord identity in staging. With registrations disabled, confirm new registrations by either method fail *before* the Auth account appears; existing email and Discord sign-ins must still succeed. Restore enabled and retest.
4. Use `/owner/settings` to operate the setting with AAL2 MFA, a reason and an audit entry. The disabled state rejects *all* new Supabase Auth users, not only Discord. Do not enable this hook in a different Supabase project without reproducing these checks.

Do not rely on the app callback alone for signup enforcement. On self-hosted Supabase, set the corresponding GoTrue auth hook config explicitly. Ensure `supabase_auth_admin` can execute the hook but never grant execution to `anon` or `authenticated`.

Source: https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook
