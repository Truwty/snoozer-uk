import { SNOOZER_CHANNEL_IDS } from "./server-setup.mjs";

const PERMISSIONS = {
  administrator: 1n << 3n,
  kickMembers: 1n << 1n,
  banMembers: 1n << 2n,
  manageMessages: 1n << 13n,
  moderateMembers: 1n << 40n,
  viewChannel: 1n << 10n,
  sendMessages: 1n << 11n,
  readMessageHistory: 1n << 16n,
  embedLinks: 1n << 14n,
  attachFiles: 1n << 15n,
  manageChannels: 1n << 4n,
  manageGuild: 1n << 5n,
  viewAuditLog: 1n << 7n,
  manageRoles: 1n << 28n,
  manageWebhooks: 1n << 29n,
  manageEvents: 1n << 33n,
};

const STAFF_ROLE_NAMES = ["Snoozer Admin", "Senior Moderator", "Moderator", "Support Team", "Support Manager", "Ticket Support"];
// Discord permission overwrite values are sent as decimal strings to avoid mixed BigInt operations.
const TICKET_PERMISSION_BITS = Object.freeze({everyoneDenyView:"1024",ownerAllow:"117760",staffAllow:"84992",closedOwnerAllow:"66560",closedOwnerDeny:"2048"});
const REQUIRED_BOT_PERMISSIONS = [
  ["Manage Server", PERMISSIONS.manageGuild],
  ["View Audit Log", PERMISSIONS.viewAuditLog],
  ["Manage Channels", PERMISSIONS.manageChannels],
  ["Manage Webhooks", PERMISSIONS.manageWebhooks],
  ["Manage Events", PERMISSIONS.manageEvents],
  ["Manage Roles", PERMISSIONS.manageRoles],
  ["View Channels", PERMISSIONS.viewChannel],
  ["Send Messages", PERMISSIONS.sendMessages],
  ["Embed Links", PERMISSIONS.embedLinks],
  ["Read Message History", PERMISSIONS.readMessageHistory],
  ["Kick Members", PERMISSIONS.kickMembers],
  ["Ban Members", PERMISSIONS.banMembers],
  ["Moderate Members", PERMISSIONS.moderateMembers],
];
const STAFF_MOD_ROLE_NAMES = ["Snoozer Admin", "Senior Moderator", "Moderator"];
const STATUS_URL = "https://status.snoozer.uk/api/status";
const STATUS_PAGE_URL = "https://status.snoozer.uk";
export const SERVICE_STATUS_POLL_MS = 60_000;

const safeSnowflake = value => typeof value === "string" && /^[1-9][0-9]{16,19}$/.test(value);
const cleanText = (value, max = 500) => typeof value === "string"
  ? value.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim().slice(0, max)
  : "";
const option = (interaction, name) => interaction.data?.options?.find(item => item.name === name)?.value;
const encodeAuditReason = reason => encodeURIComponent(cleanText(reason || "Snoozer community moderation", 400));

function permissionBits(value) {
  try {
    if (typeof value === "bigint") return value;
    if (typeof value === "number" && Number.isSafeInteger(value)) return BigInt(value);
    if (typeof value === "string" && /^\d+$/.test(value)) return BigInt(value);
  } catch {}
  return null;
}

function hasPermission(permissionValue, required) {
  const value = permissionBits(permissionValue);
  const requiredBits = permissionBits(required);
  if (value === null || requiredBits === null || requiredBits === 0n) return false;
  return (value & PERMISSIONS.administrator) === PERMISSIONS.administrator
    || (value & requiredBits) === requiredBits;
}

function embedColour(state) {
  switch (state) {
    case "operational": return 0x43a982;
    case "degraded": return 0xd5a33c;
    case "maintenance": return 0x7295c8;
    case "outage": return 0xd65a68;
    default: return 0x7a8493;
  }
}

function statusState(snapshot) {
  const state = snapshot?.summary?.state;
  return ["operational", "degraded", "outage", "maintenance", "unknown"].includes(state) ? state : "unknown";
}

export const DISCORD_COMMUNITY_COMMANDS = [
  { name: "snoozer-help", description: "Show the Snoozer community bot commands.", type: 1 },
  { name: "snoozer-status", description: "Show live Snoozer service status.", type: 1 },
  {
    name: "snoozer-changelog",
    description: "Publish an official Snoozer release note to the changelog channel.",
    type: 1,
    default_member_permissions: "8192",
    options: [
      { type: 3, name: "title", description: "A short release or update title.", required: true, min_length: 4, max_length: 100 },
      { type: 3, name: "details", description: "Describe what changed and who it affects.", required: true, min_length: 10, max_length: 1500 },
    ],
  },
  {
    name: "snoozer-ticket",
    description: "Open a private support ticket with the Snoozer team.",
    type: 1,
    options: [
      { type: 3, name: "subject", description: "What do you need help with?", required: true, min_length: 4, max_length: 80 },
      { type: 3, name: "details", description: "Give the team enough detail to help. Do not include passwords or payment details.", required: true, min_length: 10, max_length: 1000 },
    ],
  },
  {
    name: "snoozer-ticket-close",
    description: "Close your open Snoozer support ticket.",
    type: 1,
    options: [{ type: 3, name: "reason", description: "Optional reason for closing the ticket.", required: false, max_length: 300 }],
  },
  {
    name: "snoozer-bug",
    description: "Submit a Snoozer bug report to the community team.",
    type: 1,
    options: [
      { type: 3, name: "title", description: "A short summary of the bug.", required: true, min_length: 4, max_length: 80 },
      { type: 3, name: "details", description: "Steps to reproduce and expected behaviour. No private account data.", required: true, min_length: 10, max_length: 1500 },
    ],
  },
  {
    name: "snoozer-suggest",
    description: "Submit an idea for Snoozer.",
    type: 1,
    options: [
      { type: 3, name: "title", description: "A short title for your idea.", required: true, min_length: 4, max_length: 80 },
      { type: 3, name: "details", description: "Describe the idea and what problem it solves.", required: true, min_length: 10, max_length: 1500 },
    ],
  },
  {
    name: "snoozer-report",
    description: "Privately report a member to the Snoozer moderation team.",
    type: 1,
    options: [
      { type: 6, name: "user", description: "The member you are reporting.", required: true },
      { type: 3, name: "reason", description: "Explain what happened. Do not submit passwords or payment details.", required: true, min_length: 8, max_length: 1000 },
    ],
  },
  {
    name: "snoozer-warn",
    description: "Record a formal warning for a server member.",
    type: 1,
    default_member_permissions: "8192",
    options: [
      { type: 6, name: "user", description: "The member to warn.", required: true },
      { type: 3, name: "reason", description: "Reason for the warning.", required: true, min_length: 5, max_length: 500 },
    ],
  },
  {
    name: "snoozer-timeout",
    description: "Temporarily restrict a member from sending messages or speaking.",
    type: 1,
    default_member_permissions: "1099511627776",
    options: [
      { type: 6, name: "user", description: "The member to timeout.", required: true },
      { type: 4, name: "minutes", description: "Timeout duration in minutes (1 to 40320).", required: true, min_value: 1, max_value: 40320 },
      { type: 3, name: "reason", description: "Reason for the timeout.", required: true, min_length: 5, max_length: 500 },
    ],
  },
  {
    name: "snoozer-kick",
    description: "Remove a member from the Snoozer Discord server.",
    type: 1,
    default_member_permissions: "2",
    options: [
      { type: 6, name: "user", description: "The member to kick.", required: true },
      { type: 3, name: "reason", description: "Reason for the kick.", required: true, min_length: 5, max_length: 500 },
    ],
  },
  {
    name: "snoozer-ban",
    description: "Ban a member from the Snoozer Discord server.",
    type: 1,
    default_member_permissions: "4",
    options: [
      { type: 6, name: "user", description: "The member to ban.", required: true },
      { type: 3, name: "reason", description: "Reason for the ban.", required: true, min_length: 5, max_length: 500 },
    ],
  },
];

