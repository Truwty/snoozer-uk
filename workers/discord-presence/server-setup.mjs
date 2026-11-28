const API_BASE = "https://discord.com/api/v10";

const PERMISSIONS = {
  administrator: 1n << 3n,
  manageChannels: 1n << 4n,
  manageRoles: 1n << 28n,
  viewChannel: 1n << 10n,
  sendMessages: 1n << 11n,
  embedLinks: 1n << 14n,
  readMessageHistory: 1n << 16n,
  manageMessages: 1n << 13n,
  kickMembers: 1n << 1n,
  banMembers: 1n << 2n,
  viewAuditLog: 1n << 7n,
  moderateMembers: 1n << 40n,
  connect: 1n << 20n,
  speak: 1n << 21n,
};

const bitset = (...names) => names.reduce((value, name) => value | PERMISSIONS[name], 0n).toString();
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const normaliseName = value => String(value ?? "").trim().toLowerCase();

export const SETUP_COMPLETE_MARKER = "SNOOZER_SERVER_SETUP_COMPLETE:v1";
export const SETUP_PENDING_MARKER = "SNOOZER_SERVER_SETUP_PENDING:v1";

export const SNOOZER_CHANNEL_IDS = Object.freeze({
  welcome: "1576098516189708379",
  changelog: "1576098524607553738",
  serviceStatus: "1576098525937270835",
});

export const SNOOZER_SETUP_COMMAND = {
  name: "snoozer-setup",
  description: "Create the Snoozer community server structure (one-time, server administrators only).",
  type: 1,
  default_member_permissions: PERMISSIONS.administrator.toString(),
  options: [{
    type: 5,
    name: "confirm",
    description: "Confirm that you want to create the Snoozer server structure.",
    required: true,
  }],
};

export class DiscordApiClient {
  constructor(token, fetcher = globalThis.fetch, options = {}) {
    this.token = token;
    this.fetcher = fetcher;
    this.logger = options.logger ?? console;
  }

  async request(path, options = {}) {
    const method = options.method ?? "GET";
    const maxAttempts = options.maxAttempts ?? 5;
    const headers = { ...(options.headers ?? {}) };
    if (options.auth !== false) headers.Authorization = "Bot " + this.token;
    if (options.body !== undefined) headers["content-type"] = "application/json";

    for (let attempt = 0; attempt <= maxAttempts; attempt += 1) {
      const response = await this.fetcher(API_BASE + path, {
        method,
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: AbortSignal.timeout(15_000),
      });

      if (response.status === 204) return null;
      const raw = await response.text();
      let data = null;
      if (raw) {
        try {
          data = JSON.parse(raw);
        } catch {
          data = { message: raw.slice(0, 300) };
        }
      }

      if (response.status === 429 && attempt < maxAttempts) {
        const retryAfter = Number(data?.retry_after ?? response.headers.get("retry-after") ?? 1);
        await delay(Math.max(250, Math.min(15_000, retryAfter * 1_000)));
        continue;
      }

      if ([500, 502, 503, 504].includes(response.status) && attempt < maxAttempts) {
        await delay(Math.min(5_000, 500 * (2 ** attempt)));
        continue;
      }

      if (!response.ok) {
        const detail = typeof data?.message === "string" ? data.message : "No error detail returned";
        const code = data?.code ? " (Discord code " + data.code + ")" : "";
        throw new Error("Discord API " + method + " " + path + " failed with HTTP " + response.status + code + ": " + detail);
      }

      return data;
    }

    throw new Error("Discord API " + method + " " + path + " exhausted its retry limit.");
  }
}

const MODERATOR_PERMISSIONS = bitset("kickMembers", "banMembers", "viewAuditLog", "manageMessages", "moderateMembers");

