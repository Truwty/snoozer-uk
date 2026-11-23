# Feature #7 — Spotify integration

## Phase 1: public Spotify links and optional embeds (implementation)

Spotify Development Mode's five-authorised-user limitation applies to Web API / OAuth integrations, not to publicly documented Spotify Embeds. Phase 1 therefore intentionally needs **no Spotify developer account, access token, Premium subscription, new database table or outbound server-side Spotify API call**.

Creators paste a recognised Spotify track, album, artist, playlist, podcast show or episode URL into Studio → Links; or use the new **Add Spotify music or playlist** shortcut. Valid links are saved using the existing revisioned links and publish workflow; Studio's existing preview, history, restore and content deletion continue to work unchanged. Original outbound Spotify URLs remain useful even if a player cannot render.

The shared public `ProfileCard` detects official `https://open.spotify.com/<kind>/<22-character ID>` URLs, optionally with an `intl-<lang>` prefix. Unrecognised Spotify links remain ordinary outbound links and are **never** treated as iframe sources. Tracking parameters and fragments are discarded from generated official embed addresses. Creators cannot submit iframe HTML or JavaScript.

The `SpotifyWidget` shows **Load Spotify player** only. There is no Spotify iframe or script before a visitor presses the button. Each visitor choice is local and non-persistent, independent of profile analytics. Hide unmounts the iframe. Native Spotify playback and availability are controlled solely by Spotify, not Snoozer. No auto-playing profile background audio or repackaged Spotify streaming is provided. Unsupported, removed, unavailable or region-locked media falls back to the original Spotify link.

The global Content Security Policy permits only `https://open.spotify.com` in `frame-src` in addition to existing YouTube/Twitch hosts. All other CSP directives remain unchanged. Embeds use strict-origin referrer policy, a bounded sandbox, loading=lazy and an accessible title. No third-party Spotify thumbnails or data are fetched before opt-in.

### Security acceptance

- Unit tests cover all supported Spotify URL kinds; spoofed domains, credentials, HTTP, ports, encoded paths, arbitrary iframe parameters and invalid IDs.
- Playwright exercises the actual published profile with an outbound Spotify playlist link, confirms no third-party iframe before consent, blocks the provider request in a deterministic fixture, checks the canonical iframe source and removes it on Hide. Analytics consent remains unchanged.
- No Spotify credentials, tables, migrations or sensitive account information exist in Phase 1. Existing authorised profile-save RPC and published-link read boundaries are unchanged.
- CI: lint, typecheck, unit tests, disposable Supabase, Next.js build, Playwright and Lighthouse smoke. Live Spotify iframe playback must be manually spot-checked in production because the provider may geoblock or require account sign-in.
- Any change to Spotify's official Embed Terms or required player attributes must trigger a review.

### Proof and provider documents

