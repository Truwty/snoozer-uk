# Discord Presence

**Reviewed:** 28 November 2026  
**Implementation:** Discord OAuth identity linking, per-profile public presence settings, a compact profile badge and a signed server-to-server ingest API are present in the current source.

## Runtime model

The current main web service starts the Next.js server first. When any of `DISCORD_SERVER_SETUP_ENABLED=true`, `DISCORD_BOT_ENABLED=true` or `DISCORD_PRESENCE_ENABLED=true`, `scripts/start.mjs` waits for `/health/live` and then launches `workers/discord-presence/worker.mjs` as a child process. Server setup uses the standard `GUILDS` intent. The community bot additionally requests the privileged `GUILD_MEMBERS` intent for automatic welcome and server-boost events; turn that intent on in the Discord Developer Portal before enabling the community bot. Presence separately requires its URL, HMAC secret and privileged Presence intent. If the worker exits, the website remains available. The GitHub Actions keep-awake workflow pings the public homepage every ten minutes on the Render Free service; this is a best-effort wake-up workaround, not an always-on guarantee.

`render.presence-worker.yaml` describes an alternative standalone paid background worker deployment. Do not run that worker and the embedded child process against the same bot credentials at the same time: doing so can create two Gateway connections and duplicate ingestion. Choose one operating model deliberately.

## Verification status

Source tests cover signature validation, strict message schemas, data minimisation, subscription refresh, targeted member snapshots and offline/error fallback. Previous hosted diagnostics confirmed that the worker connected to the configured Discord guild and ingested a targeted snapshot. A real consenting account transition through Online, Idle and Do Not Disturb must be checked before claiming every live status transition is accepted.

The existing Terms and Privacy documentation discloses Discord API data use. Any additional Discord policy confirmation or legal review must be recorded separately; do not claim Discord has endorsed Snoozer unless written evidence exists.


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
3. Turn on **Server Members Intent** in **Bot → Privileged Gateway Intents** when `DISCORD_BOT_ENABLED=true`. This is required for member-join welcomes and boost thank-you messages. Turn on **Presence Intent** only when Presence collection is separately approved and enabled. Message Content is not required and must remain off.
4. Invite the bot to the single shared Snoozer Discord server with the `bot` and `applications.commands` scopes. The server setup, welcome/boost messages, tickets and moderation features need **Manage Channels**, **Manage Roles**, **View Channels**, **Send Messages**, **Embed Links**, **Read Message History**, **Kick Members**, **Ban Members** and **Moderate Members**. Give the bot role these permissions and place it above all Snoozer-managed roles and any members it must moderate. The combined permission bitfield is `1099780148246`. The bot runs a startup permission preflight and logs any missing permission; it does not grant itself permissions.
5. Copy the server ID with Discord Developer Mode enabled. This becomes `DISCORD_PRESENCE_GUILD_ID`.
6. Publish the server invite in `DISCORD_PRESENCE_INVITE_URL` so creators know where they must be members.
7. Keep the bot token private. Never put it in GitHub, source code, browser configuration or ChatGPT messages.

## One-time Snoozer server setup

The bot cannot create a brand-new Discord guild. Create the Snoozer server in Discord first, invite the bot to it, and configure that server ID as `DISCORD_PRESENCE_GUILD_ID`.

When the Discord worker starts with `DISCORD_SERVER_SETUP_ENABLED=true`, it registers a server-scoped `/snoozer-setup` application command in that configured guild. The command is restricted to members with the Discord **Administrator** permission and requires the explicit `confirm: true` option. Setup-only mode uses the `GUILDS` intent; it does not require Message Content or the Guild Members privileged intent. When `DISCORD_BOT_ENABLED=true`, the community bot separately requests Guild Members Intent for welcome and boost event handling.

