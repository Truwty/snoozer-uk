# Snoozer feature ledger

**Reviewed:** 27 November 2026  
**Purpose:** Current product capability map, not a historical task log or a guarantee that every provider-dependent flow has passed production acceptance.

Use the relevant feature guide and current source for implementation details. Distinguish these states:

- **In source:** routes, components, server actions or database functions exist in the current repository.
- **Automated coverage:** tests exercise the relevant behaviour in CI or locally.
- **Hosted acceptance:** the connected provider/service has been exercised successfully.
- **Operator confirmation:** the owner has confirmed a live business or payment outcome that should not be inferred from source alone.

A check in one category does not prove the others.

## Product areas

| Area | Current capability | Primary implementation |
| --- | --- | --- |
| Account and identity | Email/password, OAuth, account switching, verified sessions, MFA, recovery codes and device-session controls | `src/app/auth`, `src/app/studio/account`, `src/lib/account-*` |
| Public profiles | Published snapshots, canonical usernames, aliases, SEO metadata and custom-domain routing | `src/app/[username]`, `src/lib/profile*`, `src/lib/domains*` |
| Studio | Draft editing, profile sections/blocks, appearance, history, links and scheduled publication | `src/app/studio`, `src/lib/profiles-server.ts`, `supabase/migrations` |
| Media | Private avatar, image library/gallery, audio and background-video upload and serving | `src/app/studio`, `src/app/media`, `src/lib/*server.ts` |
| Widgets and embeds | Guestbook, polls, public metadata widgets, YouTube/Twitch/Spotify embeds and optional Discord presence | `src/app/api/v1/widgets`, `src/lib/widget*`, `src/lib/discord-presence*` |
| Analytics | Consent-aware first-party views/clicks, browser methodology, campaigns, exports and leaderboard | `src/app/studio/analytics`, `src/lib/analytics*`, `supabase/migrations` |
| Discovery | Profile discovery preferences, bounded search, collections and leaderboard visibility | `src/app/discover`, `src/lib/discovery*` |
| Billing | Snoozer-owned Plus, Pro and Studio subscriptions through Stripe Billing | `src/app/api/v1/billing`, `src/lib/premium-live*` |
| Trust and safety | Reporting, moderation cases, appeals, account restrictions and Owner actions | `src/app/report`, `src/app/owner`, `src/lib/owner` |
| Privacy | Self-service account snapshots, media export, reviewed export/deletion workflows and fulfilment evidence | `src/app/account`, `src/app/api/v1/account`, `supabase/migrations` |
| Help and legal | First-party Help routes, legal pages, Terms, Privacy and contact paths | `src/app/help`, `src/app/legal`, `src/app/terms`, `src/app/privacy` |

## Deliberately retired or unsupported

- Third-party creator marketplace, seller onboarding and Stripe Connect checkout.
- Creator product storefronts and paid creator memberships.
- Spotify OAuth, API tokens and Now Playing integration. Spotify support is based on validated official embeds only.
- Arbitrary user HTML, CSS or JavaScript in profile content.
- Unverified claims about live provider status, individual visitors, analytics uniqueness or external embed availability.

Historical migrations and financial records can remain for audit and retention. Their existence does not mean the retired product is active.

## Feature verification rule

When changing a feature, update its focused guide, add or amend tests, and record the exact CI run and commit in [PROGRESS.md](PROGRESS.md). Do not copy a former branch's status or test count into a current release statement without checking the current branch and latest-head CI.
