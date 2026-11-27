# Optional YouTube widget

**Reviewed:** 27 November 2026

Add a supported HTTPS YouTube video link in Studio and publish normally. The shared profile renderer offers a player beneath that link, both in preview and on the published page. Draft save, undo, publication history, hiding by link removal, and restore reuse the existing immutable link snapshots. No provider token, additional database table or arbitrary embed HTML is needed.

Supported routes: youtube.com (www/mobile) watch, shorts and embed video URLs, and youtu.be video URLs with an 11-character video ID. Channels, playlists, HTTP links, credentials, alternate ports and unrecognised hosts remain ordinary links without a player. URL query parameters never become iframe attributes or player parameters.

The player is absent initially: no iframe, thumbnail fetch, provider script or provider request. A clearly labelled per-player button explains transmission to Google before loading. Embed consent is separate from profile analytics consent and is not remembered across page loads. Hide removes the iframe. Removing a creator's video link and republishing removes the widget from that publication; previously open pages are not remotely revoked.

The frame uses the documented `youtube-nocookie.com` host, autoplay disabled, a descriptive title, strict-origin referrer policy, sandboxed scripts/presentation, a minimum 200 px height and responsive width. Only that host is added to the parent CSP's `frame-src`. The explicit origin-only referrer is needed for supported YouTube playback identification; page paths and query strings are not sent as referrers.

The original external link is always present, including without JavaScript or when the provider, video owner, browser or network blocks playback. The UI explains this fallback without pretending to detect provider playback success. Hiding stops future requests by the frame; it does not erase data already sent to the provider.

## Privacy and provider limits

The per-player consent action is separate from Snoozer's first-party analytics preference. Loading the player causes the visitor's browser to contact Google/YouTube; it may disclose IP address, browser/device information and the site origin. Do not describe this embed as privacy-neutral or imply that hiding it erases data already transmitted. Review current Google/YouTube terms and regional requirements before changing the consent flow.

## Verification

`tests/youtube.test.ts` checks allowed URLs and malicious/unsupported fallbacks. Browser tests cover separate opt-in, blocked provider, outbound fallback and iframe removal. Those tests run in the current GitHub Actions browser suite; check the exact latest-head run before release. Earlier CI run numbers and staging screenshots in the previous version of this guide are historical evidence, not current release proof. Live playback was not started by this audit.

Sources: [YouTube player parameters](https://developers.google.com/youtube/player_parameters) · [privacy-enhanced embed guidance](https://support.google.com/youtube/answer/171780?hl=en).