const ROLE_DEFINITIONS = [
  { key: "admin", name: "Snoozer Admin", color: 0x8b72d9, hoist: true, permissions: bitset("administrator") },
  { key: "seniorModerator", name: "Senior Moderator", color: 0xb94b63, hoist: true, permissions: MODERATOR_PERMISSIONS },
  { key: "moderator", name: "Moderator", color: 0xd65a68, hoist: true, permissions: MODERATOR_PERMISSIONS },
  { key: "communityManager", name: "Community Manager", color: 0x438f9b, hoist: true, permissions: bitset("manageMessages") },
  { key: "supportManager", name: "Support Manager", color: 0x397fba, hoist: true, permissions: "0" },
  { key: "support", name: "Support Team", color: 0x4d91c9, hoist: true, permissions: "0" },
  { key: "ticketSupport", name: "Ticket Support", color: 0x69a8d7, hoist: true, permissions: "0" },
  { key: "developer", name: "Developer", color: 0x35a79b, hoist: true, permissions: "0" },
  { key: "eventHost", name: "Event Host", color: 0xc27b42, hoist: true, permissions: "0" },
  { key: "helper", name: "Community Helper", color: 0x72a68e, hoist: true, permissions: "0" },
  { key: "premium", name: "Premium", color: 0xc69a43, hoist: true, permissions: "0" },
  { key: "creator", name: "Creator", color: 0x64a982, hoist: true, permissions: "0" },
  { key: "member", name: "Member", color: 0x7a8493, hoist: false, permissions: "0" },
  { key: "bot", name: "Bots", color: 0x596579, hoist: false, permissions: "0" },
];


function mergeManagedOverwrites(current, desired) {
  const managedIds = new Set(desired.map(entry => String(entry.id)));
  const preserved = (Array.isArray(current) ? current : [])
    .filter(entry => !managedIds.has(String(entry.id)));
  return [...preserved, ...desired];
}

function sameOverwrites(left, right) {
  const signature = value => Array.isArray(value)
    ? value.map(entry => [
      String(entry.id),
      String(entry.type),
      String(entry.allow ?? "0"),
      String(entry.deny ?? "0"),
    ].join(":")).sort().join("|")
    : "";
  return signature(left) === signature(right);
}

function overwrite(id, type, allow = 0n, deny = 0n) {
  return { id, type, allow: allow.toString(), deny: deny.toString() };
}

function publicReadOnlyOverwrites(guildId, roles, botUserId) {
  const viewAndRead = PERMISSIONS.viewChannel | PERMISSIONS.readMessageHistory;
  const entries = [
    overwrite(guildId, 0, viewAndRead, PERMISSIONS.sendMessages),
    overwrite(botUserId, 1, viewAndRead | PERMISSIONS.sendMessages | PERMISSIONS.embedLinks, 0n),
  ];
  for (const key of ["admin", "developer", "communityManager"]) {
    if (roles[key]) entries.push(overwrite(roles[key], 0, viewAndRead | PERMISSIONS.sendMessages, 0n));
  }
  return entries;
}

function staffOverwrites(guildId, roles, botUserId, keys = ["admin", "moderator", "communityManager", "supportManager", "support", "ticketSupport", "developer"]) {
  const viewSendRead = PERMISSIONS.viewChannel | PERMISSIONS.sendMessages | PERMISSIONS.readMessageHistory | PERMISSIONS.embedLinks;
  const entries = [overwrite(guildId, 0, 0n, PERMISSIONS.viewChannel)];
  for (const key of keys) {
    if (roles[key]) entries.push(overwrite(roles[key], 0, viewSendRead, 0n));
  }
  entries.push(overwrite(botUserId, 1, viewSendRead, 0n));
  return entries;
}