export const DISCORD_COMMUNITY_COMMAND_NAMES = new Set(DISCORD_COMMUNITY_COMMANDS.map(command => command.name));

export class DiscordCommunityBot {
  constructor(config, dependencies = {}) {
    this.guildId = config.guildId;
    this.botUserId = config.botUserId;
    this.applicationId = config.applicationId;
    this.api = dependencies.api;
    this.fetcher = dependencies.fetcher ?? globalThis.fetch;
    this.logger = dependencies.logger ?? console;
    this.logEvent = dependencies.logEvent ?? null;
    this.store = dependencies.store ?? null;
    this.scheduleJobWake = dependencies.scheduleJobWake ?? null;
    this.channelIds = config.channelIds ?? SNOOZER_CHANNEL_IDS;
    this.categoryIds = config.categoryIds ?? {};
    this.roleIds = config.roleIds ?? {};
    this.statusBaseline = null;
    this.cooldowns = new Map();
    this.ticketCreationLocks = new Set();
    this.startedAt = Date.now();
    this.knownMembers = new Set();
    this.boostedMembers = new Set();
    this.boostAnnouncementLocks = new Set();
  }

  enforceCooldown(interaction, action, durationMs) {
    const userId = interaction.member?.user?.id ?? interaction.user?.id;
    if (!safeSnowflake(userId)) throw new Error("Discord did not provide a valid account ID for this request.");
    const key = action + ":" + userId;
    const now = Date.now();
    const expiresAt = this.cooldowns.get(key) ?? 0;
    if (expiresAt > now) {
      const remaining = Math.ceil((expiresAt - now) / 1000);
      throw new Error("Please wait " + remaining + " second(s) before sending another " + action + ".");
    }
    this.cooldowns.set(key, now + durationMs);
    if (this.cooldowns.size > 500) {
      for (const [entry, expiry] of this.cooldowns) if (expiry <= now) this.cooldowns.delete(entry);
    }
  }

  findChannel(channels, channelKey, fallbackName) {
    if (!Array.isArray(channels)) return null;
    const configuredId = this.channelIds?.[channelKey];
    return configuredId
      ? channels.find(item => item.type === 0 && item.id === configuredId) ?? null
      : channels.find(item => item.type === 0 && item.name === fallbackName) ?? null;
  }

  seedKnownBoosters(members) {
    if (Array.isArray(members)) {
      this.knownMembers.clear();
      this.boostedMembers.clear();
    }
    for (const member of Array.isArray(members) ? members : []) {
      const userId = member?.user?.id;
      if (!safeSnowflake(userId)) continue;
      this.knownMembers.add(userId);
      if (member.premium_since) this.boostedMembers.add(userId);
    }
  }

  handleMemberRemove(member) {
    const userId = member?.user?.id;
    if (!safeSnowflake(userId)) return false;
    this.knownMembers.delete(userId);
    this.boostedMembers.delete(userId);
    return true;
  }

  async welcomeMember(member) {
    const user = member?.user ?? {};
    const userId = user.id;
    if (!safeSnowflake(userId) || user.bot || this.knownMembers.has(userId)) return false;
    const joinedAt = Date.parse(member?.joined_at ?? "");
    if (Number.isFinite(joinedAt) && joinedAt < this.startedAt - 1_000) {
      this.knownMembers.add(userId);
      return false;
    }
    this.knownMembers.add(userId);
    const memberRoleId = this.roleIds.member;
    if (memberRoleId && Array.isArray(member.roles) && !member.roles.includes(memberRoleId)) {
      const nextRoles = [...member.roles, memberRoleId];
      try {
        await this.api.request("/guilds/" + this.guildId + "/members/" + userId, { method: "PATCH", body: { roles: nextRoles } });
      } catch (error) {
        this.logger.warn("[discord-community] default Member role assignment failed: " + (error?.message ?? error));
      }
    }
    const channels = await this.api.request("/guilds/" + this.guildId + "/channels");
    const channel = this.findChannel(channels, "welcome", "welcome");
    if (!channel?.id) {
      this.logger.warn("[discord-community] a new member joined but the configured #welcome channel was not found.");
      return false;
    }
    await this.api.request("/channels/" + channel.id + "/messages", {
      method: "POST",
      body: {
        content: "Welcome <@" + userId + "> to the official Snoozer community! 👋",
        embeds: [{
          title: "Welcome to Snoozer",
          description: "We're glad you're here. Start with **#rules** and **#faq**, then introduce yourself in **#introductions**.\n\n" +
            "[Visit Snoozer](https://snoozer.uk) · [Help Centre](https://help.snoozer.uk)",
          color: 0x8b72d9,
          footer: { text: "Snoozer · snoozer.uk" },
          timestamp: new Date().toISOString(),
        }],
        allowed_mentions: { parse: [], users: [userId] },
      },
    });
    this.logger.info("[discord-community] welcomed a new server member.");
    return true;
  }