- [Creating Spotify Embeds](https://developer.spotify.com/documentation/embeds/tutorials/creating-an-embed)
- [Spotify Embeds](https://developer.spotify.com/documentation/embeds)
- [Spotify Widget Terms](https://developer.spotify.com/documentation/embeds/terms)
- [Spotify Development Mode quota](https://developer.spotify.com/documentation/web-api/concepts/quota-modes)

## Phase 2 and beyond — not yet implemented

OAuth account linking, encrypted refresh tokens, server-side playback metadata, Now Playing public visibility, Premium presentation and approved beta acceptance remain **separate follow-up milestones**. They require a registered Spotify developer app, its owner's Spotify Premium subscription, allowed beta users and successful Web API authorisation. Production-wide OAuth access cannot be obtained by creating multiple apps, using shared accounts, scraping session cookies or recycling credentials. Any broader use must comply with the relevant Spotify approval and quota requirements.

If OAuth is added, the code will maintain a separate Spotify link from Supabase login, with PKCE/state/session binding, verified-account requirements, explicit public listening consent, short-lived metadata, privacy export/disconnect handling and no tokens accessible through RLS, client props, logs or backups.


## Phase 2: Spotify Now Playing (implementation candidate)

Code branch: `feat/spotify-now-playing`. **Requires migration and runtime configuration; not accepted in production until Spotify provider testing is completed.**

### User flow
1. In Studio, open the Spotify integration page; normal public embeds continue to work even with this feature disabled.
2. An allowlisted Spotify user chooses **Connect Spotify**. Snoozer creates a ten-minute, HttpOnly, `__Host-` OAuth state cookie bound to the logged-in Snoozer Auth UID and a per-attempt PKCE verifier; authorisation uses the current Spotify Authorization Code + PKCE flow. Callback checks equality, expiry and active session, consumes the code and never accepts a return URL from the provider.
3. Only the `user-read-currently-playing` and `user-read-private` scopes are requested. No playback changes, playlist writes, library writes, background audio, login federation or shared credentials.
4. Both access and refresh tokens are encrypted with AES-256-GCM using a 32-byte key provided by Render. They are stored only in `snoozer.spotify_connections` behind RLS and service-role-only RPCs; reconnecting revokes visibility by default.
5. The creator must explicitly check a consent box to show listening on **all** their published profiles. Public visitors see a **Show live status** button; it fetches only a short public track name, artist and canonical Spotify track URL via Snoozer. No Spotify script or request is made by the visitor. Paused, local and non-track content is not exposed.
6. A 30-second database lease throttles Spotify Web API polling per user, while the public component checks at most once per minute per active viewer. Rate-limit responses are backed off according to Spotify's `Retry-After` (at least 60 seconds, capped at one hour), transitory errors fail closed and cached public status expires after two minutes. A rotated refresh token is CAS-updated to avoid overwriting concurrent rotations. A confirmed revocation deletes stored tokens and public status. User disconnect removes all connection and cache rows.
7. Existing profile theme and approved Premium interaction effects style the status region. No music functionality is paywalled by Snoozer Premium; paid layout styling is enforced through the existing published-profile effects tier.

### Migration and environment

Apply `supabase/migrations/20261123002500_spotify_readonly_connections.sql` to the deployed Supabase project before enabling OAuth. Verify `snoozer.spotify_connections` RLS is on, no `anon` or `authenticated` table privileges exist, public read RPC returns only a boolean, and private token functions are callable only by the server's service-role key. Check Supabase security advisors.

In Spotify Developer Dashboard, register `https://www.snoozer.uk/spotify/callback` as the **exact** redirect URI. The Spotify app owner must have Spotify Premium, and up to five individual Spotify users must be allowlisted while Development Mode restrictions apply. There is no supported bypass.

Set **server-only** Render environment variables:
- `SPOTIFY_OAUTH_ENABLED=true` (leave `false` until the provider is ready)
- `SPOTIFY_CLIENT_ID` (32 hex characters, from Spotify Developer Dashboard)
- `SPOTIFY_TOKEN_KEY_HEX` (64 hex characters; generate securely e.g. `openssl rand -hex 32`, store outside Git)

No `SPOTIFY_CLIENT_SECRET` is required by this PKCE flow. Do not use `NEXT_PUBLIC_` prefixes. Register a separate exact HTTPS callback for any real staging origin as appropriate; production code calculates callback from `NEXT_PUBLIC_SITE_URL`.

### Acceptance gates

- Full GitHub CI: npm audit, lint, TypeScript, Vitest, Supabase migration, Next build and Playwright.
- Provider flow: allowlisted Premium developer account, actual redirect and callback, encrypted storage, public disabled by default, enable/disable from Studio, real track shown, paused hidden, logout/session swap blocked, refresh rotation and reconnection, disconnect and GDPR deletion cascade.
- Security: no token or raw account data in browser/network/logs, no Web API calls while disabled, no public access to private RPCs, 429 backoff and malformed-data tests.
- Render deployment only after migration. End-to-end Spotify provider validation cannot be marked passed without real developer credentials and an authorised test account.

Custom-domain profiles can request the read-only Spotify status endpoint through the verified public-domain proxy; the domain-bound username must match the query exactly and other account/Spotify API routes remain denied on custom hosts.

The first-party account archive includes the account owner's Spotify user ID, public-listening flag and connection timestamp (when available), but never exports encrypted tokens, access tokens or refresh tokens. Disconnect deletes the private row; Auth erasure cascades removal.
