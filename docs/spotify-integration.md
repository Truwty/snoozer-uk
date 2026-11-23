# Feature #7 — Spotify public embeds only

**Status (23 November 2026): deployed; visual refresh staged for CI.** Snoozer supports official Spotify links and always-visible embedded players. The Spotify Web API/OAuth/Now Playing beta was removed by the owner because it required a Premium developer account. No Spotify developer account, credentials or subscription are needed for embeds.

## Creator flow

1. In Spotify, copy the share link for a track, album, artist, playlist, show or episode.
2. In Studio, use **Add Spotify music or playlist** or add a normal Spotify link. Save and publish.
3. The published profile automatically displays the official Spotify player as visitors scroll to it, under a compact themed header. The duplicate large Spotify link button and the old privacy accordion, load/hide button and long explanatory copy have been removed. A small **Open** link still opens the resource on Spotify and retains Snoozer link-click attribution when analytics is enabled.

The same widget is used in Studio preview and on published profiles. Snoozer validates only official `https://open.spotify.com/<kind>/<22-character ID>` links, including supported language prefixes. Malformed and unrecognised links are never used as iframe sources. Tracking parameters and fragments are discarded. No custom scripts, iframe HTML or Web API calls are allowed.

The iframe itself is Spotify's official, unaltered player. Snoozer styles only the outer frame and a header using the profile's theme variables. Spotify recommends 152px for compact track/episode players and 352px for full-size collections. Loading remains lazy (rendered immediately, requested when in or near the viewport), without automatic music playback. Official playback availability and sign-in requirements remain Spotify-controlled.

## Privacy and trade-off

**The owner requested that music embeds be visible without a per-player opt-in.** Spotify now receives a request directly from the visitor's browser when the embed loads; the request can disclose IP address and browser/device information and Spotify may access third-party browser storage. Referrer-Policy is `no-referrer`. This is disclosed in Snoozer's Privacy Policy; it does **not** imply UK PECR/GDPR consent is satisfied. ICO guidance for non-essential third-party embeds and storage may require an appropriate opt-in mechanism. A consent-managed global integrations preference is recommended before broad production usage if Spotify sets or accesses non-exempt storage. Snoozer analytics consent is separate and never automatically enabled by the iframe.

## Deliberately not supported

There is no Spotify OAuth callback, Spotify Now Playing status, token/key storage or Supabase connection table/RPC. The original migration and a later removal migration are retained as historical migrations.

## Acceptance

- Unit tests cover valid media links and malformed/spoofed links.
- Playwright verifies automatic iframe visibility, no redundant card CTA, the correct canonical Spotify embed URL, compact/full dimensions, new card header and no Spotify-specific disclosure or load/hide controls; Spotify requests are intercepted in CI.
- TypeScript, lint, migration, Next.js build, Playwright and Lighthouse CI must pass; a live Render deployment and visual spot-check follow.
- The player is not modified to fake Spotify controls or bypass Spotify terms.

## References

- [Spotify: Creating an Embed](https://developer.spotify.com/documentation/embeds/tutorials/creating-an-embed)
- [Spotify Widget Terms](https://developer.spotify.com/documentation/embeds/terms)
- [ICO: How to manage consent in practice](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-the-use-of-storage-and-access-technologies/how-do-we-manage-consent-in-practice)
