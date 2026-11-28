import { createHmac, randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { DiscordApiClient, DiscordGuildSetup, hasAdministratorPermission, SNOOZER_SETUP_COMMAND } from "./server-setup.mjs";
import {
  DISCORD_COMMUNITY_COMMANDS,
  DISCORD_COMMUNITY_COMMAND_NAMES,
  DiscordCommunityBot,
  SERVICE_STATUS_POLL_MS,
} from "./community-bot.mjs";
import { DiscordStore } from "./discord-store.mjs";
import { DiscordCommunityPanels, SNOOZER_REBUILD_COMMAND, SNOOZER_RESTORE_COMMAND, SNOOZER_MEMBER_COMMANDS, SNOOZER_ADMIN_COMMANDS } from "./community-panels.mjs";
import { DiscordSecurityGuard } from "./security-guard.mjs";

const GUILDS_INTENT = 1 << 0;
const GUILD_MEMBERS_INTENT = 1 << 1;
const GUILD_MODERATION_INTENT = 1 << 2;
const GUILD_EXPRESSIONS_INTENT = 1 << 3;
const GUILD_INTEGRATIONS_INTENT = 1 << 4;
const GUILD_WEBHOOKS_INTENT = 1 << 5;
const GUILD_INVITES_INTENT = 1 << 6;
const GUILD_VOICE_STATES_INTENT = 1 << 7;
const GUILD_MESSAGES_INTENT = 1 << 9;
const GUILD_MESSAGE_REACTIONS_INTENT = 1 << 10;
const GUILD_SCHEDULED_EVENTS_INTENT = 1 << 16;
const AUTO_MODERATION_CONFIGURATION_INTENT = 1 << 20;
const AUTO_MODERATION_EXECUTION_INTENT = 1 << 21;
const GUILD_PRESENCES_INTENT = 1 << 8;
const SNAPSHOT_REFRESH_MS = 5 * 60_000;
const SUBSCRIPTION_REFRESH_MS = 60_000;
const HEARTBEAT_INTERVAL_MS = 30_000;
const MAX_USER_IDS_PER_REQUEST = 100;

function cleanText(value, max) {
  if (typeof value !== "string") return null;
  const result = value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max);
  return result || null;
}

const activityTypes = new Map([
  [0, "playing"],
  [1, "streaming"],
  [2, "listening"],
  [3, "watching"],
  [5, "competing"],
]);

export function normaliseGatewayPresence(discordUserId, presence, observedAt = new Date().toISOString(), fields = {}) {
  if (!/^[1-9][0-9]{16,19}$/.test(discordUserId)) return null;
  const status = presence?.status === "invisible" ? "offline" : presence?.status;
  if (!["online", "idle", "dnd", "offline"].includes(status)) return null;

  const showStatus = fields.showStatus ?? true;
  const showActivity = fields.showActivity ?? true;
  const showCustomStatus = fields.showCustomStatus ?? false;
  const activities = Array.isArray(presence?.activities) ? presence.activities.slice(0, 12) : [];
  let customStatus = null;
  let activity = null;
  for (const item of activities) {
    if (!item || typeof item !== "object") continue;
    if (item.type === 4) {
      if (showCustomStatus) customStatus ??= cleanText(item.state, 128);
      continue;
    }
    if (!showActivity) continue;
    const type = activityTypes.get(item.type);
    const name = cleanText(item.name, 100);
    if (!type || !name || activity) continue;
    activity = {
      type,
      name,
      details: cleanText(item.details, 120),
      state: cleanText(item.state, 120),
    };
  }
  if (status === "offline") {
    activity = null;
    customStatus = null;
  }
  return {
    type: "presence",
    eventId: randomUUID(),
    discordUserId,
    status: showStatus ? status : null,
    activity: showActivity ? activity : null,
    customStatus: showCustomStatus ? customStatus : null,
    observedAt,
  };
}

export function signInternalRequest(secret, payload, now = Date.now()) {
  const body = JSON.stringify(payload);
  const timestamp = String(now);
  const signature = createHmac("sha256", secret).update(timestamp + "." + body).digest("hex");
  return {
    body,
    headers: {
      "content-type": "application/json",
      "x-snoozer-timestamp": timestamp,
      "x-snoozer-signature": "sha256=" + signature,
    },
  };
}