    async goodbyeMember(member) {
    const userId=member?.user?.id;
    if(!safeSnowflake(userId)||member.user.bot)return false;
    const channels=await this.api.request("/guilds/"+this.guildId+"/channels");
    const channel=Array.isArray(channels)?channels.find(item=>item.type===0&&(
      this.channelIds.goodbye?item.id===this.channelIds.goodbye:item.name==="goodbye"
    )):null;
    if(!channel)return false;
    await this.api.request("/channels/"+channel.id+"/messages",{method:"POST",body:{
      embeds:[{title:"Member left Snoozer",description:"<@"+userId+"> has left the Snoozer community. Thank you for being part of it.",
        color:0x7a8493,timestamp:new Date().toISOString()}],allowed_mentions:{parse:[]},
    }});
    return true;
  }

async announceServerBoost(member) {
    const userId = member?.user?.id;
    if (!safeSnowflake(userId)) return false;
    const boosterRoleId = this.roleIds.booster;
    if (boosterRoleId && Array.isArray(member.roles) && !member.roles.includes(boosterRoleId)) {
      try { await this.api.request("/guilds/" + this.guildId + "/members/" + userId, { method: "PATCH", body: { roles: [...member.roles, boosterRoleId] } }); }
      catch (error) { this.logger.warn("[discord-community] booster role assignment failed: " + (error?.message ?? error)); }
    }
    const channels = await this.api.request("/guilds/" + this.guildId + "/channels");
    const channel = this.findChannel(channels, "serverBoosts", "server-boosts");
    if (!channel?.id) {
      this.logger.warn("[discord-community] a server boost was detected but #server-boosts was not found.");
      return false;
    }
    await this.api.request("/channels/" + channel.id + "/messages", {
      method: "POST",
      body: {
        content: "Thanks <@" + userId + "> for boosting the server!",
        allowed_mentions: { parse: [], users: [userId] },
      },
    });
    this.logger.info("[discord-community] posted a server boost thank-you.");
    try{
      const guild=await this.api.request("/guilds/"+this.guildId);
      const count=Number(guild?.premium_subscription_count??0);
      const milestones=new Set([5,10,15,20,25,30,40,50,75,100]);
      if(milestones.has(count)&&this.channelIds.serverBoosts){
        await this.api.request("/channels/"+this.channelIds.serverBoosts+"/messages",{method:"POST",body:{
          embeds:[{title:"🚀 Snoozer boost milestone reached",description:"The community has reached **"+count+" server boosts**. Thank you to everyone supporting Snoozer.",
            color:0xc69a43,timestamp:new Date().toISOString()}],allowed_mentions:{parse:[]},
        }});
      }
    }catch(error){this.logger.warn("[discord-community] booster milestone check failed: "+(error?.message??error));}
    return true;
  }

  async handleMemberUpdate(member) {
    const userId = member?.user?.id;
    if (!safeSnowflake(userId)) return false;
    if (!Object.hasOwn(member, "premium_since")) return false;
    if (!member.premium_since) {
      this.boostedMembers.delete(userId);
      const boosterRoleId = this.roleIds.booster;
      if (boosterRoleId && Array.isArray(member.roles) && member.roles.includes(boosterRoleId)) {
        try { await this.api.request("/guilds/" + this.guildId + "/members/" + userId, { method: "PATCH", body: { roles: member.roles.filter(id => id !== boosterRoleId) } }); }
        catch (error) { this.logger.warn("[discord-community] booster role removal failed: " + (error?.message ?? error)); }
      }
      return false;
    }
    const boostStartedAt = Date.parse(member.premium_since);
    if (Number.isFinite(boostStartedAt) && boostStartedAt < this.startedAt - 1_000) {
      this.boostedMembers.add(userId);
      return false;
    }
    if (this.boostedMembers.has(userId) || this.boostAnnouncementLocks.has(userId)) return false;
    this.boostAnnouncementLocks.add(userId);
    try {
      const sent = await this.announceServerBoost(member);
      if (sent) this.boostedMembers.add(userId);
      return sent;
    } finally {
      this.boostAnnouncementLocks.delete(userId);
    }
  }

  async publishChangelog(interaction) {
    this.enforceCooldown(interaction, "changelog", 30_000);
    const title = cleanText(option(interaction, "title"), 100);
    const details = cleanText(option(interaction, "details"), 1500);
    if (title.length < 4 || details.length < 10) {
      throw new Error("Add a title of at least 4 characters and details of at least 10 characters.");
    }
    if (!hasPermission(interaction.member?.permissions, PERMISSIONS.manageMessages)) {
      throw new Error("You need Manage Messages (or Administrator) to publish an official changelog entry.");
    }
    const channels = await this.api.request("/guilds/" + this.guildId + "/channels");
    const channel = this.findChannel(channels, "changelog", "changelog");
    if (!channel?.id) throw new Error("The configured #changelog channel was not found. Ask an Administrator to run /snoozer-reconcile.");
    const actor = interaction.member?.user ?? interaction.user ?? {};
    await this.api.request("/channels/" + channel.id + "/messages", {
      method: "POST",
      body: {
        embeds: [{
          title: "Snoozer update · " + title,
          description: details,
          color: 0x35a79b,
          author: { name: "Snoozer Team" },
          footer: { text: "Published by " + (cleanText(actor.username, 64) || "Snoozer staff") },
          timestamp: new Date().toISOString(),
        }],
        allowed_mentions: { parse: [] },
      },
    });
    return "The changelog entry has been published in <#" + channel.id + ">.";
  }

  async preflightPermissions() {
    const [roles, member] = await Promise.all([
      this.api.request("/guilds/" + this.guildId + "/roles"),
      this.api.request("/guilds/" + this.guildId + "/members/" + this.botUserId),
    ]);
    if (!Array.isArray(roles) || !Array.isArray(member?.roles)) {
      throw new Error("Discord did not return the bot's guild roles for its permission preflight.");
    }

    const assigned = new Set([this.guildId, ...member.roles]);
    let permissions = 0n;
    for (const role of roles) {
      if (!assigned.has(role.id)) continue;
      try {
        permissions |= BigInt(role.permissions ?? "0");
      } catch {
        this.logger.warn("[discord-community] ignored an invalid permissions bitfield on role " + cleanText(role.name, 80) + ".");
      }
    }

    const isAdministrator = (permissions & PERMISSIONS.administrator) === PERMISSIONS.administrator;
    const missing = isAdministrator ? [] : REQUIRED_BOT_PERMISSIONS
      .filter(([, required]) => (permissions & required) !== required)
      .map(([name]) => name);
    if (missing.length) {
      this.logger.warn("[discord-community] bot permission preflight found missing server permissions: " + missing.join(", ") +
        ". Ticket creation and/or moderation actions may fail until the bot role is updated.");
    } else {
      this.logger.info("[discord-community] bot permission preflight passed.");
    }
    return { missing };
  }