function ticketLobbyOverwrites(guildId, roles, botUserId) {
  const viewRead = PERMISSIONS.viewChannel | PERMISSIONS.readMessageHistory;
  const viewSendRead = viewRead | PERMISSIONS.sendMessages | PERMISSIONS.embedLinks;
  const entries = [overwrite(guildId, 0, viewRead, PERMISSIONS.sendMessages)];
  for (const key of ["admin", "seniorModerator", "moderator", "communityManager", "supportManager", "support", "ticketSupport", "developer"]) {
    if (roles[key]) entries.push(overwrite(roles[key], 0, viewSendRead, 0n));
  }
  entries.push(overwrite(botUserId, 1, viewSendRead, 0n));
  return entries;
}

function staffVoiceOverwrites(guildId, roles, botUserId, keys) {
  const voice = PERMISSIONS.viewChannel | PERMISSIONS.connect | PERMISSIONS.speak;
  const entries = [overwrite(guildId, 0, 0n, PERMISSIONS.viewChannel)];
  for (const key of keys) {
    if (roles[key]) entries.push(overwrite(roles[key], 0, voice, 0n));
  }
  entries.push(overwrite(botUserId, 1, voice, 0n));
  return entries;
}

function readOnlyCategory(name, channels, guildId, roles, botUserId) {
  return { name, channels, permission_overwrites: publicReadOnlyOverwrites(guildId, roles, botUserId) };
}

function privateCategory(name, channels, guildId, roles, botUserId) {
  return { name, channels, permission_overwrites: staffOverwrites(guildId, roles, botUserId) };
}

