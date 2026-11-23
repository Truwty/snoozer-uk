# Discord Presence

Status: core implementation, profile UI refresh, legal disclosure, snapshot diagnostics and targeted snapshot fix are merged. PR #80 introduced the integration, PR #81 added the event-owner index, PR #83 replaced the large status card with a compact status-coloured Discord logo beside the profile name and an 8-second no-store poller, and PR #85 replaced the clipped pseudo-tooltip with a native hover tooltip. PR #86 added aggregate-only snapshot diagnostics. PR #87 fixed a Map-iteration bug that had prevented targeted snapshots from being requested: both the initial guild join and periodic refresh now pass actual subscribed Discord user ID keys.

Render deployment `dep-dc1t38ifngtc738jg1pg` is live on commit `dedb1fdbf95b18f4518f9770e720df4668790b12`. The new instance passed `/health/live`, started the worker and reconnected to Discord Gateway; READY and GUILD_CREATE confirmed the configured shared guild. The worker refreshed one opted-in account, sent a targeted snapshot request, and received a member chunk with one matching member, zero presence objects and zero not-found users. Supabase contains a fresh cache row with status `offline` (observed at `2026-11-23 05:41:37 UTC`, expiring at `05:51:37 UTC`). Because Discord's chunk had no presence object, the worker applies its documented offline fallback; this is not yet evidence of a true explicit Offline event or any live Online/Idle/DND transition.

The free Render setup runs the worker as a child of the web service; GitHub Actions sends a best-effort wake-up every 10 minutes. PR #84 added a scoped push trigger and its first push-triggered run `45116179740` successfully pinged the site, but no scheduled run is yet evidenced. This is not an always-on guarantee.

Public launch clearance remains blocked on (1) a real consenting linked account changing Online/Idle/DND/Offline, with the badge updating without manual refresh, plus testing activity/custom status, opt-out, disconnect, guild departure, deletion and outage recovery; and (2) written Discord confirmation that displaying Discord API Data in Snoozer's wider SaaS is permitted. The Terms do not represent that Discord has approved the use.


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
4. The worker requests targeted snapshots for opted-in user IDs only (batches of at most 100 using the Gateway `user_ids` field) and listens for `PRESENCE_UPDATE` events. It never requests the full guild member list and does not request Message Content or the Guild Members intent. Discord documents that the Guild Members intent is required for full-list member requests, while the Presence intent is required to include presence payloads. See [Request Guild Members](https://docs.discord.com/developers/events/gateway-events#request-guild-members).
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

- `DISCORD_PRESENCE_ENABLED=false` — default kill switch. Set to `true` only after policy clearance and after the bot/worker secrets are configured. In the free setup, this starts the worker as a child of the web service.
- `DISCORD_BOT_TOKEN` — Discord bot token, secret.
- `DISCORD_PRESENCE_GUILD_ID` — the shared Discord server ID.
- `DISCORD_PRESENCE_INGEST_SECRET` — 64-character random hex secret; required for signed internal worker requests.
- `DISCORD_PRESENCE_INVITE_URL` — optional HTTPS Discord invite URL shown in Studio.

### Presence worker

- `DISCORD_PRESENCE_ENABLED=true` — explicit activation switch; leave false until policy clearance and the service is ready.
- `DISCORD_BOT_TOKEN` — Discord bot token, secret.
- `DISCORD_PRESENCE_GUILD_ID` — the one shared Discord server ID.
- `SNOOZER_PRESENCE_URL` — `https://snoozer.uk` (no trailing slash).
- `DISCORD_PRESENCE_INGEST_SECRET` — same 64-character secret as the web service.

## Render worker

The default deployment runs the Discord Gateway worker as a child process alongside the Next.js web server on the existing free Render web service. `scripts/start.mjs` starts both processes when `DISCORD_PRESENCE_ENABLED=true`; when the flag is false, it starts only the web server. No Docker image, extra npm dependency or paid Background Worker is required for this sleep-and-wake setup.

Render's free web service can sleep after inactivity. `.github/workflows/keep-snoozer-awake.yml` sends an HTTP request to `https://snoozer.uk/` every 10 minutes. That request wakes the web service, which starts both Next.js and the Discord worker. The Gateway reconnect logic restores the Discord connection after a sleep/restart. GitHub scheduled workflows can be delayed or skipped, so this is best-effort rather than an always-on guarantee; presence updates can have gaps during sleep or wake-up.

The separate `render.presence-worker.yaml` remains an optional always-on Background Worker deployment for a future paid setup. It is not part of the free wake-up architecture and has not been provisioned.

The web service's Render start command remains `npm start`; the package script now invokes:

```bash
node scripts/start.mjs
```

## Rollout and acceptance

The application side can be built, migrated and CI-tested without the Discord token. Production provider acceptance requires:

- Discord Presence Intent enabled for the bot application
- Bot invited to the shared server and the server ID configured
- The worker deployed and reliably woken; the current free web-child worker is best-effort and can have gaps during Render sleep or delayed/skipped scheduled wake-ups
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