  async acknowledge(interaction, ephemeral = true) {
    return this.api.request("/interactions/" + interaction.id + "/" + interaction.token + "/callback", {
      method: "POST",
      auth: false,
      body: { type: 5, data: ephemeral ? { flags: 64 } : {} },
    });
  }

  async complete(interaction, payload) {
    return this.api.request("/webhooks/" + this.applicationId + "/" + interaction.token + "/messages/@original", {
      method: "PATCH",
      auth: false,
      body: { allowed_mentions: { parse: [] }, ...payload },
    });
  }

  async immediate(interaction, payload, ephemeral = true) {
    return this.api.request("/interactions/" + interaction.id + "/" + interaction.token + "/callback", {
      method: "POST",
      auth: false,
      body: { type: 4, data: { flags: ephemeral ? 64 : 0, allowed_mentions: { parse: [] }, ...payload } },
    });
  }

  async fetchStatus() {
    const response = await this.fetcher(STATUS_URL, {
      method: "GET",
      headers: { Accept: "application/json", "User-Agent": "Snoozer-Discord-Bot/1.0" },
      cache: "no-store",
      signal: AbortSignal.timeout(7_000),
    });
    if (!response.ok) throw new Error("Snoozer status page returned HTTP " + response.status + ".");
    const length = Number(response.headers.get("content-length") ?? 0);
    if (length > 65_536) throw new Error("Snoozer status response exceeded the size limit.");
    const snapshot = await response.json();
    if (!snapshot || typeof snapshot !== "object" || !snapshot.summary || !Array.isArray(snapshot.services)) {
      throw new Error("Snoozer status page returned an unexpected response.");
    }
    return snapshot;
  }

  statusEmbed(snapshot) {
    const summary = snapshot.summary ?? {};
    const state = statusState(snapshot);
    const fields = snapshot.services.slice(0, 6).map(service => ({
      name: cleanText(service?.name, 80) || "Service",
      value: "**" + (cleanText(service?.state, 30) || "unknown").toUpperCase() + "**\n" +
        (cleanText(service?.description, 350) || "No additional information."),
      inline: true,
    }));
    const incidents = Array.isArray(snapshot.incidentFeed?.incidents)
      ? snapshot.incidentFeed.incidents.filter(incident => incident && incident.state !== "resolved").slice(0, 3)
      : [];
    if (incidents.length) {
      fields.push({
        name: "Active incidents",
        value: incidents.map(incident => "• **" + cleanText(incident.title, 100) + "** — " + cleanText(incident.state, 30)).join("\n").slice(0, 1000),
        inline: false,
      });
    }
    return {
      title: cleanText(summary.label, 180) || "SNOOZER STATUS",
      description: (cleanText(summary.title, 250) || "Current Snoozer service status") + "\n\n" +
        (cleanText(summary.description, 800) || "See the live status page for details."),
      url: STATUS_PAGE_URL,
      color: embedColour(state),
      fields,
      footer: { text: "Live status · status.snoozer.uk" },
      timestamp: typeof snapshot.checkedAt === "string" ? snapshot.checkedAt : new Date().toISOString(),
    };
  }

  async announceStatusChange(snapshot, previousState) {
    const channels = await this.api.request("/guilds/" + this.guildId + "/channels");
    const channel = this.findChannel(channels, "serviceStatus", "service-status");
    if (!channel?.id) {
      this.logger.warn("[discord-community] status changed but #service-status was not found.");
      return false;
    }
    const state = statusState(snapshot);
    const summary = snapshot.summary ?? {};
    const title = state === "operational" ? "Snoozer services have recovered"
      : state === "outage" ? "Snoozer service disruption reported"
        : state === "maintenance" ? "Snoozer provider maintenance update"
          : "Snoozer service status update";
    await this.api.request("/channels/" + channel.id + "/messages", {
      method: "POST",
      body: {
        embeds: [{
          title,
          description: cleanText(summary.title, 250) + "\n\n" + cleanText(summary.description, 800) +
            "\n\n[View live status](" + STATUS_PAGE_URL + ")",
          color: embedColour(state),
          fields: [{ name: "Previous status", value: previousState.toUpperCase(), inline: true }, { name: "Current status", value: state.toUpperCase(), inline: true }],
          footer: { text: "Automated Snoozer status update" },
          timestamp: new Date().toISOString(),
        }],
        allowed_mentions: { parse: [] },
      },
    });
    return true;
  }

  async primeStatusBaseline() {
    try {
      const snapshot = await this.fetchStatus();
      this.statusBaseline = statusState(snapshot);
      this.logger.info("[discord-community] status announcement baseline initialised (" + this.statusBaseline + ").");
    } catch (error) {
      this.logger.warn("[discord-community] could not initialise status announcements: " + (error?.message ?? error));
    }
  }

  async checkAndAnnounceStatus() {
    try {
      const snapshot = await this.fetchStatus();
      const current = statusState(snapshot);
      if (!this.statusBaseline) {
        this.statusBaseline = current;
        return;
      }
      if (current === "unknown" || current === this.statusBaseline) return;
      const previous = this.statusBaseline;
      if (previous === "unknown") {
        this.statusBaseline = current;
        return;
      }
      if (await this.announceStatusChange(snapshot, previous)) this.statusBaseline = current;
    } catch (error) {
      this.logger.warn("[discord-community] status polling failed: " + (error?.message ?? error));
    }
  }

  async guildResources() {
    const [channels, roles] = await Promise.all([
      this.api.request("/guilds/" + this.guildId + "/channels"),
      this.api.request("/guilds/" + this.guildId + "/roles"),
    ]);
    if (!Array.isArray(channels) || !Array.isArray(roles)) throw new Error("Discord did not return the server channels and roles.");
    return { channels, roles };
  }