function buildServerLayout(guildId, roles, botUserId, channelIds = SNOOZER_CHANNEL_IDS) {
  const staffDefault = staffOverwrites(guildId, roles, botUserId);
  const adminAndModerators = staffOverwrites(guildId, roles, botUserId, ["admin", "seniorModerator", "moderator"]);
  const adminSupportModerators = staffOverwrites(guildId, roles, botUserId, ["admin", "seniorModerator", "moderator", "communityManager", "supportManager", "support", "ticketSupport"]);
  const adminDevelopers = staffOverwrites(guildId, roles, botUserId, ["admin", "developer"]);
  const ticketOverwrites = ticketLobbyOverwrites(guildId, roles, botUserId);
  const internal = [overwrite(guildId, 0, 0n, PERMISSIONS.viewChannel)];
  if (roles.admin) internal.push(overwrite(roles.admin, 0, PERMISSIONS.viewChannel | PERMISSIONS.readMessageHistory, 0n));
  internal.push(overwrite(botUserId, 1, PERMISSIONS.viewChannel | PERMISSIONS.sendMessages | PERMISSIONS.readMessageHistory, 0n));

  return [
    readOnlyCategory("START HERE", [
      { name: "welcome", id: channelIds.welcome, topic: "Welcome to the official Snoozer community. New members are greeted here automatically. Start with #rules and #faq, then introduce yourself in #introductions." },
      { name: "rules", topic: "Read the community rules before chatting. Be respectful, protect personal information and follow Discord's Terms of Service." },
      { name: "announcements", topic: "Official Snoozer announcements. This channel is read-only; important platform news will be posted here." },
      { name: "server-updates", topic: "Community and server updates from the Snoozer team." },
      { name: "faq", topic: "Quick answers and links to the official Snoozer website and Help Centre." },
    ], guildId, roles, botUserId),
    readOnlyCategory("SNOOZER UPDATES", [
      { name: "changelog", id: channelIds.changelog, topic: "Official Snoozer release notes. New platform changes are published here by authorised team members." },
      { name: "service-status", id: channelIds.serviceStatus, topic: "Automated Snoozer service health updates. Check https://status.snoozer.uk for the live status page." },
      { name: "roadmap", topic: "Snoozer feature direction and planned improvements. Roadmap items may change." },
    ], guildId, roles, botUserId),
    {
      name: "COMMUNITY",
      channels: [
        { name: "general", topic: "General Snoozer community discussion. Keep conversations friendly and on topic." },
        { name: "introductions", topic: "Say hello, introduce yourself and share what you are building." },
        { name: "creator-showcase", topic: "Showcase your Snoozer profile, projects and creative work. No spam or unsolicited advertising." },
        { name: "off-topic", topic: "For conversations that do not fit the other channels." },
        { name: "server-boosts", topic: "A thank-you wall for everyone supporting Snoozer by boosting this server.", permission_overwrites: publicReadOnlyOverwrites(guildId, roles, botUserId) },
        { name: "community-lounge", type: 2 },
        { name: "creator-hangout", type: 2 },
      ],
    },
    {
      name: "SUPPORT & FEEDBACK",
      channels: [
        { name: "help-and-support", topic: "Community troubleshooting and general questions. For account-specific help, use https://help.snoozer.uk and never post passwords, payment details or private account information here." },
        { name: "bug-reports", topic: "Report reproducible Snoozer bugs. Include steps to reproduce and what you expected; never include secrets or personal data." },
        { name: "suggestions", topic: "Share constructive ideas for Snoozer. Explain the problem the suggestion would solve." },
        { name: "account-support", topic: "For private account, billing or personal-data requests, use the official Help Centre: https://help.snoozer.uk. Do not post personal or payment information in Discord." },
      ],
    },
    {
      name: "TICKETS",
      permission_overwrites: ticketOverwrites,
      channels: [
        { name: "open-a-ticket", topic: "Read the instructions and use /snoozer-ticket to open a private support channel. Never include passwords, authentication codes or payment details.", permission_overwrites: ticketOverwrites },
      ],
    },
    privateCategory("STAFF HQ", [
      { name: "staff-chat", topic: "Private coordination for the Snoozer team.", permission_overwrites: staffDefault },
      { name: "moderation-log", topic: "Restricted moderation activity and incident notes.", permission_overwrites: adminAndModerators },
      { name: "support-queue", topic: "Private support-team coordination. Do not copy passwords, payment details or unnecessary personal data into Discord.", permission_overwrites: adminSupportModerators },
      { name: "bot-commands", topic: "Staff-only bot command testing and operational notes.", permission_overwrites: adminDevelopers },
      { name: "staff-lounge", type: 2, permission_overwrites: staffVoiceOverwrites(guildId, roles, botUserId, ["admin", "seniorModerator", "moderator", "communityManager", "supportManager", "support", "ticketSupport", "developer"]) },
    ], guildId, roles, botUserId),
    {
      name: "INTERNAL",
      permission_overwrites: internal,
      channels: [
        {
          name: "snoozer-setup-state",
          topic: SETUP_PENDING_MARKER + " | This private channel stores the one-time setup completion marker. Do not delete it.",
          permission_overwrites: internal,
        },
      ],
    },
  ].map(category => ({
    ...category,
    channels: category.channels.map(channel => ({
      type: channel.type ?? 0,
      ...channel,
      permission_overwrites: channel.permission_overwrites ?? category.permission_overwrites,
    })),
  }));
}