The command creates or reconciles 14 roles: `Snoozer Admin`, `Senior Moderator`, `Moderator`, `Community Manager`, `Support Manager`, `Support Team`, `Ticket Support`, `Developer`, `Event Host`, `Community Helper`, `Premium`, `Creator`, `Member` and `Bots`. It also creates/updates the START HERE, SNOOZER UPDATES, COMMUNITY, SUPPORT & FEEDBACK, TICKETS, STAFF HQ and INTERNAL categories, their channels, read-only announcement areas, private staff areas and starter posts. The existing channel IDs you supplied are treated as authoritative: `1576098516189708379` becomes `#welcome`, `1576098524607553738` becomes `#changelog`, and `1576098525937270835` becomes `#service-status`. The repair process renames and moves those existing channels into the right sections rather than making duplicates. It creates `#server-boosts`, the `TICKETS` category and its `#open-a-ticket` entry channel. Account-specific support is directed to the Help Centre; users are told not to share passwords or payment information in Discord.

The hidden `INTERNAL` category contains `#snoozer-setup-state`. Its channel topic stores `SNOOZER_SERVER_SETUP_COMPLETE:v1` after every setup step succeeds. A later invocation checks this marker and makes no changes. If a request fails before completion, the command can be retried: existing roles and channels are reused and existing messages are checked for their setup footer. The one-time setup command itself does not remove channels, roles or messages. The marker channel is retained by the full reset and must not be deleted, because it records whether the one-time setup has already completed.

The initial setup command does not assign roles to people, sync Premium subscriptions or enable Discord's native AutoMod. Assign staff and cosmetic roles manually after setup. Run `/snoozer-reconcile` as an Administrator to create missing roles/categories/channels and reconcile Snoozer-managed role permissions, channel topics, channel names, category placement and overwrites without deleting existing channels or messages. This is the non-destructive command for later layout repairs. `/snoozer-repair` is retired.

The separate `/snoozer-rebuild-server` command is destructive: it backs up the current configuration, removes replaceable channels and custom roles, and recreates the approved Snoozer layout. Discord's Community Rules/Guidelines and Community Updates channels cannot be deleted; the bot also retains configured system/safety/AFK destinations, `#snoozer-setup-state`, and the channel where the rebuild was invoked. A Discord 50074 response is treated as a required channel to preserve, not as a reset failure. The configuration backup does not contain message history. Other unexpected deletion failures stop the rebuild before the new layout is created. Presence can remain disabled; welcome/boost event handling does not collect Discord presence.

The command is available while `DISCORD_SERVER_SETUP_ENABLED=true` and the worker is running. It does not require `DISCORD_PRESENCE_ENABLED`, the Presence intent, `SNOOZER_PRESENCE_URL` or the HMAC secret. It registers against `DISCORD_PRESENCE_GUILD_ID`; do not point the same bot process at a different guild to provision a second server.

Discord's 10 June 2026 privileged-intent rules use the number of unique users who can access the app across all installed servers, not the number of servers. Apps accessible to fewer than 10,000 users may enable Presence Intent using the Developer Portal toggle. At 10,000 users, Discord notifies the owner and requires a privileged-intent review request within 90 days; apps granted access through review must reapply annually when notified. Check the Developer Portal for the app's current eligibility and any review notice before launch. These intent-access rules do not resolve the separate policy question about displaying Discord API Data inside Snoozer's wider paid SaaS; obtain written confirmation from Discord before enabling public presence.

## Environment

Generate one shared signing secret:

```bash
openssl rand -hex 32
```

Set the same value in the Snoozer web service and the worker.

### Snoozer web service

- `DISCORD_BOT_ENABLED=true` — enables the community bot, including tickets, bug/suggestion submissions, moderation commands, live status lookup and best-effort status change announcements. This does not enable Presence collection.
- `DISCORD_SERVER_SETUP_ENABLED=false` — turn this off after the one-time server provisioning command is no longer needed. `/snoozer-reconcile` remains available for non-destructive repairs and `/snoozer-rebuild-server` is the separately confirmed full reset.
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

The default deployment can run the Discord Gateway worker as a child process alongside the Next.js web server on the existing free Render web service. `scripts/start.mjs` starts the worker when `DISCORD_SERVER_SETUP_ENABLED=true`, `DISCORD_BOT_ENABLED=true` or `DISCORD_PRESENCE_ENABLED=true`. Setup-only and community-bot-only modes do not send presence data to Snoozer. No Docker image, extra npm dependency or paid Background Worker is required for this sleep-and-wake setup.

