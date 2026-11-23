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