const STARTER_MESSAGES = [
  {
    channel: "welcome",
    footer: "SNOOZER_SERVER_SETUP:v1:welcome",
    title: "Welcome to Snoozer",
    description: "Welcome to the official Snoozer community.\n\n" +
      "• Read the community rules in **#rules**.\n" +
      "• Find quick answers in **#faq**.\n" +
      "• Introduce yourself in **#introductions**.\n" +
      "• Share your profile in **#creator-showcase**.\n" +
      "• Open a private support request in **#open-a-ticket**.\n\n" +
      "New members are greeted here automatically.\n\n" +
      "[Open Snoozer](https://snoozer.uk) · [Help Centre](https://help.snoozer.uk)",
    color: 0x8b72d9,
  },
  {
    channel: "rules",
    footer: "SNOOZER_SERVER_SETUP:v1:rules",
    title: "Snoozer community rules",
    description: "1. **Be respectful.** No harassment, hate, threats or targeted abuse.\n" +
      "2. **No spam or scams.** Do not flood channels, phish, impersonate staff or post malicious links.\n" +
      "3. **Protect privacy.** Never share passwords, login codes, payment details, private messages or another person's personal information.\n" +
      "4. **Keep content appropriate.** Follow Discord's Terms of Service and Community Guidelines.\n" +
      "5. **Use the right channels.** Keep support requests, bug reports and suggestions in their dedicated areas.\n" +
      "6. **No unsolicited advertising.** Share Snoozer profiles and projects only where relevant.\n" +
      "7. **Follow staff instructions.** Moderators may remove content or restrict access when needed.\n\n" +
      "Discord's rules and Snoozer's published policies both apply. Serious or repeated violations may result in removal from the community.",
    color: 0xd65a68,
  },
  {
    channel: "faq",
    footer: "SNOOZER_SERVER_SETUP:v1:faq",
    title: "Quick help",
    description: "Need help with Snoozer?\n\n" +
      "• **Website:** https://snoozer.uk\n" +
      "• **Help Centre:** https://help.snoozer.uk\n" +
      "• **Service status:** https://status.snoozer.uk\n" +
      "• **Bug report:** use **#bug-reports** and include clear reproduction steps.\n" +
      "• **Feature idea:** post it in **#suggestions**.\n" +
      "• **Private support:** use **#open-a-ticket** and run **/snoozer-ticket**.\n\n" +
      "For account, billing, privacy or deletion requests, use the Help Centre rather than posting personal information in this server. Snoozer staff will never ask for your password or authentication codes.",
    color: 0x4d91c9,
  },
  {
    channel: "changelog",
    footer: "SNOOZER_SERVER_SETUP:v1:changelog",
    title: "Snoozer changelog",
    description: "Official product releases, new features, improvements and fixes will be posted in this channel by the Snoozer team.\n\n" +
      "Authorised staff can publish an entry with **/snoozer-changelog**.",
    color: 0x35a79b,
  },
  {
    channel: "service-status",
    footer: "SNOOZER_SERVER_SETUP:v1:service-status",
    title: "Snoozer service status",
    description: "Automated service updates are posted here when the overall Snoozer service state changes.\n\n" +
      "[Open the live status page](https://status.snoozer.uk)",
    color: 0x4d91c9,
  },
  {
    channel: "open-a-ticket",
    footer: "SNOOZER_SERVER_SETUP:v1:open-a-ticket",
    title: "Need help? Open a ticket",
    description: "Use **/snoozer-ticket** to create a private support channel with the Snoozer team.\n\n" +
      "Please include a clear subject and enough detail for the team to investigate. A member of staff will reply in your private ticket.\n\n" +
      "Never share passwords, one-time codes, payment card details or private account credentials.",
    color: 0x8b72d9,
  },
  {
    channel: "server-boosts",
    footer: "SNOOZER_SERVER_SETUP:v1:server-boosts",
    title: "Snoozer server boosters",
    description: "Thank you to everyone who supports the Snoozer community by boosting the server.\n\n" +
      "The bot automatically posts a thank-you message here when a new boost is detected.",
    color: 0xc69a43,
  },
];

export class DiscordGuildSetup {
  constructor(config, dependencies = {}) {
    this.guildId = config.guildId;
    this.botUserId = config.botUserId;
    this.channelIds = config.channelIds ?? dependencies.channelIds ?? SNOOZER_CHANNEL_IDS;
    this.api = dependencies.api ?? new DiscordApiClient(config.token, dependencies.fetcher, { logger: dependencies.logger });
    this.logger = dependencies.logger ?? console;
  }

  async listGuildResources() {
    const [roles, channels] = await Promise.all([
      this.api.request("/guilds/" + this.guildId + "/roles"),
      this.api.request("/guilds/" + this.guildId + "/channels"),
    ]);
    if (!Array.isArray(roles) || !Array.isArray(channels)) {
      throw new Error("Discord did not return the configured guild's roles and channels.");
    }
    return { roles, channels };
  }