Render's free web service can sleep after inactivity. `.github/workflows/keep-snoozer-awake.yml` sends an HTTP request to `https://snoozer.uk/` every 10 minutes. That request wakes the web service, which starts both Next.js and the Discord worker. The Gateway reconnect logic restores the Discord connection after a sleep/restart. GitHub scheduled workflows can be delayed or skipped, so this is best-effort rather than an always-on guarantee; presence updates can have gaps during sleep or wake-up.

The separate `render.presence-worker.yaml` remains an optional always-on Background Worker deployment for a future paid setup. It is not part of the free wake-up architecture and has not been provisioned.

The web service's Render start command remains `npm start`; the package script now invokes:

```bash
node scripts/start.mjs
```

## Snoozer community bot

Set `DISCORD_BOT_ENABLED=true` in the main Render web service environment to register the community commands in the configured guild. Keep `DISCORD_PRESENCE_ENABLED=false` unless Discord Presence has been separately approved and configured. The bot upserts each Snoozer command by name during registration, so restarts update existing commands without deleting unrelated commands belonging to the same Discord application.

Available commands are `/snoozer-help`, `/snoozer-status`, `/snoozer-ticket`, `/snoozer-ticket-close`, `/snoozer-bug`, `/snoozer-suggest` and `/snoozer-report`. Staff commands are `/snoozer-changelog` (requires Manage Messages), `/snoozer-warn`, `/snoozer-timeout`, `/snoozer-kick`, `/snoozer-ban` and Administrator-only `/snoozer-repair`.

The `TICKETS` section contains a public read-only `#open-a-ticket` guide. Members run `/snoozer-ticket` to create a private text channel under `TICKETS`; it is visible only to the ticket owner, `Snoozer Admin`, `Senior Moderator`, `Moderator`, `Support Manager`, `Support Team`, `Ticket Support` and the bot. Each member can have one open ticket at a time. The opener or staff can close a ticket; closing locks the owner's ability to send messages but preserves the transcript. Staff receive a summary in `#support-queue`. Members can submit bug reports and ideas into the existing feedback channels, or open a private moderation report under STAFF HQ. Reports are visible to the reporter and moderation staff, and a summary is written to `#moderation-log`.

Moderation actions require the corresponding Discord permission, pass a reason to Discord's audit log, and write a record to `#moderation-log`. Warning delivery by DM is best-effort because members can disable server DMs. Discord's native AutoMod and Community onboarding/rules screening remain configured in Discord itself, not by this worker.

`/snoozer-status` reads the public JSON snapshot from `https://status.snoozer.uk/api/status`. The worker checks that feed every minute and posts a message to the configured service-status channel (`1576098525937270835`) when the overall status changes. This is best-effort: a sleeping/restarting free Render service cannot guarantee instant incident announcements. The command itself fetches the latest status on demand. New members and returning members who rejoin receive an automatic welcome in channel `1576098516189708379`. A new server boost triggers `Thanks @User for boosting the server!` in `#server-boosts`. Established boosts are seeded from the Gateway's initial member data to avoid greeting existing boosters as new ones after a normal restart. `/snoozer-changelog` publishes a formatted release note to channel `1576098524607553738` for members with Manage Messages or Administrator permission.

`/snoozer-repair` is a separate Administrator-only reconciliation command. It creates/updates the planned roles and categories, applies channel names/topics/placements/overwrites, and targets the three configured channel IDs above. It does not delete channels, roles or user content. Verify the three channel IDs belong to the configured guild before running it, and put the bot's role above all Snoozer-managed roles so Discord permits it to manage them.

## Rollout and acceptance

The application side can be built and CI-tested without the Discord token. Production provider acceptance requires:

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
- [Discord application commands](https://docs.discord.com/developers/interactions/application-commands)
- [Discord guild member and moderation API](https://docs.discord.com/developers/resources/guild)
- [Discord channel permissions](https://docs.discord.com/developers/resources/channel)
- [Discord privileged intent access](https://support-dev.discord.com/hc/en-us/articles/40281523410967-Changes-to-Privileged-Intent-Access-for-Discord-Apps)
- [Discord Developer Terms](https://discord.com/developers/docs/policies-and-agreements/developer-terms-of-service)
- [Supabase Auth identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking)
- [Render Background Workers](https://render.com/docs/background-workers)