  async createPrivateChannel({ interaction, channelPrefix, categoryName, topic, message, staffRoleNames, targetUserId, notifyRoleName = "Ticket Support" }) {
    const { channels, roles } = await this.guildResources();
    const categoryId = channelPrefix === "ticket" ? this.categoryIds.tickets : this.categoryIds.teamHq;
    const parent = channels.find(item => item.type === 4 && (categoryId ? item.id === categoryId : item.name.toLowerCase() === categoryName.toLowerCase()));
    if (!parent) throw new Error("The " + categoryName + " category is missing. An administrator should run /snoozer-reconcile.");
    const opener = interaction.user ?? interaction.member?.user ?? {};
    const openerId = interaction.member?.user?.id ?? interaction.user?.id;
    if (!safeSnowflake(openerId)) throw new Error("Discord did not provide a valid account ID for this request.");
    const targetId = targetUserId ?? openerId;
    if (!safeSnowflake(targetId)) throw new Error("The selected member ID is invalid.");

    if (channelPrefix === "ticket") {
      const openTicket = channels.find(item => item.type === 0 && typeof item.topic === "string"
        && new RegExp("SNOOZER_TICKET:v[12](?: id=[0-9a-f-]+)? owner=" + openerId + " status=open(?:\\\\s|$)").test(item.topic));
      if (openTicket) return { existing: true, channel: openTicket };
    }

    const roleKeyByName = new Map([["Snoozer Admin","admin"],["Senior Moderator","senior_moderator"],["Moderator","moderator"],["Community Manager","community_manager"],["Support Manager","support_manager"],["Support Team","support_team"],["Ticket Support","ticket_support"]]);
    const configuredStaffIds = staffRoleNames.map(name => this.roleIds[roleKeyByName.get(name)]).filter(Boolean);
    const staffRoles = configuredStaffIds.length
      ? roles.filter(role => configuredStaffIds.includes(role.id))
      : roles.filter(role => staffRoleNames.includes(role.name));
    const missingStaffRoles = configuredStaffIds.length
      ? configuredStaffIds.filter(id => !staffRoles.some(role => role.id === id))
      : staffRoleNames.filter(name => !staffRoles.some(role => role.name === name));
    if (missingStaffRoles.length) {
      throw new Error("Required Snoozer staff roles are missing: " + missingStaffRoles.join(", ") + ". Ask an Administrator to run /snoozer-reconcile.");
    }
    const notifyRoleKey = notifyRoleName === "Moderator" ? "moderator" : notifyRoleName === "Ticket Support" ? "ticket_support" : null;
    const notifyRoleId = notifyRoleKey ? this.roleIds[notifyRoleKey] : null;
    const notifyRole = notifyRoleId ? roles.find(role => role.id === notifyRoleId) : (notifyRoleName ? roles.find(role => role.name === notifyRoleName) : null);
    const overwrites = [
      { id: this.guildId, type: 0, allow: "0", deny: TICKET_PERMISSION_BITS.everyoneDenyView },
      { id: targetId, type: 1, allow: TICKET_PERMISSION_BITS.ownerAllow, deny: "0" },
      ...staffRoles.map(role => ({ id: role.id, type: 0, allow: TICKET_PERMISSION_BITS.staffAllow, deny: "0" })),
      { id: this.botUserId, type: 1, allow: TICKET_PERMISSION_BITS.ownerAllow, deny: "0" },
    ];
    const username = cleanText(opener.username, 24).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "member";
    const suffix = String(interaction.id).slice(-6).replace(/[^0-9]/g, "") || String(Date.now()).slice(-6);
    const name = (channelPrefix + "-" + username + "-" + suffix).slice(0, 95);
    const channel = await this.api.request("/guilds/" + this.guildId + "/channels", {
      method: "POST",
      body: {
        name,
        type: 0,
        parent_id: parent.id,
        topic,
        permission_overwrites: overwrites,
      },
    });
    if (!channel?.id) throw new Error("Discord did not return the private channel ID.");

    let welcomeMessageSent = true;
    try {
      await this.api.request("/channels/" + channel.id + "/messages", {
        method: "POST",
        body: {
          content: "<@" + openerId + "> " + (notifyRole?.id ? "<@&" + notifyRole.id + "> " : "") + message,
          allowed_mentions: { parse: [], users: [openerId], roles: notifyRole?.id ? [notifyRole.id] : [] },
        },
      });
    } catch (error) {
      welcomeMessageSent = false;
      this.logger.error("[discord-community] private channel created but its opening message failed: " + (error?.message ?? error));
    }
    return { existing: false, channel, welcomeMessageSent };
  }