  async ensureRoles(existingRoles) {
    const rolesByName = new Map(existingRoles.map(role => [normaliseName(role.name), role]));
    const ids = {};
    let created = 0;
    let updated = 0;
    for (const definition of ROLE_DEFINITIONS) {
      let role = rolesByName.get(normaliseName(definition.name));
      const desired = {
        name: definition.name,
        permissions: definition.permissions,
        color: definition.color,
        hoist: definition.hoist,
        mentionable: false,
      };
      if (!role) {
        role = await this.api.request("/guilds/" + this.guildId + "/roles", {
          method: "POST",
          body: desired,
        });
        if (!role?.id) throw new Error("Discord did not return the created role ID for " + definition.name + ".");
        rolesByName.set(normaliseName(definition.name), role);
        created += 1;
      } else if (String(role.permissions ?? "0") !== desired.permissions
        || Number(role.color ?? 0) !== desired.color
        || Boolean(role.hoist) !== desired.hoist
        || Boolean(role.mentionable) !== false) {
        const updatedRole = await this.api.request("/guilds/" + this.guildId + "/roles/" + role.id, {
          method: "PATCH",
          body: desired,
        });
        role = updatedRole?.id ? updatedRole : { ...role, ...desired };
        rolesByName.set(normaliseName(definition.name), role);
        updated += 1;
      }
      ids[definition.key] = role.id;
    }
    return { ids, created, updated };
  }

  validateConfiguredChannels(channels) {
    for (const [name, id] of Object.entries(this.channelIds)) {
      if (!id) continue;
      const channel = channels.find(item => item.id === id);
      if (!channel) {
        throw new Error("The configured #" + (name === "serviceStatus" ? "service-status" : name) +
          " channel ID " + id + " was not found in this Discord server. Check DISCORD_PRESENCE_GUILD_ID and the channel ID before repairing.");
      }
      if (channel.type !== 0) {
        throw new Error("The configured channel ID for #" + (name === "serviceStatus" ? "service-status" : name) +
          " is not a text channel. No server changes were made.");
      }
    }
  }

  async ensureCategory(category, existingChannels, counts) {
    let channel = existingChannels.find(item => item.type === 4 && normaliseName(item.name) === normaliseName(category.name));
    if (!channel) {
      const body = { name: category.name, type: 4 };
      if (category.permission_overwrites) body.permission_overwrites = category.permission_overwrites;
      channel = await this.api.request("/guilds/" + this.guildId + "/channels", { method: "POST", body });
      if (!channel?.id) throw new Error("Discord did not return the category ID for " + category.name + ".");
      existingChannels.push(channel);
      counts.categoriesCreated += 1;
    } else if (category.permission_overwrites) {
      const permissionOverwrites = mergeManagedOverwrites(channel.permission_overwrites, category.permission_overwrites);
      if (!sameOverwrites(channel.permission_overwrites, permissionOverwrites)) {
        const updated = await this.api.request("/channels/" + channel.id, {
          method: "PATCH",
          body: { permission_overwrites: permissionOverwrites },
        });
        channel = updated?.id ? updated : { ...channel, permission_overwrites: permissionOverwrites };
        Object.assign(existingChannels.find(item => item.id === channel.id), channel);
        counts.categoriesUpdated += 1;
      }
    }
    return channel;
  }

