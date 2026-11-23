# Discord Presence

Status: implementation merged in PR #80 (`ca332cc`); the event-owner index follow-up merged in PR #81 (`a169b7e`). PR #80's full CI run passed (including 64 Playwright tests and Studio Lighthouse accessibility score 100); PR #81's CI passed. Both Discord Presence migrations are applied to the connected Snoozer staging project. The Render web deployment still requires live verification and the feature remains disabled with `DISCORD_PRESENCE_ENABLED=false`. Activation is blocked on written Discord policy clearance, bot configuration, a shared guild and an owner-approved always-on worker.

## Behaviour

Creators can link a Discord identity to their existing Snoozer account and enable presence separately on each published profile. The Studio page controls exactly which fields are public:

- Online status (online, idle, Do Not Disturb or offline)
- Current activity (playing, streaming, listening, watching or competing)
- Custom status text (off by default)

The feature is free for all account tiers. Presence data is not a Premium entitlement, advertising input, analytics dimension, referral signal or upsell condition. Profile themes may style the widget using the same general theme tokens as the rest of the profile; the presence data itself is never sold or gated.

## Data minimisation

- The creator must link their Discord identity and explicitly enable public presence for a profile.
- Only Discord IDs with at least one published, enabled profile are returned to the worker.
- The worker filters Gateway events to those IDs and only serialises the fields enabled by at least one of their published profiles.
- Custom status is not extracted or sent to Snoozer unless the creator explicitly enables it.
- Activity payloads are reduced to type, name, details and state. Application IDs, assets, buttons, URLs, party secrets, join secrets, message content, server messages, friends and private channels are not stored.
- Snoozer stores a single current snapshot, not a presence history. Snapshots are no longer served after ten minutes without a refresh and are physically purged on the next worker sync; they are refreshed every five minutes while the worker is connected.
- The public projection is unavailable if the worker heartbeat is older than 90 seconds, the shared guild is unavailable, the snapshot has expired, the profile is unpublished or consent is disabled.
- Disconnect removes the identity mapping and cache. Disabling the last published presence profile or unpublishing the last enabled profile prunes the cache. Account deletion cascades to the mapping, snapshot and event-deduplication records.
- The account data archive includes the Discord presence connection and profile settings.

## Architecture

1. Supabase Auth supplies the verified Discord identity. A user-provided Discord ID is never accepted as proof of ownership.
2. A dedicated Node worker connects to Discord Gateway v10 using only the `GUILDS` and privileged `GUILD_PRESENCES` intents.
3. The bot must be a member of the shared Snoozer Discord server. A creator must also be a member of that server.
4. The worker requests targeted snapshots for opted-in user IDs (batches of at most 100) and listens for `PRESENCE_UPDATE` events. It does not request the full guild member list and does not request Message Content or the Guild Members intent.
5. The worker signs internal requests with HMAC-SHA256. Snoozer checks the timestamp, exact request body and signature before accepting any update.
6. Private Supabase tables have RLS enabled and no direct grants. Narrow RPCs enforce account ownership or service-role-only worker access.
7. Public profiles call a read-only projection that returns only the creator-selected fields.

## Supabase Auth identity linking

Existing Discord sign-in identities are reused. For creators who signed up with email and need to attach Discord to that same Snoozer account, the Studio action uses Supabase Auth `linkIdentity`. Supabase's Manual Identity Linking feature must be enabled in Auth settings for that flow. Do not merge accounts by matching an unverified email or by accepting a Discord ID from the browser.

Disconnecting Discord Presence deliberately does not unlink Discord as a Snoozer sign-in method; it only removes the presence mapping and cached data.

For email/password Snoozer accounts, Discord identity linking also needs the Discord OAuth provider configured in Supabase Auth:

- Enable **Discord** under Supabase **Authentication → Sign In / Providers** and enter the Discord application's OAuth Client ID and Client Secret.
- In the Discord Developer Portal, add the Supabase project's displayed Auth callback URL (normally `https://<project-ref>.supabase.co/auth/v1/callback`) to the application's OAuth2 redirect URIs.
- In Supabase Auth URL Configuration, allow the Snoozer callback `https://snoozer.uk/auth/callback` (and any other canonical site origin actually used by the deployment).
- Enable **Manual Identity Linking** in Supabase Auth settings. The app requests only the `identify` scope and never trusts a Discord ID submitted by the browser.