  async submitTicket(interaction) {
    const subject = cleanText(option(interaction, "subject"), 80);
    const details = cleanText(option(interaction, "details"), 1000);
    if (subject.length < 4 || details.length < 10) throw new Error("Add a clear subject and at least 10 characters of detail.");
    const openerId = interaction.member?.user?.id ?? interaction.user?.id;
    if (!safeSnowflake(openerId)) throw new Error("Discord did not provide a valid account ID for this request.");
    if (!this.store || typeof this.store.ticketPreflight !== "function") {
      throw new Error("Persistent ticket protection is temporarily unavailable. Please try again shortly.");
    }
    if (this.ticketCreationLocks.has(openerId)) {
      throw new Error("Your support ticket is already being opened. Please wait for the current request to finish.");
    }

    this.ticketCreationLocks.add(openerId);
    try {
      const preflight = await this.store.ticketPreflight(this.guildId, openerId);
      if (preflight?.allowed === false) {
        if (preflight.reason === "active" && safeSnowflake(preflight.channel_id)) {
          return "You already have an open support ticket: <#" + preflight.channel_id + ">.";
        }
        if (preflight.reason === "cooldown") {
          return "To prevent duplicate tickets, wait " + Math.max(1, Number(preflight.retry_after_seconds ?? 1)) + " second(s) before opening another ticket.";
        }
        throw new Error("A support ticket is already active or a recent ticket is still being processed.");
      }

      const result = await this.createPrivateChannel({
        interaction,
        channelPrefix: "ticket",
        categoryName: "TICKETS",
        topic: "SNOOZER_TICKET:v2 owner=" + openerId + " status=open category=general created_at=" + new Date().toISOString(),
        staffRoleNames: STAFF_ROLE_NAMES,
        message: "**" + subject + "**\n\n" + details + "\n\nA Snoozer team member will reply here. Use /snoozer-ticket-close when the issue is resolved.",
      });
      if (result.existing) return "You already have an open support ticket: <#" + result.channel.id + ">.";

      let ticket;
      try {
        ticket = await this.store.openTicket({
          guildId: this.guildId, channelId: result.channel.id, ownerId: openerId,
          category: "general", subject, details,
        });
        if (!ticket?.created) {
          try { await this.api.request("/channels/" + result.channel.id, { method: "DELETE" }); } catch {}
          if (ticket?.channel_id) return "You already have an open support ticket: <#" + ticket.channel_id + ">.";
          if (ticket?.reason === "cooldown") return "To prevent duplicate tickets, wait " + Math.max(1, Number(ticket.retry_after_seconds ?? 1)) + " second(s) before opening another ticket.";
          return "You already have an open support ticket.";
        }
        await this.api.request("/channels/" + result.channel.id, {
          method: "PATCH",
          body: { topic: "SNOOZER_TICKET:v2 id=" + ticket.ticket_id + " owner=" + openerId + " status=open category=general" },
        });
      } catch (error) {
        try { await this.api.request("/channels/" + result.channel.id, { method: "DELETE" }); }
        catch (cleanupError) { this.logger.error("[discord-community] orphan ticket cleanup failed", cleanupError?.message ?? cleanupError); }
        throw error;
      }

      try {
        await this.store.enqueueJob({
          guildId: this.guildId, jobType: "ticket_reminder",
          dedupeKey: "ticket-reminder:" + ticket.ticket_id + ":1",
          payload: { ticket_id: ticket.ticket_id, channel_id: result.channel.id, reminder_number: 1 },
          runAt: new Date(Date.now() + 24 * 60 * 60_000).toISOString(),
        });
      } catch (error) {
        this.logger.warn("[discord-community] ticket created but reminder scheduling failed", error?.message ?? error);
      }

      await this.logSupportTicket(interaction, result.channel, subject);
      try {
        await this.logEvent?.({
          title: "Support ticket opened",
          description: "Member: <@" + openerId + ">\nChannel: <#" + result.channel.id + ">\nReference: " + ticket.ticket_id + "\nSubject: " + cleanText(subject, 80),
          severity: "info",
        });
      } catch {}
      return "Your private support ticket has been created: <#" + result.channel.id + ">." +
        (result.welcomeMessageSent ? "" : " The channel exists, but Discord rejected its opening message; please send your request details again inside the ticket.");
    } finally {
      this.ticketCreationLocks.delete(openerId);
    }
  }

  async logSupportTicket(interaction, channel, subject) {
    try {
      const channels = await this.api.request("/guilds/" + this.guildId + "/channels");
      const queue = Array.isArray(channels) ? channels.find(item => item.type === 0 && (this.channelIds.ticketQueue ? item.id === this.channelIds.ticketQueue : item.name === "support-queue")) : null;
      if (!queue?.id) return false;
      const openerId = interaction.member?.user?.id ?? interaction.user?.id;
      await this.api.request("/channels/" + queue.id + "/messages", {
        method: "POST",
        body: {
          embeds: [{
            title: "New support ticket",
            description: "**Subject:** " + subject + "\n**Member:** <@" + openerId + ">\n**Ticket:** <#" + channel.id + ">",
            color: 0x8b72d9,
            timestamp: new Date().toISOString(),
          }],
          allowed_mentions: { parse: [] },
        },
      });
      return true;
    } catch (error) {
      this.logger.warn("[discord-community] support queue log failed: " + (error?.message ?? error));
      return false;
    }
  }

  async closeTicket(interaction) {
    const channelId = interaction.channel_id;
    if (!safeSnowflake(channelId)) throw new Error("Run this command inside the ticket channel you want to close.");
    const channel = await this.api.request("/channels/" + channelId);
    if (typeof channel?.topic !== "string" || !/^SNOOZER_TICKET:v[12]\b/.test(channel.topic)) {
      throw new Error("This channel is not a Snoozer support ticket.");
    }
    if (channel.topic.includes("status=closed")) return "This ticket is already closed.";
    const ownerId = channel.topic.match(/\bowner=([1-9][0-9]{16,19})\b/)?.[1];
    const actorId = interaction.member?.user?.id ?? interaction.user?.id;
    const memberRoles = new Set(interaction.member?.roles ?? []);
    const roles = await this.api.request("/guilds/" + this.guildId + "/roles");
    const staffIds = roles.filter(role => STAFF_ROLE_NAMES.includes(role.name)).map(role => role.id);
    const isStaff = staffIds.some(id => memberRoles.has(id)) || hasPermission(interaction.member?.permissions, PERMISSIONS.manageMessages);
    if (actorId !== ownerId && !isStaff) throw new Error("Only the ticket owner or Snoozer staff can close this ticket.");

    const ticketId = channel.topic.match(/\bid=([0-9a-f-]{36})\b/)?.[1] ?? null;
    const messages = await this.api.request("/channels/" + channelId + "/messages?limit=100");
    const transcript = (Array.isArray(messages) ? messages : []).reverse().map(message => {
      let content = cleanText(message.content, 2000);
      content = content.replace(/\b(password|passcode|one[- ]time code|2fa|api key|secret|card number)\b\s*[:=]\s*\S+/gi, "$1: [REDACTED]");
      content = content.replace(/\b(?:\d[ -]*?){13,19}\b/g, "[POSSIBLE PAYMENT NUMBER REDACTED]");
      return {
        id: message.id,
        author_id: message.author?.id ?? null,
        author: cleanText(message.author?.username, 80),
        content,
        timestamp: message.timestamp,
      };
    }).slice(-100);

    if (!this.store || typeof this.store.enqueueJob !== "function") {
      throw new Error("Persistent ticket closure is temporarily unavailable. Please try again shortly.");
    }
    if (ticketId) await this.store.ticketAction(ticketId, actorId, "transcript", { transcript });

    const deleteAt = new Date(Date.now() + 10_000).toISOString();
    await this.store.enqueueJob({
      guildId: this.guildId,
      jobType: "ticket_delete",
      dedupeKey: "ticket-delete:" + (ticketId ?? channelId),
      payload: ticketId
        ? { ticket_id: ticketId, channel_id: channelId, closed_by: actorId }
        : { legacy: true, channel_id: channelId, closed_by: actorId },
      runAt: deleteAt,
    });
    if (ticketId) await this.store.ticketAction(ticketId, actorId, "close", {});

    const overwrites = (Array.isArray(channel.permission_overwrites) ? channel.permission_overwrites : [])
      .filter(entry => entry.id !== ownerId || entry.type !== 1);
    overwrites.push({
      id: ownerId,
      type: 1,
      allow: TICKET_PERMISSION_BITS.closedOwnerAllow,
      deny: TICKET_PERMISSION_BITS.closedOwnerDeny,
    });
    const reason = cleanText(option(interaction, "reason"), 300);
    const closedAt = new Date().toISOString();
    await this.api.request("/channels/" + channel.id, {
      method: "PATCH",
      body: {
        name: ("closed-" + cleanText(channel.name, 90)).slice(0, 100),
        topic: channel.topic.replace("status=open", "status=closed") + " closed_at=" + closedAt,
        permission_overwrites: overwrites,
      },
    });

    this.scheduleJobWake?.(deleteAt);

    let closeNoticeSent = true;
    try {
      await this.api.request("/channels/" + channel.id + "/messages", {
        method: "POST",
        body: {
          embeds: [{
            title: "Ticket closed",
            description: "This ticket has been closed by <@" + actorId + ">." +
              (reason ? "\n**Reason:** " + reason : "") +
              "\n\nThis channel will be automatically deleted in 10 seconds.",
            color: 0x7a8493,
            timestamp: closedAt,
          }],
          allowed_mentions: { parse: [] },
        },
      });
    } catch (error) {
      closeNoticeSent = false;
      this.logger.error("[discord-community] ticket closed but its closure notice failed: " + (error?.message ?? error));
    }
    try {
      await this.logEvent?.({
        title: "Support ticket closed",
        description: "Channel: <#" + channelId + ">\nClosed by: <@" + actorId + ">\nOwner: <@" + ownerId + ">\nScheduled deletion: " + deleteAt,
        severity: "info",
      });
    } catch {}
    return "The ticket has been closed and will be deleted in 10 seconds." +
      (closeNoticeSent ? "" : " The channel deletion is still queued.");
  }