  async ensureChannel(definition, parent, existingChannels, counts) {
    let channel = definition.id
      ? existingChannels.find(item => item.id === definition.id)
      : existingChannels.find(item => item.type === definition.type
        && normaliseName(item.name) === normaliseName(definition.name)
        && item.parent_id === parent.id);

    if (definition.id && !channel) {
      throw new Error("The configured channel ID for #" + definition.name + " (" + definition.id +
        ") was not found in the configured Snoozer server. Check the channel ID before repairing.");
    }
    if (channel && channel.type !== definition.type) {
      throw new Error("The existing channel for #" + definition.name + " has the wrong channel type. No channel was changed.");
    }

    if (channel) {
      const updates = {};
      if (channel.name !== definition.name) updates.name = definition.name;
      if (channel.parent_id !== parent.id) updates.parent_id = parent.id;
      if (definition.topic && channel.topic !== definition.topic) updates.topic = definition.topic;
      if (definition.permission_overwrites) {
        const permissionOverwrites = mergeManagedOverwrites(channel.permission_overwrites, definition.permission_overwrites);
        if (!sameOverwrites(channel.permission_overwrites, permissionOverwrites)) {
          updates.permission_overwrites = permissionOverwrites;
        }
      }
      if (Object.keys(updates).length) {
        const updated = await this.api.request("/channels/" + channel.id, {
          method: "PATCH",
          body: updates,
        });
        channel = updated?.id ? updated : { ...channel, ...updates };
        Object.assign(existingChannels.find(item => item.id === channel.id), channel);
        counts.channelsUpdated += 1;
      }
      return channel;
    }

    if (definition.name === "snoozer-setup-state" && existingChannels.some(item =>
      item.type === 0 && normaliseName(item.name) === "snoozer-setup-state")) {
      throw new Error("A channel named #snoozer-setup-state already exists outside the private INTERNAL category. Rename it before running setup; the bot will not repurpose a possibly public channel.");
    }

    const body = {
      name: definition.name,
      type: definition.type,
      parent_id: parent.id,
    };
    if (definition.topic) body.topic = definition.topic;
    if (definition.permission_overwrites) body.permission_overwrites = definition.permission_overwrites;
    channel = await this.api.request("/guilds/" + this.guildId + "/channels", { method: "POST", body });
    if (!channel?.id) throw new Error("Discord did not return the channel ID for #" + definition.name + ".");
    existingChannels.push(channel);
    counts.channelsCreated += 1;
    return channel;
  }

  async ensureStarterMessage(channel, definition) {
    const messages = await this.api.request("/channels/" + channel.id + "/messages?limit=100");
    const alreadyPosted = Array.isArray(messages) && messages.some(message =>
      Array.isArray(message.embeds) && message.embeds.some(embed => embed?.footer?.text === definition.footer));
    if (alreadyPosted) return false;

    await this.api.request("/channels/" + channel.id + "/messages", {
      method: "POST",
      body: {
        embeds: [{
          title: definition.title,
          description: definition.description,
          color: definition.color,
          footer: { text: definition.footer },
        }],
        allowed_mentions: { parse: [] },
      },
    });
    return true;
  }

  async repair() {
    const resources = await this.listGuildResources();
    this.validateConfiguredChannels(resources.channels);
    if (!/^[1-9][0-9]{16,19}$/.test(this.botUserId ?? "")) {
      throw new Error("The Discord bot user ID is unavailable; restart the worker before repairing the server.");
    }

    const roleResult = await this.ensureRoles(resources.roles);
    const layout = buildServerLayout(this.guildId, roleResult.ids, this.botUserId, this.channelIds);
    const counts = {
      rolesCreated: roleResult.created,
      rolesUpdated: roleResult.updated,
      categoriesCreated: 0,
      categoriesUpdated: 0,
      channelsCreated: 0,
      channelsUpdated: 0,
      messagesCreated: 0,
    };
    const channelIds = new Map();

    for (const categoryDefinition of layout) {
      const category = await this.ensureCategory(categoryDefinition, resources.channels, counts);
      for (const channelDefinition of categoryDefinition.channels) {
        const channel = await this.ensureChannel(channelDefinition, category, resources.channels, counts);
        channelIds.set(channelDefinition.name, channel);
      }
    }

    for (const messageDefinition of STARTER_MESSAGES) {
      const channel = channelIds.get(messageDefinition.channel);
      if (channel && await this.ensureStarterMessage(channel, messageDefinition)) counts.messagesCreated += 1;
    }

    const stateChannel = channelIds.get("snoozer-setup-state");
    if (!stateChannel) throw new Error("The private setup state channel could not be created.");
    if (!stateChannel.topic?.includes(SETUP_COMPLETE_MARKER)) {
      const completedAt = new Date().toISOString();
      await this.api.request("/channels/" + stateChannel.id, {
        method: "PATCH",
        body: { topic: SETUP_COMPLETE_MARKER + " | completed_at=" + completedAt },
      });
    }

    return { repaired: true, ...counts };
  }

