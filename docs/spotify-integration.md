# Spotify integration — official embeds only

**Reviewed:** 27 November 2026  
**Status:** Public profile embeds are supported. Spotify OAuth, Web API tokens and Now Playing are not supported.

## Creator flow

1. Copy an official Spotify share link for a track, album, artist, playlist, show or episode.
2. In Studio, add the Spotify link or use the Spotify music control.
3. Save and publish the profile. Snoozer renders the supported Spotify media as an official Spotify iframe.

The normal profile link remains available if the embed fails. Snoozer validates supported `https://open.spotify.com/<kind>/<22-character ID>` links and constructs the canonical embed URL; malformed and unknown links are not used as iframe sources. No arbitrary iframe HTML, custom scripts or Web API request is accepted.

Spotify owns the embedded player and its play controls, account sign-in and regional playback availability. Snoozer does not fake play controls, read player internals or control the embedded player's volume.

## Privacy

The current product behaviour loads the official Spotify iframe automatically when the public embed is rendered; there is no per-player opt-in. This causes the visitor's browser to contact Spotify and may disclose the visitor's IP address and browser/device information. The iframe uses `strict-origin-when-cross-origin` so Spotify receives the site origin rather than the profile path/query. Snoozer analytics consent is separate from this provider request.

This description is not a legal determination that UK PECR/GDPR consent requirements are satisfied. Review Spotify's current embed terms and the applicable storage/access guidance before materially changing how or when embeds load. Do not claim that the integration is privacy-neutral.

## Deliberately not supported

- Spotify OAuth or account linking.
- Spotify Web API access or stored refresh/access tokens.
- Now Playing presence or server-side playback state.
- Importing playlists or audio files from a Spotify account.

The historic OAuth migration and its removal migration remain in the migration history. Their presence does not mean OAuth is active.

## Verification

Current source and tests cover allowed media URLs, malformed/spoofed links, canonical iframe URLs, referrer policy, responsive player sizing and fallback navigation. Spotify network requests are intercepted in CI; CI interception does not prove live Spotify playback in every region.

## References

- [Spotify: Creating an Embed](https://developer.spotify.com/documentation/embeds/tutorials/creating-an-embed)
- [Spotify Widget Terms](https://developer.spotify.com/documentation/embeds/terms)
- [ICO storage and access guidance](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-the-use-of-storage-and-access-technologies/how-do-we-manage-consent-in-practice/)
