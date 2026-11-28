# Google sign-in and account linking

**Reviewed:** 27 November 2026. OAuth secrets belong in Supabase Auth provider configuration, not in application source or client-side variables.

Snoozer now offers Google alongside email/password and Discord sign-in. Account Settings can link Google to the currently signed-in Snoozer account without creating a second profile.

## Configure the Google provider

1. In Google Cloud Console create an OAuth 2.0 Client ID of type **Web application**.
2. Add the canonical Snoozer origin, `https://snoozer.uk`, under **Authorised JavaScript origins**.
3. Add the Supabase Auth callback shown in the project's Google provider settings under **Authorised redirect URIs**. For the current staging project this is `https://edgptbiwswcdmmxzwhxv.supabase.co/auth/v1/callback`. Use the exact callback shown by the target project if it changes.
4. In Supabase Dashboard → Authentication → Sign In / Providers → Google, enable Google and enter the OAuth client ID and client secret. Never place the Google client secret in the repository, Render environment variables, browser code or a `NEXT_PUBLIC_*` setting.
5. In Supabase Dashboard → Authentication → Sign In / Providers (or Authentication → Settings, depending on the Dashboard layout), enable **Allow manual linking**. Supabase documents manual identity linking as a beta feature and it is disabled by default. The app calls `auth.linkIdentity({ provider: "google" })`.
6. In Authentication → URL Configuration set the canonical Site URL to `https://snoozer.uk` and allow `https://snoozer.uk/auth/callback`. Retain `https://snoozer.uk/auth/confirm` and `https://snoozer.uk/reset-password`. For local development also allow `http://localhost:3000/auth/callback` and the existing confirmation/reset URLs.

The Google callback returns to Snoozer's server-side PKCE handler. The linking callback checks the currently authenticated Snoozer user ID before and after the OAuth exchange; it refuses to switch a user's account if the returned identity does not belong to that same user.

## Behaviour and validation

- `/sign-in` displays **Continue with Google**.
- Studio → Account Settings → Google sign-in starts the identity-linking flow.
- A linked Google identity can be used for later sign-ins.
- Users with TOTP enabled are routed to the second-factor screen after password or OAuth sign-in.
- Google linking updates the automatic Google Connected milestone.

Before enabling this for everyone, test a new Google sign-in, linking Google to an existing account with a different email, repeat linking, a Google identity already owned by another account, and a Google sign-in where TOTP is already enrolled.

Manual linking is currently a Supabase beta option. Supabase's current guidance is at [Identity Linking](https://supabase.com/docs/guides/auth/auth-identity-linking) and [Google sign-in](https://supabase.com/docs/guides/auth/social-login/auth-google).
