# Account security, gift links and official badges

## Account security

Studio → Account Settings now includes Google sign-in identity linking, verified email change, TOTP authenticator enrolment and challenges, and per-device session management. Password reset remains on the established recovery path.

Supabase's default secure email-change policy can send confirmations to both the old and new inboxes. Keep **Secure email change** enabled. For hosted projects, set Authentication → Email Templates → Change email address to:

```html
<h1>Confirm your new Snoozer email address</h1>
<p>You requested to update your Snoozer account email to {{ .NewEmail }}.</p>
<p><a href="{{ .RedirectTo }}&amp;token_hash={{ .TokenHash }}">Confirm email change</a></p>
```

The email change redirect already includes `?type=email_change`, so the token hash is appended with `&`. The local CLI template is `supabase/templates/email_change.html`.

TOTP is opt-in. When a verified factor is enrolled, sign-in requires AAL2 and the shared `snoozer.verified_user()` database guard also rejects AAL1 RPC calls. This prevents a caller from bypassing the Studio second-factor screen by invoking profile RPCs directly. Owner writes continue to require AAL2. The flow does not issue downloadable recovery codes, so the UI advises adding a second trusted authenticator before changing phones.

Session revocation deletes the selected Auth session after checking ownership and preventing self-revocation of the current session. The refresh token is revoked immediately; an already issued access JWT remains valid until expiry. Snoozer's protected RPCs also validate the JWT session ID against `auth.sessions`.

References: [Supabase TOTP MFA](https://supabase.com/docs/guides/auth/auth-mfa/totp), [sessions](https://supabase.com/docs/guides/auth/sessions), [email templates](https://supabase.com/docs/guides/auth/auth-email-templates).

## One-time Premium gift links

Owner Control Centre → Gift links creates Plus, Pro or Studio entitlements. Links are single-use, expire, store a SHA-256 token hash only, and record an audit reason. The raw token is returned once. Owner and recipient foreign keys use deletion-safe semantics: deleting either account does not unblock a claimed token or erase the audit trail. Owners can revoke an unclaimed link.

Claim tokens travel in the `/gift` URL fragment, are moved into tab session storage and removed from the address bar before the claim POST. They are never placed in query strings. Claiming requires a verified Snoozer account.

Existing Stripe gift-code and paid-gift processes remain separate and unchanged.

## Official badge programme

The private `snoozer.badge_catalog` is the source of badge definitions; `snoozer.profile_badges` stores awards. The seeded catalogue covers automatic profile/account milestones, manual staff/community awards and future seasonal, anniversary, audience, leaderboard, creator, Premium and unique rewards.

**Temporary status (26 November 2026):** achievement badges are hidden from public profiles, and the Studio/Owner badge-management pages and navigation are disabled. Stored award records, catalogue definitions, migrations and private database history are retained; no badge records or images were deleted. The badge UI can be restored later without reconstructing past awards. Awarding/trigger history remains in the database but is not exposed through the application UI during this pause.

The current catalogue contains 122 badge definitions.