  async submitPublicFeedback(interaction, channelName, kind) {
    this.enforceCooldown(interaction, "feedback", 45_000);
    const title = cleanText(option(interaction, "title"), 80);
    const details = cleanText(option(interaction, "details"), 1500);
    if (title.length < 4 || details.length < 10) throw new Error("Add a clear title and at least 10 characters of detail.");
    const channels = await this.api.request("/guilds/" + this.guildId + "/channels");
    const channel = Array.isArray(channels) ? channels.find(item => item.type === 0 && item.name === channelName) : null;
    if (!channel?.id) throw new Error("The #" + channelName + " channel is missing. Ask an administrator to run /snoozer-reconcile.");
    const user = interaction.member?.user ?? interaction.user ?? {};
    const userId = user.id;
    await this.api.request("/channels/" + channel.id + "/messages", {
      method: "POST",
      body: {
        embeds: [{
          title: (kind === "bug" ? "Bug report: " : "Suggestion: ") + title,
          description: details,
          color: kind === "bug" ? 0xd65a68 : 0x43a982,
          author: { name: "Submitted by " + (cleanText(user.username, 80) || "community member") },
          footer: { text: "Snoozer " + kind + " submission · user " + userId },
          timestamp: new Date().toISOString(),
        }],
        allowed_mentions: { parse: [] },
      },
    });
    return "Your " + kind + " has been posted in <#" + channel.id + ">.";
  }

  async reportMember(interaction) {
    this.enforceCooldown(interaction, "member report", 90_000);
    const targetId = option(interaction, "user");
    const reason = cleanText(option(interaction, "reason"), 1000);
    if (!safeSnowflake(targetId) || reason.length < 8) throw new Error("Choose a valid member and provide at least 8 characters explaining the report.");
    const reporterId = interaction.member?.user?.id ?? interaction.user?.id;
    if (targetId === reporterId) throw new Error("You cannot report your own account.");
    const result = await this.createPrivateChannel({
      interaction,
      channelPrefix: "report",
      categoryName: "STAFF HQ",
      targetUserId: reporterId,
      topic: "SNOOZER_REPORT:v1 reporter=" + reporterId + " target=" + targetId + " status=open created_at=" + new Date().toISOString(),
      staffRoleNames: STAFF_MOD_ROLE_NAMES,
      notifyRoleName: "Moderator",
      message: "**Private member report**\n**Reported member:** <@" + targetId + ">\n**Reason:** " + reason +
        "\n\nThis report is visible only to you and the Snoozer moderation team. The reported member has not been notified.",
    });
    let reportLogged = false;
    try {
      const channels = await this.api.request("/guilds/" + this.guildId + "/channels");
      const log = Array.isArray(channels) ? channels.find(item => item.type === 0 && (this.channelIds.moderationLog ? item.id === this.channelIds.moderationLog : item.name === "moderation-log")) : null;
      if (log?.id) {
        await this.api.request("/channels/" + log.id + "/messages", {
          method: "POST",
          body: {
            embeds: [{
              title: "Private member report opened",
              description: "**Reporter:** <@" + reporterId + ">\n**Reported member:** <@" + targetId + ">\n**Report channel:** <#" + result.channel.id + ">",
              color: 0xd5a33c,
              timestamp: new Date().toISOString(),
            }],
            allowed_mentions: { parse: [] },
          },
        });
        reportLogged = true;
      }
    } catch (error) {
      this.logger.error("[discord-community] private report opened but its moderation log entry failed: " + (error?.message ?? error));
    }
    return "Your private report has been sent to the moderation team: <#" + result.channel.id + ">." +
      (result.welcomeMessageSent ? "" : " The channel exists, but Discord rejected its opening message.") +
      (reportLogged ? "" : " The private report is open, but its staff log could not be written.");
  }

  async moderationLog(action, interaction, targetId, reason, extra = "") {
    try {
      const channels = await this.api.request("/guilds/" + this.guildId + "/channels");
      const log = Array.isArray(channels) ? channels.find(item => item.type === 0 && (this.channelIds.moderationLog ? item.id === this.channelIds.moderationLog : item.name === "moderation-log")) : null;
      if (!log?.id) {
        this.logger.error("[discord-community] moderation action completed but #moderation-log was not found.");
        return false;
      }
      const moderatorId = interaction.member?.user?.id ?? interaction.user?.id;
      await this.api.request("/channels/" + log.id + "/messages", {
        method: "POST",
        body: {
          embeds: [{
            title: "Moderation action: " + action,
            description: "**Moderator:** <@" + moderatorId + ">\n**Member:** <@" + targetId + ">\n**Reason:** " + reason +
              (extra ? "\n" + extra : ""),
            color: 0xd65a68,
            timestamp: new Date().toISOString(),
          }],
          allowed_mentions: { parse: [] },
        },
      });
      return true;
    } catch (error) {
      this.logger.error("[discord-community] moderation action completed but its log entry failed: " + (error?.message ?? error));
      return false;
    }
  }

