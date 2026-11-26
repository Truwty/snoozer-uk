# Compact public bio profile

Published profile pages use a focused, centred bio-page presentation. Studio preview keeps the full editable canvas and the existing stored profile layout.

## Public presentation

- A 576px maximum-width glass card with a translucent dark surface, 20px backdrop blur, rounded corners and a thin border.
- Centred avatar, display name, owner-verification and Discord-presence indicators, and a short typewriter-style bio. The typewriter effect respects reduced-motion preferences.
- Recognised profile links appear as monochrome SVG brand icons with a subtle hover glow.
- Sections, content blocks, non-Guestbook interactive widgets, the gallery and additional non-social links are tucked behind a minimal collapsed **More** disclosure. The first screen stays compact; the saved content remains available to visitors when expanded. The Guestbook is intentionally not rendered on public bio pages.
- The public Report profile route remains available as a small fixed link.

## Music

The compact public page supports one selected audio source:

1. A visible normal profile link to a public HTTPS audio file ending in `.mp3`, `.m4a`, `.ogg`, `.wav`, `.aac` or `.flac` takes priority.
2. Set that link's label to `Track title — Artist` to populate the compact player's title and artist.
3. The first gallery image is used as cover art; the profile avatar is the fallback.
4. The player exposes play/pause, seek/progress, elapsed/duration and a page-level mute/volume slider. Clicking the entry overlay starts the directly hosted track as a user-initiated action. Visitors can then pause, resume, seek or adjust volume.

When no direct audio file is linked, the first visible Spotify track link uses Spotify's official compact track embed. Spotify remains responsible for its own playback controls and volume. The parent page does not pretend to control the Spotify iframe's volume because the official iFrame API does not expose a volume setter. Playlist, album, artist and podcast embeds are intentionally not expanded on the compact bio page.

Audio Uploads are not implemented by this change. Creators must host their own audio file and add its HTTPS URL as a normal profile link. The Content Security Policy permits secure HTTPS media while leaving the existing script, image, frame and connection restrictions unchanged.

## Validation

`tests/profile-experience.test.ts` covers the entry overlay, SVG social links, compact native audio player, hidden audio links, compact Spotify track embed, suppression of the Guestbook/content sections on the public bio page, and preservation of the normal renderer when the entry experience is disabled. `e2e/smoke.spec.ts` asserts the HTTPS media CSP directive remains present.