function chunks(values, size) {
  const result = [];
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
  return result;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function buildGuildCommands(config) {
  const commands = [];
  // The old one-time setup command is only exposed when the full community bot is disabled.
  if (config.serverSetupEnabled && !config.botEnabled) commands.push(SNOOZER_SETUP_COMMAND);
  if (config.botEnabled) {
    commands.push(
      ...DISCORD_COMMUNITY_COMMANDS,
      SNOOZER_REBUILD_COMMAND,
      SNOOZER_RESTORE_COMMAND,
      ...SNOOZER_MEMBER_COMMANDS,
      ...SNOOZER_ADMIN_COMMANDS,
    );
  }
  const names = commands.map(command => command.name);
  if (new Set(names).size !== names.length) {
    throw new Error("The Snoozer Discord command list contains duplicate command names.");
  }
  return commands;
}

export class DiscordPresenceWorker {
  constructor(config, dependencies = {}) {
    this.config = config;
    this.WebSocketImpl = dependencies.WebSocketImpl ?? globalThis.WebSocket;
    this.fetcher = dependencies.fetcher ?? globalThis.fetch;
    this.logger = dependencies.logger ?? console;
    this.discordFetcher = dependencies.discordFetcher ?? globalThis.fetch;
    this.statusFetcher = dependencies.statusFetcher ?? globalThis.fetch;
    this.communityBot = null;
    this.communityPanels = null;
    this.discordStore = null;
    this.securityGuard = null;
    this.activityTimer = null;
    this.activityBuffer = new Map();
    this.voiceSessions = new Map();
    this.communityStatusTimer = null;
    this.discordApi = new DiscordApiClient(config.token, this.discordFetcher, { logger: this.logger });
    this.applicationId = null;
    this.botUserId = null;
    this.serverSetupRunning = false;
    this.subscriptions = new Map();
    this.pendingChunks = new Map();
    this.socket = null;
    this.heartbeatTimer = null;
    this.subscriptionTimer = null;
    this.snapshotTimer = null;
    this.workerHeartbeatTimer = null;
    this.reconnectTimer = null;
    this.pendingSnapshotIds = new Set();
    this.heartbeatInterval = 45_000;
    this.heartbeatOutstanding = false;
    this.connected = false;
    this.guildReady = false;
    this.guildKnown = false;
    this.stopped = false;
    this.sequence = null;
    this.sessionId = null;
    this.resumeUrl = null;
    this.reconnectAttempt = 0;
    this.snapshotRunning = false;
  }

  async logServerEvent(event = {}) {
    const channelId = this.communityPanels?.resources?.bot_logs;
    if (!/^[1-9][0-9]{16,19}$/.test(channelId ?? "")) return false;
    const clean = (value, max = 500) => typeof value === "string"
      ? value.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ").replace(/[ \t]+/g, " ").trim().slice(0, max)
      : "";
    const title = clean(event.title, 240) || "Server activity";
    const description = clean(event.description, 3500) || "A server event was received.";
    const severity = ["warning", "critical", "error"].includes(event.severity) ? event.severity : "info";
    const colour = severity === "critical" || severity === "error" ? 0xd65a68 : severity === "warning" ? 0xd5a33c : 0x596579;
    try {
      await this.discordApi.request("/channels/" + channelId + "/messages", {
        method: "POST",
        body: {
          embeds: [{
            title,
            description,
            color: colour,
            timestamp: new Date().toISOString(),
            footer: { text: "Snoozer · Server activity log" },
          }],
          allowed_mentions: { parse: [] },
        },
      });
      return true;
    } catch (error) {
      this.logger.warn("[discord-presence] bot log delivery failed:", error?.message ?? error);
      return false;
    }
  }

  async post(payload) {
    const signed = signInternalRequest(this.config.secret, payload);
    const response = await this.fetcher(this.config.baseUrl + "/api/v1/internal/discord/presence", {
      method: "POST",
      headers: signed.headers,
      body: signed.body,
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error("Snoozer presence endpoint returned " + response.status);
    return response.status === 204 ? null : response.json();
  }

  async heartbeat(connected, guildReady) {
    try {
      await this.post({ type: "heartbeat", connected, guildReady });
    } catch (error) {
      this.logger.error("[discord-presence] heartbeat delivery failed:", error?.message ?? error);
    }
  }

  async refreshSubscriptions() {
    try {
      const result = await this.post({ type: "subscriptions" });
      const entries = Array.isArray(result?.subscriptions) ? result.subscriptions : [];
      const next = new Map();
      for (const entry of entries) {
        if (!entry || !/^[1-9][0-9]{16,19}$/.test(entry.discordUserId)
          || typeof entry.showStatus !== "boolean"
          || typeof entry.showActivity !== "boolean"
          || typeof entry.showCustomStatus !== "boolean") continue;
        next.set(entry.discordUserId, {
          showStatus: entry.showStatus,
          showActivity: entry.showActivity,
          showCustomStatus: entry.showCustomStatus,
        });
      }
      const changed = [];
      for (const [id, fields] of next) {
        const previous = this.subscriptions.get(id);
        if (!previous || previous.showStatus !== fields.showStatus
          || previous.showActivity !== fields.showActivity
          || previous.showCustomStatus !== fields.showCustomStatus) changed.push(id);
      }
      this.subscriptions = next;
      this.logger.info(`[discord-presence] subscription refresh succeeded (${next.size} opted-in Discord account(s)).`);
      if (changed.length && this.guildReady) void this.requestSnapshots(changed);
    } catch (error) {
      this.logger.error("[discord-presence] subscription refresh failed:", error?.message ?? error);
    }
  }

  send(payload) {
    if (this.socket?.readyState !== 1) return false;
    this.socket.send(JSON.stringify(payload));
    return true;
  }

  subscribedDiscordUserIds() {
    return [...this.subscriptions.keys()];
  }

  async sendPresence(discordUserId, presence) {
    const fields = this.subscriptions.get(discordUserId);
    if (!fields) return;
    const event = normaliseGatewayPresence(discordUserId, presence, new Date().toISOString(), fields);
    if (!event) return;
    try {
      await this.post(event);
    } catch (error) {
      this.logger.error("[discord-presence] event delivery failed:", error?.message ?? error);
    }
  }

  async clearPresence(discordUserId) {
    if (!this.subscriptions.has(discordUserId)) return;
    try {
      await this.post({ type: "clear", eventId: randomUUID(), discordUserId });
      this.logger.info("[discord-presence] Cleared stale presence because a subscribed account was not found in the shared guild.");
    } catch (error) {
      this.logger.error("[discord-presence] stale membership cleanup failed:", error?.message ?? error);
    }
  }

  async requestSnapshots(userIds) {
    const requestedIds = [...new Set(userIds)].filter(id => this.subscriptions.has(id));
    if (requestedIds.length === 0) return;
    if (this.snapshotRunning) {
      for (const id of requestedIds) this.pendingSnapshotIds.add(id);
      return;
    }
    if (!this.guildReady || this.socket?.readyState !== 1) {
      this.logger.warn("[discord-presence] Targeted snapshot was skipped because the configured guild is not ready.");
      return;
    }
    this.snapshotRunning = true;
    this.logger.info(`[discord-presence] Requesting targeted presence snapshots for ${requestedIds.length} opted-in account(s).`);
    try {
      for (const batch of chunks(requestedIds, MAX_USER_IDS_PER_REQUEST)) {
        if (!this.guildReady || this.socket?.readyState !== 1) break;
        const nonce = randomUUID().replaceAll("-", "").slice(0, 32);
        const completed = new Promise(resolve => {
          const timer = setTimeout(() => {
            if (this.pendingChunks.delete(nonce)) {
              this.logger.warn(`[discord-presence] Targeted presence snapshot timed out (requested=${batch.length}; no member chunk received).`);
            }
            resolve();
          }, 15_000);
          this.pendingChunks.set(nonce, { ids: new Set(batch), resolve: () => { clearTimeout(timer); resolve(); } });
        });
        const sent = this.send({ op: 8, d: { guild_id: this.config.guildId, user_ids: batch, presences: true, nonce } });
        if (!sent) {
          const pending = this.pendingChunks.get(nonce);
          if (pending) {
            this.pendingChunks.delete(nonce);
            pending.resolve();
          }
          this.logger.warn("[discord-presence] Targeted presence snapshot could not be sent because the Gateway socket closed.");
        }
        await completed;
        await delay(1_200);
      }
    } finally {
      this.snapshotRunning = false;
      const queued = [...this.pendingSnapshotIds];
      this.pendingSnapshotIds.clear();
      if (queued.length && this.guildReady && !this.stopped) void this.requestSnapshots(queued);
    }
  }

  async handleChunk(data) {
    const pending = this.pendingChunks.get(data?.nonce);
    if (!pending) return;
    const presences = new Map((Array.isArray(data.presences) ? data.presences : [])
      .filter(item => item?.user?.id)
      .map(item => [item.user.id, item]));
    const members = Array.isArray(data.members) ? data.members : [];
    let subscribedMembers = 0;
    for (const member of members) {
      const id = member?.user?.id;
      if (!id || !pending.ids.has(id)) continue;
      subscribedMembers += 1;
      const presence = presences.get(id);
      await this.sendPresence(id, presence ?? { status: "offline", activities: [] });
    }
    let notFound = 0;
    for (const id of Array.isArray(data.not_found) ? data.not_found : []) {
      if (pending.ids.has(id)) {
        notFound += 1;
        await this.clearPresence(id);
      }
    }
    this.logger.info(`[discord-presence] Targeted member chunk received (members=${members.length}; presences=${presences.size}; subscribed_matches=${subscribedMembers}; not_found=${notFound}; chunk=${(data.chunk_index ?? 0) + 1}/${data.chunk_count ?? 1}).`);
    if ((data.chunk_index ?? 0) + 1 >= (data.chunk_count ?? 1)) {
      this.pendingChunks.delete(data.nonce);
      pending.resolve();
    }
  }

  async registerServerSetupCommand() {
    const [botUser, application] = await Promise.all([
      this.discordApi.request("/users/@me"),
      this.discordApi.request("/oauth2/applications/@me"),
    ]);
    if (!botUser?.id || !/^[1-9][0-9]{16,19}$/.test(botUser.id)) {
      throw new Error("Discord did not return a valid bot user ID while registering guild commands.");
    }
    if (!application?.id || !/^[1-9][0-9]{16,19}$/.test(application.id)) {
      throw new Error("Discord did not return a valid application ID while registering guild commands.");
    }
    this.botUserId = botUser.id;
    this.applicationId = application.id;
    const commands = buildGuildCommands(this.config);
    if (commands.length === 0) throw new Error("No Discord guild commands are enabled.");
    const commandPath = "/applications/" + this.applicationId + "/guilds/" + this.config.guildId + "/commands";
    // Guild command bulk overwrite also removes obsolete commands left by older bot versions.
    await this.discordApi.request(commandPath, { method: "PUT", body: commands });
    if (this.config.botEnabled) {
      this.discordStore = new DiscordStore({
        url: this.config.supabaseUrl,
        serviceKey: this.config.supabaseServiceRoleKey,
      }, { fetcher: this.fetcher });
      this.communityPanels = new DiscordCommunityPanels({
        guildId: this.config.guildId,
        botUserId: this.botUserId,
        applicationId: this.applicationId,
      }, { api: this.discordApi, store: this.discordStore, logger: this.logger, logEvent: event => this.logServerEvent(event) });
      await this.communityPanels.refreshResources();

      const resources = this.communityPanels.resources;
      const roleIds = this.communityPanels.roleIds;
      this.communityBot = new DiscordCommunityBot({
        guildId: this.config.guildId,
        botUserId: this.botUserId,
        applicationId: this.applicationId,
        channelIds: {
          welcome: resources.welcome,
          changelog: resources.changelog,
          serviceStatus: resources.service_status,
          serverBoosts: resources.server_boosts,
          ticketQueue: resources.ticket_queue,
          moderationLog: resources.moderation_log,
        },
        categoryIds: {
          tickets: resources.category_tickets,
          teamHq: resources.category_team_hq,
        },
        roleIds,
      }, { api: this.discordApi, fetcher: this.statusFetcher, logger: this.logger, logEvent: event => this.logServerEvent(event) });
      this.communityPanels.onResourcesUpdated = (resourceMap, nextRoleIds) => {
        if (!this.communityBot) return;
        this.communityBot.roleIds = nextRoleIds;
        this.communityBot.channelIds = {
          ...this.communityBot.channelIds,
          welcome: resourceMap.welcome,
          changelog: resourceMap.changelog,
          serviceStatus: resourceMap.service_status,
          serverBoosts: resourceMap.server_boosts,
          goodbye: resourceMap.goodbye,
          ticketQueue: resourceMap.ticket_queue,
          moderationLog: resourceMap.moderation_log,
          bugReports: resourceMap.bug_reports,
          suggestions: resourceMap.suggestions,
        };
        this.communityBot.categoryIds = {
          tickets: resourceMap.category_tickets,
          teamHq: resourceMap.category_team_hq,
        };
        this.communityBot.channelIds = {
          ...this.communityBot.channelIds,
          events:resourceMap.events,giveaways:resourceMap.giveaways,
          securityAlerts:resourceMap.security_alerts,appealsQueue:resourceMap.appeals_queue,
        };
      };
      // Refresh after both consumers exist so the bot and panel handlers use one current resource registry.
      await this.communityPanels.refreshResources();
      this.securityGuard = new DiscordSecurityGuard({
        guildId:this.config.guildId,botUserId:this.botUserId,
      }, {
        api:this.discordApi,store:this.discordStore,logger:this.logger,
        getResources:()=>this.communityPanels?.resources??{},
        getRoleIds:()=>this.communityPanels?.roleIds??{},
      });
      try { await this.securityGuard.initialise(); }
      catch(error) { this.logger.error("[discord-presence] security monitor initialisation failed:",error?.message??error); }
      this.securityGuard.start();
      this.communityPanels.start();
      this.activityTimer=setInterval(()=>void this.flushActivity(),60_000);
      this.activityTimer.unref?.();
      try {
        await this.communityBot.preflightPermissions();
      } catch (error) {
        this.logger.warn("[discord-presence] bot permission preflight could not complete:", error?.message ?? error);
      }
      await this.communityBot.primeStatusBaseline();
      this.communityStatusTimer = setInterval(() => void this.communityBot?.checkAndAnnounceStatus(), SERVICE_STATUS_POLL_MS);
      this.logger.info("[discord-presence] Registered " + DISCORD_COMMUNITY_COMMANDS.length + " community commands and the button-first rebuild entry point.");
    }
    if (this.config.serverSetupEnabled) {
      this.logger.info("[discord-presence] Registered the administrator-only /snoozer-setup command.");
    }
  }

  async sendSetupInteractionResponse(interaction, payload, editOriginal = false) {
    const path = editOriginal
      ? "/webhooks/" + this.applicationId + "/" + interaction.token + "/messages/@original"
      : "/interactions/" + interaction.id + "/" + interaction.token + "/callback";
    return this.discordApi.request(path, {
      method: editOriginal ? "PATCH" : "POST",
      body: payload,
      auth: false,
    });
  }

  async handleServerSetupInteraction(interaction) {
    if (interaction.guild_id !== this.config.guildId || interaction.application_id !== this.applicationId) return;

    const reply = async content => this.sendSetupInteractionResponse(interaction, {
      type: 4,
      data: { content, flags: 64 },
    });
    let ownsLock = false;
    let deferred = false;

    try {
      if (!hasAdministratorPermission(interaction.member?.permissions)) {
        await reply("Only a server administrator can run the Snoozer server setup.");
        return;
      }

      const confirm = interaction.data?.options?.find(option => option.name === "confirm")?.value;
      if (confirm !== true) {
        await reply("Nothing was changed. Run /snoozer-setup again and set confirm to true when you are ready.");
        return;
      }

      if (this.serverSetupRunning) {
        await reply("The Snoozer server setup is already running. Please do not start another run.");
        return;
      }

      this.serverSetupRunning = true;
      ownsLock = true;
      await this.sendSetupInteractionResponse(interaction, { type: 5, data: { flags: 64 } });
      deferred = true;
      const result = await new DiscordGuildSetup({
        token: this.config.token,
        guildId: this.config.guildId,
        botUserId: this.botUserId,
      }, { api: this.discordApi, logger: this.logger }).run();

      const content = result.alreadyComplete
        ? "Snoozer server setup has already been completed" + (result.completedAt ? " (" + result.completedAt + ")" : "") + ". No changes were made."
        : "Snoozer server setup completed. Created " + result.rolesCreated + " roles, " + result.categoriesCreated + " categories, " + result.channelsCreated + " channels and " + result.messagesCreated + " starter posts. Existing server items were preserved. This command is now locked by the private setup marker.";
      await this.sendSetupInteractionResponse(interaction, { content }, true);
      this.logger.info("[discord-presence] " + content);
    } catch (error) {
      this.logger.error("[discord-presence] one-time server setup failed:", error?.message ?? error);
      const content = "Snoozer server setup did not finish. No completion marker was written, so the command can be safely retried after fixing this issue. " + String(error?.message ?? "Unknown Discord API error").slice(0, 900);
      try {
        if (deferred) await this.sendSetupInteractionResponse(interaction, { content }, true);
        else await reply(content);
      } catch (responseError) {
        this.logger.error("[discord-presence] failed to report server setup outcome:", responseError?.message ?? responseError);
      }
    } finally {
      if (ownsLock) this.serverSetupRunning = false;
    }
  }

  recordActivity(userId,messages=0,voiceMinutes=0) {
    if(!/^[1-9][0-9]{16,19}$/.test(userId??""))return;
    const current=this.activityBuffer.get(userId)??{messages:0,voiceMinutes:0};
    current.messages+=messages;current.voiceMinutes+=voiceMinutes;
    this.activityBuffer.set(userId,current);
  }

  async flushActivity() {
    if(!this.discordStore||this.activityBuffer.size===0)return;
    const pending=[...this.activityBuffer.entries()];
    this.activityBuffer.clear();
    for(const [userId,counts] of pending){
      try{await this.discordStore.activityIncrement(this.config.guildId,userId,counts.messages,counts.voiceMinutes);}
      catch(error){
        const current=this.activityBuffer.get(userId)??{messages:0,voiceMinutes:0};
        current.messages+=counts.messages;current.voiceMinutes+=counts.voiceMinutes;
        this.activityBuffer.set(userId,current);
        this.logger.error("[discord-presence] activity counter flush failed:",error?.message??error);
      }
    }
  }

  async handleVoiceStateUpdate(state) {
    const userId=state.user_id??state.member?.user?.id;
    if(!/^[1-9][0-9]{16,19}$/.test(userId??"")||state.member?.user?.bot)return;
    const previous=this.voiceSessions.get(userId);
    const nextChannel=state.channel_id??null;
    if(previous&&previous.channelId!==nextChannel){
      const minutes=Math.floor(Math.max(0,Date.now()-previous.joinedAt)/60_000);
      if(minutes>0)this.recordActivity(userId,0,minutes);
      if(nextChannel){
        await this.logServerEvent({title:"Member moved voice channels",description:"Member: <@"+userId+">\nFrom: <#"+previous.channelId+">\nTo: <#"+nextChannel+">"});
      }else{
        await this.logServerEvent({title:"Member left voice",description:"Member: <@"+userId+">\nChannel: <#"+previous.channelId+">\nTime in voice: "+minutes+" minute(s)"});
      }
      this.voiceSessions.delete(userId);
    }else if(!previous&&nextChannel){
      await this.logServerEvent({title:"Member joined voice",description:"Member: <@"+userId+">\nChannel: <#"+nextChannel+">"});
    }
    if(nextChannel)this.voiceSessions.set(userId,{channelId:nextChannel,joinedAt:Date.now()});
  }

  async dispatch(event) {
    const data = event.d ?? {};
    switch (event.t) {
      case "READY":
        const readyGuilds = Array.isArray(data.guilds) ? data.guilds : [];
        const configuredGuildListed = readyGuilds.some(guild => guild?.id === this.config.guildId);
        this.logger.info(`[discord-presence] Discord Gateway READY received (${readyGuilds.length} guild(s) listed; configured server listed=${configuredGuildListed}).`);
        this.sessionId = data.session_id ?? null;
        this.resumeUrl = data.resume_gateway_url ?? null;
        this.reconnectAttempt = 0;
        break;
      case "RESUMED":
        this.connected = true;
        this.guildReady = this.guildKnown;
        if ((this.config.presenceEnabled !== false)) await this.heartbeat(true, this.guildReady);
        break;
      case "GUILD_CREATE":
        this.logger.info(`[discord-presence] Discord sent GUILD_CREATE (configured server match=${data.id === this.config.guildId}).`);
        if (data.id === this.config.guildId) {
          if (this.communityBot) this.communityBot.seedKnownBoosters(data.members);
          this.logger.info("[discord-presence] Connected to the configured shared Discord server.");
          this.connected = true;
          this.guildKnown = true;
          this.guildReady = true;
          if ((this.config.presenceEnabled !== false)) {
            await this.heartbeat(true, true);
            const initialPresences = Array.isArray(data.presences) ? data.presences : [];
            const subscribedInitialPresences = initialPresences.filter(presence => presence?.user?.id && this.subscriptions.has(presence.user.id));
            this.logger.info(`[discord-presence] Initial guild presence snapshot received (entries=${initialPresences.length}; opted_in_matches=${subscribedInitialPresences.length}).`);
            for (const presence of subscribedInitialPresences) await this.sendPresence(presence.user.id, presence);
            void this.requestSnapshots(this.subscribedDiscordUserIds());
          }
        }
        break;
      case "GUILD_DELETE":
        if (data.id === this.config.guildId) {
          this.logger.warn("[discord-presence] Bot was removed from or lost access to the configured shared server.");
          this.guildKnown = false;
          this.guildReady = false;
          if (!data.unavailable) {
            this.sessionId = null;
            this.sequence = null;
            this.resumeUrl = null;
          }
          if ((this.config.presenceEnabled !== false)) await this.heartbeat(this.connected, false);
        }
        break;
      case "PRESENCE_UPDATE":
        if (data.guild_id === this.config.guildId && data.user?.id && this.subscriptions.has(data.user.id)) {
          await this.sendPresence(data.user.id, data);
        }
        break;
      case "GUILD_MEMBER_ADD":
        if(data.guild_id===this.config.guildId){
          const userId=data.user?.id;
          await this.logServerEvent({title:"Member joined the server",description:"Member: "+(userId?"<@"+userId+">":"Unknown member")+"\nAccount: "+(data.user?.username??"unknown")});
          if(this.securityGuard)await this.securityGuard.handleMemberJoin(data);
          if(this.communityBot){
            await this.communityBot.welcomeMember(data);
            if(data.premium_since)await this.communityBot.handleMemberUpdate(data);
          }
        }
        break;
      case "GUILD_MEMBER_REMOVE":
        if(data.guild_id===this.config.guildId){
          const userId=data.user?.id;
          await this.logServerEvent({title:"Member left the server",description:"Member: "+(userId?"<@"+userId+">":"Unknown member")+"\nAccount: "+(data.user?.username??"unknown")});
          if(this.communityBot){
            try{await this.communityBot.goodbyeMember(data);}
            catch(error){this.logger.warn("[discord-presence] goodbye message failed:",error?.message??error);}
            this.communityBot.handleMemberRemove(data);
          }
        }
        break;
      case "GUILD_MEMBER_UPDATE":
        if(data.guild_id===this.config.guildId){
          if(Object.prototype.hasOwnProperty.call(data,"nick")||Array.isArray(data.roles)){
            await this.logServerEvent({title:"Member profile or roles updated",description:"Member: <@"+(data.user?.id??"unknown")+">\nNickname: "+(data.nick??"none")+"\nAssigned roles: "+(data.roles?.length??"not supplied")});
          }
          if(this.communityBot)await this.communityBot.handleMemberUpdate(data);
        }
        break;
      case "CHANNEL_CREATE":
      case "CHANNEL_UPDATE":
      case "CHANNEL_DELETE":
        if(data.guild_id===this.config.guildId){
          const action=event.t.replace("CHANNEL_","").toLowerCase();
          await this.logServerEvent({title:"Channel "+action,description:"Channel: "+(data.name??"unknown")+"\nID: "+(data.id??"unknown")+"\nType: "+(data.type??"unknown")+"\nParent: "+(data.parent_id?"<#"+data.parent_id+">":"none")});
        }
        break;
      case "GUILD_ROLE_CREATE":
      case "GUILD_ROLE_UPDATE":
        if(data.guild_id===this.config.guildId){
          const role=data.role??{};
          await this.logServerEvent({title:"Server role "+event.t.replace("GUILD_ROLE_","").toLowerCase(),description:"Role: "+(role.name??"unknown")+"\nID: "+(role.id??"unknown")+"\nPosition: "+(role.position??"unknown")});
        }
        break;
      case "GUILD_ROLE_DELETE":
        if(data.guild_id===this.config.guildId){
          await this.logServerEvent({title:"Server role deleted",description:"Role ID: "+(data.role_id??"unknown") ,severity:"warning"});
        }
        break;
      case "GUILD_BAN_ADD":
      case "GUILD_BAN_REMOVE":
        if(data.guild_id===this.config.guildId){
          const added=event.t==="GUILD_BAN_ADD";
          await this.logServerEvent({title:added?"Member banned":"Member unbanned",description:"Member: "+(data.user?.id?"<@"+data.user.id+">":"Unknown member")+"\nAccount: "+(data.user?.username??"unknown"),severity:added?"warning":"info"});
        }
        break;
      case "GUILD_MEMBERS_CHUNK":
        if(data.guild_id===this.config.guildId)await this.handleChunk(data);
        break;
      case "MESSAGE_CREATE":
        if(data.guild_id===this.config.guildId){
          if(data.author?.id&&!data.author.bot){
            this.recordActivity(data.author.id,1,0);
            await this.logServerEvent({title:"Message sent",description:"Member: <@"+data.author.id+">\nChannel: <#"+data.channel_id+">\nMessage ID: "+data.id+"\nAttachments: "+(data.attachments?.length??0)+" · embeds: "+(data.embeds?.length??0)});
          }
          if(this.securityGuard)await this.securityGuard.handleMessage(data);
        }
        break;
      case "MESSAGE_UPDATE":
        if(data.guild_id===this.config.guildId&&!data.author?.bot){
          await this.logServerEvent({title:"Message edited",description:"Member: "+(data.author?.id?"<@"+data.author.id+">":"Unknown author")+"\nChannel: <#"+data.channel_id+">\nMessage ID: "+data.id+"\nMessage contents are intentionally not copied into logs."});
        }
        break;
      case "MESSAGE_DELETE":
        if(data.guild_id===this.config.guildId){
          await this.logServerEvent({title:"Message deleted",description:"Channel: <#"+data.channel_id+">\nMessage ID: "+data.id+"\nAuthor ID: "+(data.author_id??"not supplied")});
        }
        break;
      case "MESSAGE_DELETE_BULK":
        if(data.guild_id===this.config.guildId){
          await this.logServerEvent({title:"Messages bulk deleted",description:"Channel: <#"+data.channel_id+">\nMessages removed: "+(data.ids?.length??0),severity:"warning"});
        }
        break;
      case "MESSAGE_REACTION_ADD":
      case "MESSAGE_REACTION_REMOVE":
        if(data.guild_id===this.config.guildId){
          const added=event.t==="MESSAGE_REACTION_ADD";
          const emoji=data.emoji?.name??"unknown";
          await this.logServerEvent({title:added?"Reaction added":"Reaction removed",description:"Member: "+(data.user_id?"<@"+data.user_id+">":"Unknown member")+"\nChannel: <#"+data.channel_id+">\nMessage ID: "+data.message_id+"\nEmoji: "+emoji});
        }
        break;
      case "MESSAGE_REACTION_REMOVE_ALL":
      case "MESSAGE_REACTION_REMOVE_EMOJI":
        if(data.guild_id===this.config.guildId){
          await this.logServerEvent({title:"Message reactions cleared",description:"Channel: <#"+data.channel_id+">\nMessage ID: "+data.message_id+"\nEmoji: "+(data.emoji?.name??"all reactions")});
        }
        break;
      case "INVITE_CREATE":
      case "INVITE_DELETE":
        if(data.guild_id===this.config.guildId){
          const created=event.t==="INVITE_CREATE";
          await this.logServerEvent({title:created?"Server invite created":"Server invite deleted",description:"Code: "+(data.code??"unknown")+"\nChannel: "+(data.channel_id?"<#"+data.channel_id+">":"unknown")+"\nInviter: "+(data.inviter?.id?"<@"+data.inviter.id+">":"unknown")});
        }
        break;
      case "GUILD_INTEGRATIONS_UPDATE":
      case "WEBHOOKS_UPDATE":
        if(data.guild_id===this.config.guildId){
          await this.logServerEvent({title:event.t==="WEBHOOKS_UPDATE"?"Server webhooks updated":"Server integrations updated",description:"A server integration or webhook configuration changed.",severity:"warning"});
        }
        break;
      case "GUILD_EMOJIS_UPDATE":
      case "GUILD_STICKERS_UPDATE":
        if(data.guild_id===this.config.guildId){
          const list=event.t==="GUILD_EMOJIS_UPDATE"?data.emojis:data.stickers;
          await this.logServerEvent({title:event.t==="GUILD_EMOJIS_UPDATE"?"Server emojis updated":"Server stickers updated",description:"Items currently present: "+(list?.length??"unknown")});
        }
        break;
      case "GUILD_UPDATE":
        if(data.id===this.config.guildId){
          await this.logServerEvent({title:"Server settings updated",description:"Server name: "+(data.name??"unchanged")+"\nVerification level: "+(data.verification_level??"not supplied")+"\nDefault notifications: "+(data.default_message_notifications??"not supplied")});
        }
        break;
      case "THREAD_CREATE":
      case "THREAD_UPDATE":
      case "THREAD_DELETE":
        if(data.guild_id===this.config.guildId){
          await this.logServerEvent({title:"Thread "+event.t.replace("THREAD_","").toLowerCase(),description:"Thread: "+(data.name??"unknown")+"\nID: "+(data.id??"unknown")+"\nParent channel: "+(data.parent_id?"<#"+data.parent_id+">":"unknown")});
        }
        break;
      case "GUILD_SCHEDULED_EVENT_CREATE":
      case "GUILD_SCHEDULED_EVENT_UPDATE":
      case "GUILD_SCHEDULED_EVENT_DELETE":
      case "GUILD_SCHEDULED_EVENT_USER_ADD":
      case "GUILD_SCHEDULED_EVENT_USER_REMOVE":
        if(data.guild_id===this.config.guildId){
          await this.logServerEvent({title:"Scheduled event "+event.t.replace("GUILD_SCHEDULED_EVENT_","").toLowerCase(),description:"Event: "+(data.name??data.guild_scheduled_event_id??data.id??"unknown")+"\nEvent ID: "+(data.id??data.guild_scheduled_event_id??"unknown")+"\nUser: "+(data.user_id?"<@"+data.user_id+">":"not applicable")});
        }
        break;
      case "STAGE_INSTANCE_CREATE":
      case "STAGE_INSTANCE_UPDATE":
      case "STAGE_INSTANCE_DELETE":
        if(data.guild_id===this.config.guildId){
          await this.logServerEvent({title:"Stage instance "+event.t.replace("STAGE_INSTANCE_","").toLowerCase(),description:"Stage channel: "+(data.channel_id?"<#"+data.channel_id+">":"unknown")+"\nTopic: "+(data.topic??"not supplied")});
        }
        break;
      case "VOICE_STATE_UPDATE":
        if(data.guild_id===this.config.guildId)await this.handleVoiceStateUpdate(data);
        break;
      case "INTERACTION_CREATE":
        if(data.guild_id===this.config.guildId){
          const actor=data.member?.user?.id??data.user?.id;
          const action=data.data?.name??data.data?.custom_id??"interaction";
          await this.logServerEvent({title:"Bot interaction",description:"Member: "+(actor?"<@"+actor+">":"unknown")+"\nAction: "+action+"\nChannel: "+(data.channel_id?"<#"+data.channel_id+">":"unknown")});
        }
        const panelCommandNames = new Set([
          SNOOZER_REBUILD_COMMAND.name,SNOOZER_RESTORE_COMMAND.name,
          ...SNOOZER_MEMBER_COMMANDS.map(command=>command.name),
          ...SNOOZER_ADMIN_COMMANDS.map(command=>command.name),
        ]);
        if (this.communityPanels && (data.type === 3 || data.type === 5
          || (data.type === 2 && panelCommandNames.has(data.data?.name)))) {
          await this.communityPanels.handle(data);
        } else if (data.type === 2 && data.data?.name === SNOOZER_SETUP_COMMAND.name) {
          await this.handleServerSetupInteraction(data);
        } else if (data.type === 2 && this.communityBot && DISCORD_COMMUNITY_COMMAND_NAMES.has(data.data?.name)) {
          await this.communityBot.handle(data);
        }
        break;
      case "GUILD_AUDIT_LOG_ENTRY_CREATE":
        if(data.guild_id===this.config.guildId){
          await this.logServerEvent({title:"Discord audit log event",description:"Action type: "+(data.action_type??"unknown")+"\nActor: "+(data.user_id?"<@"+data.user_id+">":"unknown")+"\nTarget ID: "+(data.target_id??"not supplied")+"\nAudit entry: "+(data.id??"unknown"),severity:"warning"});
          if(this.securityGuard)await this.securityGuard.handleAuditEntry(data);
        }
        break;
      case "AUTO_MODERATION_ACTION_EXECUTION":
        if(data.guild_id===this.config.guildId){
          await this.logServerEvent({title:"AutoMod action executed",description:"User: "+(data.user_id?"<@"+data.user_id+">":"unknown")+"\nChannel: "+(data.channel_id?"<#"+data.channel_id+">":"unknown")+"\nRule ID: "+(data.rule_id??"unknown")+"\nMessage ID: "+(data.message_id??"not supplied"),severity:"warning"});
          if(this.securityGuard)await this.securityGuard.handleAutoModeration(data);
        }
        break;
      case "RATE_LIMITED":
        this.logger.warn("[discord-presence] Discord rate-limited a Gateway request; snapshots will retry on the next refresh.");
        break;
      default:
        break;
    }
  }

  connect() {
    if (this.stopped) return;
    if (!this.WebSocketImpl) throw new Error("This worker requires Node.js with the built-in WebSocket client.");
    const base = this.sessionId && this.resumeUrl ? this.resumeUrl : "wss://gateway.discord.gg";
    const url = base + (base.includes("?") ? "&" : "?") + "v=10&encoding=json";
    this.logger.info("[discord-presence] Connecting to Discord Gateway.");
    this.socket = new this.WebSocketImpl(url);
    this.socket.onopen = () => this.logger.info("[discord-presence] Discord Gateway WebSocket opened.");
    this.socket.onmessage = event => {
      void this.handleMessage(event.data);
    };
    this.socket.onerror = () => {
      this.logger.warn("[discord-presence] Discord Gateway socket error.");
    };
    this.socket.onclose = event => {
      this.logger.error(`[discord-presence] Discord Gateway closed (code=${event.code}, reason=${event.reason || "no reason supplied"}).`);
      this.connected = false;
      this.guildReady = false;
      this.stopHeartbeat();
      if ((this.config.presenceEnabled !== false)) void this.heartbeat(false, false);
      for (const pending of this.pendingChunks.values()) pending.resolve();
      this.pendingChunks.clear();
      if (!this.stopped) this.scheduleReconnect(event.code);
    };
  }

  async handleMessage(raw) {
    try {
      const text = typeof raw === "string" ? raw : await raw.text();
      const packet = JSON.parse(text);
      if (Number.isInteger(packet.s)) this.sequence = packet.s;

      if (packet.op === 10) {
        this.logger.info("[discord-presence] Discord Gateway HELLO received; identifying or resuming.");
        this.heartbeatInterval = packet.d.heartbeat_interval;
        this.startHeartbeat();
        if (this.sessionId && this.sequence !== null) {
          this.send({ op: 6, d: { token: this.config.token, session_id: this.sessionId, seq: this.sequence } });
        } else {
          this.send({ op: 2, d: {
            token: this.config.token,
            intents: GUILDS_INTENT |
              (this.config.botEnabled ? (GUILD_MEMBERS_INTENT | GUILD_MODERATION_INTENT | GUILD_EXPRESSIONS_INTENT | GUILD_INTEGRATIONS_INTENT | GUILD_WEBHOOKS_INTENT | GUILD_INVITES_INTENT | GUILD_VOICE_STATES_INTENT | GUILD_MESSAGES_INTENT | GUILD_MESSAGE_REACTIONS_INTENT | GUILD_SCHEDULED_EVENTS_INTENT | AUTO_MODERATION_CONFIGURATION_INTENT | AUTO_MODERATION_EXECUTION_INTENT) : 0) |
              ((this.config.presenceEnabled !== false) ? GUILD_PRESENCES_INTENT : 0),
            large_threshold: 250,
            properties: { os: process.platform, browser: "Snoozer Presence", device: "Snoozer Presence" },
          } });
        }
        return;
      }
      if (packet.op === 11) {
        this.heartbeatOutstanding = false;
        return;
      }
      if (packet.op === 1) {
        this.sendHeartbeat();
        return;
      }
      if (packet.op === 7) {
        this.socket?.close(4000, "Discord requested reconnect");
        return;
      }
      if (packet.op === 9) {
        this.logger.error(`[discord-presence] Discord Gateway invalidated the session (resumable=${Boolean(packet.d)}).`);
        if (!packet.d) {
          this.sessionId = null;
          this.sequence = null;
          this.resumeUrl = null;
        }
        this.socket?.close(4000, "Discord invalidated the session");
        return;
      }
      if (packet.op === 0) await this.dispatch(packet);
    } catch (error) {
      this.logger.error("[discord-presence] Gateway message could not be processed:", error?.message ?? error);
    }
  }

  startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatOutstanding = false;
    const tick = () => {
      if (this.heartbeatOutstanding) {
        this.socket?.close(4000, "Discord heartbeat acknowledgement timed out");
        return;
      }
      this.sendHeartbeat();
    };
    this.heartbeatTimer = setTimeout(() => {
      tick();
      this.heartbeatTimer = setInterval(tick, this.heartbeatInterval);
    }, Math.random() * this.heartbeatInterval);
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
    this.heartbeatOutstanding = false;
  }

  sendHeartbeat() {
    this.heartbeatOutstanding = true;
    this.send({ op: 1, d: this.sequence });
  }

  scheduleReconnect(code) {
    if (this.reconnectTimer || this.stopped) return;
    const wait = code === 4004 ? 30_000 : Math.min(30_000, 1_000 * (2 ** Math.min(this.reconnectAttempt, 5)));
    this.reconnectAttempt += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, wait);
  }

  async start() {
    this.logger.info("[discord-presence] Discord worker process started.");
    if ((this.config.presenceEnabled !== false)) {
      this.logger.info("[discord-presence] Presence monitoring is enabled; validating the signed Snoozer endpoint.");
      await this.refreshSubscriptions();
      this.subscriptionTimer = setInterval(() => void this.refreshSubscriptions(), SUBSCRIPTION_REFRESH_MS);
      this.snapshotTimer = setInterval(() => void this.requestSnapshots(this.subscribedDiscordUserIds()), SNAPSHOT_REFRESH_MS);
      this.workerHeartbeatTimer = setInterval(() => void this.heartbeat(this.connected, this.guildReady), HEARTBEAT_INTERVAL_MS);
    } else {
      this.logger.info("[discord-presence] Presence monitoring is disabled; the worker will not read or submit presence data.");
    }
    if (this.config.serverSetupEnabled || this.config.botEnabled) {
      try {
        await this.registerServerSetupCommand();
      } catch (error) {
        this.logger.error("[discord-presence] could not register Snoozer guild commands:", error?.message ?? error);
      }
    }
    this.connect();
  }

  async stop() {
    this.stopped = true;
    for (const timer of [this.subscriptionTimer, this.snapshotTimer, this.workerHeartbeatTimer, this.reconnectTimer]) if (timer) clearInterval(timer);
    this.subscriptionTimer = null;
    this.snapshotTimer = null;
    this.workerHeartbeatTimer = null;
    this.reconnectTimer = null;
    if (this.communityStatusTimer) clearInterval(this.communityStatusTimer);
    this.communityStatusTimer = null;
    this.communityPanels?.stop();
    this.securityGuard?.stop();
    if(this.activityTimer)clearInterval(this.activityTimer);
    this.activityTimer=null;
    await this.flushActivity();
    this.stopHeartbeat();
    this.socket?.close(1000, "Worker shutting down");
    if ((this.config.presenceEnabled !== false)) await this.heartbeat(false, false);
  }
}

export function loadConfig(env = process.env) {
  const presenceEnabled = env.DISCORD_PRESENCE_ENABLED === "true";
  const serverSetupEnabled = env.DISCORD_SERVER_SETUP_ENABLED === "true";
  const botEnabled = env.DISCORD_BOT_ENABLED === "true";
  const token = env.DISCORD_BOT_TOKEN ?? "";
  const guildId = env.DISCORD_PRESENCE_GUILD_ID ?? "";
  const baseUrl = env.SNOOZER_PRESENCE_URL ?? "";
  const secret = env.DISCORD_PRESENCE_INGEST_SECRET ?? "";
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL ?? env.SUPABASE_URL ?? "";
  const supabaseServiceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if ((!presenceEnabled && !serverSetupEnabled && !botEnabled) || !token || !/^[1-9][0-9]{16,19}$/.test(guildId)) {
    throw new Error("Enable DISCORD_SERVER_SETUP_ENABLED, DISCORD_BOT_ENABLED or DISCORD_PRESENCE_ENABLED, and configure DISCORD_BOT_TOKEN and DISCORD_PRESENCE_GUILD_ID.");
  }
  if (botEnabled && (!/^https:\/\/[a-z0-9.-]+$/i.test(supabaseUrl) || !supabaseServiceRoleKey)) {
    throw new Error("The interactive Discord bot requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the existing Render service.");
  }
  if (presenceEnabled && (!/^https:\/\/[a-z0-9.-]+(?::[0-9]{1,5})?$/i.test(baseUrl) || !/^[a-f0-9]{64}$/i.test(secret))) {
    throw new Error("Discord Presence requires SNOOZER_PRESENCE_URL and the shared 64-character DISCORD_PRESENCE_INGEST_SECRET.");
  }
  return {
    token,
    guildId,
    baseUrl: baseUrl.replace(/\/$/, ""),
    secret,
    presenceEnabled,
    serverSetupEnabled,
    botEnabled,
    supabaseUrl,
    supabaseServiceRoleKey,
  };
}

async function main() {
  const config = loadConfig();
  const worker = new DiscordPresenceWorker(config);
  process.on("SIGTERM", () => void worker.stop().finally(() => process.exit(0)));
  process.on("SIGINT", () => void worker.stop().finally(() => process.exit(0)));
  await worker.start();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error("[discord-presence] startup failed:", error?.message ?? error);
    process.exitCode = 1;
  });
}