  async run() {
    const resources = await this.listGuildResources();
    this.validateConfiguredChannels(resources.channels);
    const internalCategory = resources.channels.find(channel =>
      channel.type === 4 && normaliseName(channel.name) === "internal");
    const markerChannel = internalCategory
      ? resources.channels.find(channel => channel.type === 0
        && normaliseName(channel.name) === "snoozer-setup-state"
        && channel.parent_id === internalCategory.id)
      : null;
    const markerAccess = Array.isArray(markerChannel?.permission_overwrites)
      ? markerChannel.permission_overwrites.find(entry => entry.id === this.guildId && entry.type === 0)
      : null;
    const markerIsPrivate = markerAccess
      && (BigInt(markerAccess.deny ?? "0") & PERMISSIONS.viewChannel) === PERMISSIONS.viewChannel;
    if (markerChannel?.topic?.includes(SETUP_COMPLETE_MARKER) && markerIsPrivate) {
      return { alreadyComplete: true, completedAt: markerChannel.topic.split("completed_at=")[1]?.trim() ?? null };
    }
    if (resources.channels.some(channel => channel.type === 0
      && normaliseName(channel.name) === "snoozer-setup-state")
      && !markerChannel) {
      throw new Error("A channel named #snoozer-setup-state already exists outside the private INTERNAL category. Rename it before running setup; the bot will not treat a public or misplaced channel as its completion marker.");
    }

    if (!/^[1-9][0-9]{16,19}$/.test(this.botUserId ?? "")) {
      throw new Error("The Discord bot user ID is unavailable; restart the worker so it can register the setup command before running it.");
    }

    const roleResult = await this.ensureRoles(resources.roles);
    const layout = buildServerLayout(this.guildId, roleResult.ids, this.botUserId, this.channelIds);
    const counts = {
      rolesCreated: roleResult.created,
      rolesUpdated: roleResult.updated,
      categoriesCreated: 0,
      categoriesUpdated: 0,
      channelsCreated: 0,
      channelsUpdated: 0,
      messagesCreated: 0,
    };
    const channelIds = new Map();

    for (const categoryDefinition of layout) {
      const category = await this.ensureCategory(categoryDefinition, resources.channels, counts);
      for (const channelDefinition of categoryDefinition.channels) {
        const channel = await this.ensureChannel(channelDefinition, category, resources.channels, counts);
        channelIds.set(channelDefinition.name, channel);
      }
    }

    for (const messageDefinition of STARTER_MESSAGES) {
      const channel = channelIds.get(messageDefinition.channel);
      if (channel && await this.ensureStarterMessage(channel, messageDefinition)) counts.messagesCreated += 1;
    }

    const stateChannel = channelIds.get("snoozer-setup-state");
    if (!stateChannel) throw new Error("The private setup state channel could not be created.");
    const completedAt = new Date().toISOString();
    await this.api.request("/channels/" + stateChannel.id, {
      method: "PATCH",
      body: { topic: SETUP_COMPLETE_MARKER + " | completed_at=" + completedAt },
    });

    return { alreadyComplete: false, completedAt, ...counts };
  }
}

export function hasAdministratorPermission(permissionValue) {
  try {
    return (BigInt(permissionValue ?? "0") & PERMISSIONS.administrator) === PERMISSIONS.administrator;
  } catch {
    return false;
  }
}
