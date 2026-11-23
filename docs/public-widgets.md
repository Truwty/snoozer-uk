# Public provider widgets

Stage 4 increment, 17 November 2026. Migration 20261110005800.

## Supported behaviour

- HTTPS GitHub repository links can load a public repository name, description, star count and fork count.
- Discord invite links can load the public community name and available approximate member/online counts. Guild-channel links can load the public server widget's name/online count when the guild owner enabled that widget. Member lists, avatars, inviter accounts and invite metadata are discarded.
- Twitch channel links offer a separate opt-in player with the actual embedding hostname, autoplay disabled and initial mute. The frame is not loaded below Twitch's required 400×300 minimum. Shrinking below that size removes the frame; hiding also revokes the current page's player choice. The original external link remains usable.
- YouTube retains its separately tested optional player.
- Validated Roblox game URLs are identified as Roblox links and remain direct navigation. **No Roblox API statistics, thumbnails or authenticated game showcase is claimed.** Current official legacy API documentation warns against production reliance on cookie-authenticated endpoints; those need a separately verified stable API/OAuth design. No Roblox session cookie is requested or scraped.

Widgets derive from real saved/published links and use the shared renderer. No arbitrary embed HTML or scripts are accepted. Public GitHub/Discord lookups require the current published link at the submitted position; callers cannot supply a URL or resource key. Studio/history previews show an honest publish-first note for those server summaries rather than querying private draft links publicly. No widget implies verified ownership of the external resource.

## Consent and failure handling

Nothing loads a provider or summary endpoint until a visitor chooses its button. Summary lookup consent is separate from analytics. GitHub/Discord data is fetched by Snoozer with fixed application headers, no visitor cookies, IP forwarding, referrer or user agent. The browser receives only a validated minimal projection. Twitch and YouTube explicitly disclose the direct provider connection before loading and use narrowly allowlisted frame hosts.

Hide clears the summary/player and aborts an outstanding browser summary request. A server lookup already started may still finish and cache its public projection. Expired, private, revoked, malformed, oversized, redirected or unavailable provider responses never become fake zero counters. The UI retains the original link and explains the temporary fallback.

GitHub/Discord counts are cached public snapshots labelled with fetch time. Provider visibility/count changes can take up to one hour to appear. Removing the published profile link immediately prevents subsequent summary requests from serving that resource at the old position, even if a cache entry exists. Already downloaded content cannot be remotely erased. Discord counts remain approximate.

## Free-tier storage and upstream controls

PostgreSQL holds version-1 JSON projections (at most 8 KiB), 30-second refresh leases and global per-provider limits. Only service_role can use the cache RPCs; RLS and direct table revocation cover all app roles. Stale refresh completions cannot overwrite a newer lease.

Cache hits last one hour; failed lookups are negatively cached for five minutes. At most 40 upstream refresh attempts per provider per UTC hour are allowed, spaced by at least one second. This is an application guardrail, not a guarantee of upstream quota availability. Provider Retry-After/reset headers and Discord retry_after responses add backoff, including a successful response whose remaining allowance is zero. The backoff survives an hour rollover. Limits prevent new cache keys from accumulating when the budget is exhausted.

Metadata older than seven days is swept opportunistically in bounded batches during a refresh. Inactivity may delay cleanup; no visitor records are stored in this cache. Profiles remain usable if the cache, provider or summary endpoint fails. These provider-summary widgets do not require a paid worker, Redis, cron or provider account token. The separate first-party Discord Presence integration is documented in `docs/discord-presence.md`; unlike these summaries, it requires an always-on Gateway worker and explicit creator identity/profile consent.

Upstream requests have a five-second timeout, pinned HTTPS API hosts, redirects disabled and a 100 KiB decompressed response limit. Only the exact public repository/invite/guild requested can populate its entry. GitHub private responses and sensitive extra fields (including temporary clone tokens) are discarded, as are Discord member lists and inviter identities. API replies are no-store, origin-checked, JSON/bounded-body validated and contain no refresh leases or upstream error bodies.

## Sources checked on 17 November 2026

- [GitHub repository metadata](https://docs.github.com/en/rest/repos/repos#get-a-repository), API version 2026-03-10, and [rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api).
- [Discord invites](https://docs.discord.com/developers/resources/invite), [guild widgets](https://github.com/discord/discord-api-docs/blob/main/developers/resources/guild.mdx) and [rate limits](https://docs.discord.com/developers/topics/rate-limits).
- [Twitch player and minimum dimensions](https://dev.twitch.tv/docs/embed/video-and-clips), [SSL/parent requirements](https://dev.twitch.tv/docs/embed).
- [Roblox's current legacy API warning](https://create.roblox.com/docs/cloud/reference/domains/games.md).

The unavailable Stripe Directory CLI/plugin catalogue was not used to provision anything or change the mandated providers.

## Verification

Local unit/SQL checks cover resource allowlists, sensitive-field stripping, unavailable/private/oversized responses, provider backoff, consent/origin, current-publication binding, lease replacement, role denial, negative caching, capacity, blocked-hour rollover and expiry cleanup. Disposable browser coverage adds cached GitHub rendering, Discord failure fallback, Twitch sizing/mute/parent/hide, Roblox outbound links and rejection after the creator removes a published integration link.

Local lint/typecheck/build and all 185 Vitest plus two audit-policy tests pass on the versioned payload source. CI 44187169499 passed all 185 unit/SQL tests, two policy tests and 21 browser/HTTP checks (one expected skip). Migration 58 is applied and permission-checked on staging. Deploy dep-dbud6majnfac73csrs30 reached Live on d182a5f. Hosted opt-in loaded real vercel/next.js metadata and the official Discord Developers community summary; Twitch rendered its offline UI at 446×300 with the correct parent and muted/no-autoplay flags. Hide removed the frame. Health checks returned 200. No Twitch live playback was attempted. Individual Discord presence, GitHub contribution calendars, first-party Twitch live-status API and authenticated Roblox data are not implemented by this increment.


## Discord Presence (separate opt-in integration)

Discord Presence is not a public invite-count widget and does not use the public Discord guild-widget API. It uses a first-party Gateway worker with the privileged Presence Intent, a verified linked Discord identity and per-profile consent. Only the creator-selected fields are projected to the public profile. It is not Premium-gated. See [Discord Presence architecture and setup](discord-presence.md).
