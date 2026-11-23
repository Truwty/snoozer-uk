# Feature #7 — Spotify public embeds only

**Status (23 November 2026): implemented and deployed.** Snoozer supports Spotify profile links and opt-in official iframe embeds. The optional Spotify Web API/OAuth/Now Playing beta was removed by owner request because it required a Premium developer account. There is no account linking, live listening status, Spotify token storage, API polling or Spotify-related paid developer dependency.

## Creator flow

1. In Spotify, copy the share link for a track, album, artist, playlist, show or episode.
2. In Studio, use **Add Spotify music or playlist** or add the link under Links. Save and publish as usual.
3. The original link is always available on the public profile. Visitors can press **Load Spotify player** to opt in to the official player; **Hide Spotify player** unmounts it.

The same card widget is used for Studio preview and published profiles. Snoozer validates only official `https://open.spotify.com/<kind>/<22-character ID>` links, including supported language-prefixed URLs. Invalid and unrecognised links are never passed to an iframe. Query strings and tracking fragments are removed from iframe sources. No user-supplied HTML or scripts are accepted.

The iframe is not created until the visitor explicitly requests it. Each decision is local and not retained; it is independent of analytics consent. Spotify controls availability, sign-in and playback. The global CSP allows `https://open.spotify.com` as a frame source in addition to existing providers. The official iframe uses lazy loading, a bounded sandbox, strict-origin referrer policy and an accessible title.

## Deliberately not supported

There is **no** Spotify OAuth callback, account connection, public Now Playing API, listening-activity widget, token encryption key, or Spotify-specific Supabase connection table/RPC. The original applied database migration is retained for migration history, followed by a removal migration which drops the obsolete private table and functions. No paid Spotify developer account or Spotify Web API access is needed.

## Acceptance and security

- Unit tests: valid resource types; spoofed domains, HTTP, credentials, alternate ports and malformed IDs rejected.
- Playwright: published profile playlist, no third-party iframe before opt-in, exact official iframe, and unmount on Hide.
- Build and CI: lint, TypeScript, unit tests, database migrations, Next.js build, and Playwright.
- Manually spot-check a live Spotify iframe if available; playback itself remains provider-controlled and may be geo-restricted.

## Spotify documentation

- [Creating Spotify Embeds](https://developer.spotify.com/documentation/embeds/tutorials/creating-an-embed)
- [Spotify Embeds](https://developer.spotify.com/documentation/embeds)
- [Spotify Widget Terms](https://developer.spotify.com/documentation/embeds/terms)
