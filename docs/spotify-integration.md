# Feature #7 — Spotify public embeds only

**Status (26 November 2026): Spotify embed playback fix staged on `feature/remove-profile-badges-fix-music`.** Snoozer supports official Spotify share links and embedded players. The Spotify Web API/OAuth/Now Playing beta remains removed. Creators do not need to connect a Spotify account or provide Snoozer with Spotify credentials to add an embed.

## Creator flow

1. In Spotify, copy the share link for a track, album, artist, playlist, show or episode.
2. In Studio, use **Add Spotify music or playlist** or add a normal Spotify link. Save and publish.
3. The published profile automatically displays Spotify embeds when the profile is opened. A Spotify track is placed in the compact bio player; albums, playlists, artists, shows and episodes remain available under **More** or in the full profile layout. The normal full-size widget has a small **Open** link that retains Snoozer link-click attribution when analytics is enabled. The compact track player has its own **Open in Spotify** fallback link.

The same widget is used in Studio preview and on published profiles. Snoozer validates only official `https://open.spotify.com/<kind>/<22-character ID>` links, including supported language prefixes. Malformed and unrecognised links are never used as iframe sources. Tracking parameters and fragments are discarded. No custom scripts, iframe HTML or Web API calls are allowed.

The embedded content and playback controls are Spotify's official player. Snoozer does not draw fake play controls or control the Spotify iframe's volume. Compact public-profile tracks use the official 152px layout; full-size collections use 352px. The iframe keeps `allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"`, explicitly allows encrypted media for full playback, and is not sandboxed. Its `referrerPolicy` is `strict-origin-when-cross-origin`: Spotify receives only the site origin, not the profile path or query string. Spotify documents a minimum 280px audio-player width; Snoozer expands the player to the card edges on narrow phones to respect that minimum. The embed is requested lazily and does not force autoplay; visitors press Spotify's own Play control. Full playback, account sign-in and regional availability remain Spotify-controlled.

## Privacy and trade-off

**The owner requested that music embeds be visible without a per-player opt-in.** Spotify receives a request directly from the visitor's browser when the embed loads; this can disclose the visitor's IP address and browser/device information, and Spotify may access third-party browser storage. For the iframe request, Snoozer sends only the site origin using `strict-origin-when-cross-origin`; normal site responses continue to use the site's stricter no-referrer policy. This is disclosed in Snoozer's Privacy Policy; it does **not** imply UK PECR/GDPR consent is satisfied. ICO guidance for non-essential third-party embeds and storage may require an appropriate opt-in mechanism. A consent-managed global integrations preference is recommended before broad production usage if Spotify sets or accesses non-exempt storage. Snoozer analytics consent is separate and never automatically enabled by the iframe.

## Deliberately not supported

There is no Spotify OAuth callback, Spotify Now Playing status, token/key storage or Supabase connection table/RPC. The original migration and a later removal migration are retained as historical migrations.

## Acceptance

- Unit tests cover valid media links and malformed/spoofed links.
- Playwright verifies automatic iframe visibility, canonical Spotify embed URLs, the encrypted-media permission, the origin-only referrer policy, absence of restrictive iframe sandboxing, the compact 152px track player, the full 352px collection player, the compact fallback link, and a rendered player width of at least 280px at a 320px viewport. Spotify network requests are intercepted in CI.
- TypeScript, lint, migration, Next.js build, Playwright and Lighthouse CI must pass; a live Render deployment and visual spot-check follow.
- The player is not modified to fake Spotify controls or bypass Spotify terms.

## References

- [Spotify: Creating an Embed](https://developer.spotify.com/documentation/embeds/tutorials/creating-an-embed)
- [Spotify Widget Terms](https://developer.spotify.com/documentation/embeds/terms)
- [ICO: How to manage consent in practice](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-the-use-of-storage-and-access-technologies/how-do-we-manage-consent-in-practice)