  async moderate(interaction, action) {
    const targetId = option(interaction, "user");
    const reason = cleanText(option(interaction, "reason"), 500);
    if (!safeSnowflake(targetId) || reason.length < 5) throw new Error("Select a valid member and provide a reason of at least 5 characters.");
    const actorId = interaction.member?.user?.id ?? interaction.user?.id;
    if (targetId === actorId) throw new Error("You cannot apply this moderation action to yourself.");

    if (action === "warn") {
      let dmSent = false;
      try {
        const dm = await this.api.request("/users/@me/channels", { method: "POST", body: { recipient_id: targetId } });
        if (dm?.id) {
          await this.api.request("/channels/" + dm.id + "/messages", {
            method: "POST",
            body: { content: "You have received a formal warning in the Snoozer Discord server.\n**Reason:** " + reason, allowed_mentions: { parse: [] } },
          });
          dmSent = true;
        }
      } catch (error) {
        this.logger.warn("[discord-community] warning DM could not be delivered: " + (error?.message ?? error));
      }
      const logged = await this.moderationLog("Warning", interaction, targetId, reason, "Direct message delivered: " + (dmSent ? "yes" : "no"));
      return "The warning has been recorded in the moderation log." + (dmSent ? " The member was also sent a direct message." : " Discord did not allow the warning DM to be delivered.") +
        (logged ? "" : " Warning: the moderation log channel could not be found.");
    }

    const headers = { "X-Audit-Log-Reason": encodeAuditReason(reason) };
    if (action === "timeout") {
      const minutes = Number(option(interaction, "minutes"));
      if (!Number.isInteger(minutes) || minutes < 1 || minutes > 40_320) throw new Error("Timeout duration must be between 1 and 40,320 minutes.");
      const until = new Date(Date.now() + minutes * 60_000).toISOString();
      await this.api.request("/guilds/" + this.guildId + "/members/" + targetId, {
        method: "PATCH",
        headers,
        body: { communication_disabled_until: until },
      });
      const logged = await this.moderationLog("Timeout", interaction, targetId, reason, "Duration: " + minutes + " minute(s)\nUntil: " + until);
      return "The member has been timed out for " + minutes + " minute(s)." + (logged ? "" : " Warning: #moderation-log could not be found.");
    }

    if (action === "kick") {
      await this.api.request("/guilds/" + this.guildId + "/members/" + targetId, { method: "DELETE", headers });
      const logged = await this.moderationLog("Kick", interaction, targetId, reason);
      return "The member has been kicked from the server." + (logged ? "" : " Warning: #moderation-log could not be found.");
    }

    await this.api.request("/guilds/" + this.guildId + "/bans/" + targetId, {
      method: "PUT",
      headers,
      body: { delete_message_seconds: 0 },
    });
    const logged = await this.moderationLog("Ban", interaction, targetId, reason);
    return "The member has been banned from the server." + (logged ? "" : " Warning: #moderation-log could not be found.");
  }

  async handle(interaction) {
    if (interaction.guild_id !== this.guildId || interaction.application_id !== this.applicationId) return;
    const name = interaction.data?.name;
    if (!DISCORD_COMMUNITY_COMMAND_NAMES.has(name)) return;

    if (name === "snoozer-help") {
      await this.immediate(interaction, {
        embeds: [{
          title: "Snoozer community commands",
          description: "Use these commands to get help from the Snoozer team.",
          color: 0x8b72d9,
          fields: [
            { name: "General", value: "/snoozer-status — live service health\n/snoozer-help — this command guide" },
            { name: "Support", value: "/snoozer-ticket — open a private ticket\n/snoozer-ticket-close — close your ticket\n/snoozer-bug — submit a bug\n/snoozer-suggest — suggest an improvement\n/snoozer-report — privately report a member" },
            { name: "Staff", value: "/snoozer-changelog — publish release notes\n/snoozer-warn, /snoozer-timeout, /snoozer-kick, /snoozer-ban\n/snoozer-reconcile — Administrator-only server repair" },
          ],
          footer: { text: "Snoozer · snoozer.uk" },
        }],
      }, true);
      return;
    }

    const isPublic = name === "snoozer-status";
    await this.acknowledge(interaction, !isPublic);
    try {
      let content = "";
      let embeds = [];
      if (name === "snoozer-status") {
        embeds = [this.statusEmbed(await this.fetchStatus())];
      } else if (name === "snoozer-changelog") {
        content = await this.publishChangelog(interaction);
      } else if (name === "snoozer-ticket") {
        content = await this.submitTicket(interaction);
      } else if (name === "snoozer-ticket-close") {
        content = await this.closeTicket(interaction);
      } else if (name === "snoozer-bug") {
        content = await this.submitPublicFeedback(interaction, "bug-reports", "bug");
      } else if (name === "snoozer-suggest") {
        content = await this.submitPublicFeedback(interaction, "suggestions", "suggestion");
      } else if (name === "snoozer-report") {
        content = await this.reportMember(interaction);
      } else if (name === "snoozer-warn" || name === "snoozer-timeout" || name === "snoozer-kick" || name === "snoozer-ban") {
        const permissions = {
          "snoozer-warn": PERMISSIONS.manageMessages,
          "snoozer-timeout": PERMISSIONS.moderateMembers,
          "snoozer-kick": PERMISSIONS.kickMembers,
          "snoozer-ban": PERMISSIONS.banMembers,
        };
        if (!hasPermission(interaction.member?.permissions, permissions[name])) {
          throw new Error("You do not have the Discord permission required for this moderation command.");
        }
        content = await this.moderate(interaction, name.replace("snoozer-", ""));
      }

      await this.complete(interaction, { content, embeds });
    } catch (error) {
      const detail = cleanText(error?.message ?? "Unknown error", 900) || "Unknown error";
      this.logger.error("[discord-community] command " + name + " failed: " + (error?.stack ?? detail));
      try { await this.logEvent?.({ title:"Bot command failed", description:"Command: /"+cleanText(name,100)+"\nMember: <@"+(interaction.member?.user?.id??interaction.user?.id??"unknown")+">\nError: "+detail, severity:"error" }); } catch {}
      await this.complete(interaction, { content: "The command could not be completed. " + detail });
    }
  }
}