## Discord Developer Portal setup

1. Create or select a Discord application that will own the presence bot.
2. Add a bot user.
3. In **Bot → Privileged Gateway Intents**, enable **Presence Intent**. Do not enable Message Content or Server Members for this integration.
4. Invite the bot to the single shared Snoozer Discord server. It needs no channel permissions for presence observation; keep its permissions minimal.
5. Copy the server ID with Discord Developer Mode enabled. This becomes `DISCORD_PRESENCE_GUILD_ID`.
6. Publish the server invite in `DISCORD_PRESENCE_INVITE_URL` so creators know where they must be members.
7. Keep the bot token private. Never put it in GitHub, source code, browser configuration or ChatGPT messages.

Discord's 10 June 2026 privileged-intent rules use the number of unique users who can access the app across all installed servers, not the number of servers. Apps accessible to fewer than 10,000 users may enable Presence Intent using the Developer Portal toggle. At 10,000 users, Discord notifies the owner and requires a privileged-intent review request within 90 days; apps granted access through review must reapply annually when notified. Check the Developer Portal for the app's current eligibility and any review notice before launch. These intent-access rules do not resolve the separate policy question about displaying Discord API Data inside Snoozer's wider paid SaaS; obtain written confirmation from Discord before enabling public presence.

## Environment

Generate one shared signing secret:

```bash
openssl rand -hex 32
```

Set the same value in the Snoozer web service and the worker.

### Snoozer web service

- `DISCORD_PRESENCE_ENABLED=false` — default kill switch. Set to `true` only after policy clearance and after the bot/worker secrets are configured.
- `DISCORD_PRESENCE_INGEST_SECRET` — 64-character random hex secret; required for signed internal worker requests.
- `DISCORD_PRESENCE_INVITE_URL` — optional HTTPS Discord invite URL shown in Studio.

### Presence worker

- `DISCORD_PRESENCE_ENABLED=true` — explicit activation switch; leave false until policy clearance and the service is ready.
- `DISCORD_BOT_TOKEN` — Discord bot token, secret.
- `DISCORD_PRESENCE_GUILD_ID` — the one shared Discord server ID.
- `SNOOZER_PRESENCE_URL` — `https://snoozer.uk` (no trailing slash).
- `DISCORD_PRESENCE_INGEST_SECRET` — same 64-character secret as the web service.

## Render worker

The existing Snoozer web service is a free web service and can sleep. It is not suitable for a continuously connected Gateway process. `render.presence-worker.yaml` defines a separate always-on Render Background Worker using Node's built-in WebSocket client; no Docker image or extra npm dependency is required.

The blueprint uses Render's Starter worker plan. It is a separate recurring paid resource (check the current price in Render before creating it). It has **not** been provisioned. Do not create or sync this worker until the owner has approved the recurring cost and supplied the Discord bot configuration.

Start command:

```bash
node workers/discord-presence/worker.mjs
```

## Rollout and acceptance

The application side can be built, migrated and CI-tested without the Discord token. Production provider acceptance requires:

- Discord Presence Intent enabled for the bot application
- Bot invited to the shared server and the server ID configured
- The worker deployed as an always-on service
- The same HMAC secret configured on web and worker
- Supabase Manual Identity Linking enabled if existing email accounts must link Discord
- A consenting Discord test account linked to Snoozer and a member of the shared server
- Live tests for online, idle, DND, offline/invisible, activity changes, custom status opt-in, leaving the shared server, disconnect, disabled consent and worker outage

Before public launch, obtain written confirmation from Discord that displaying Discord API Data inside Snoozer's wider SaaS (which has other paid plans) is permitted under the current Developer Terms/Policy. The implementation intentionally does not sell, gate, advertise against or otherwise monetise the presence data.

## References

- [Discord Gateway intents](https://docs.discord.com/developers/events/gateway)
- [Discord privileged intent access](https://support-dev.discord.com/hc/en-us/articles/40281523410967-Changes-to-Privileged-Intent-Access-for-Discord-Apps)
- [Discord Developer Terms](https://discord.com/developers/docs/policies-and-agreements/developer-terms-of-service)
- [Supabase Auth identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking)
- [Render Background Workers](https://render.com/docs/background-workers)
