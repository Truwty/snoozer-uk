import assert from "node:assert/strict";
import test from "node:test";
import {
  DiscordGuildSetup,
  SETUP_COMPLETE_MARKER,
  SNOOZER_SETUP_COMMAND,
  hasAdministratorPermission,
} from "../workers/discord-presence/server-setup.mjs";
import { DiscordPresenceWorker, loadConfig } from "../workers/discord-presence/worker.mjs";

const guildId = "222222222222222222";
const botUserId = "333333333333333333";

function createGuildApi() {
  const roles = [{ id: guildId, name: "@everyone", permissions: "0" }];
  const channels = [];
  const messages = new Map();
  const calls = [];
  let nextId = 700000000000000000n;

  const api = {
    async request(path, options = {}) {
      const method = options.method ?? "GET";
      calls.push({ path, method, body: options.body });
      if (path === "/guilds/" + guildId + "/roles" && method === "GET") return structuredClone(roles);
      if (path === "/guilds/" + guildId + "/channels" && method === "GET") return structuredClone(channels);

      if (path === "/guilds/" + guildId + "/roles" && method === "POST") {
        const role = { id: String(nextId++), ...options.body };
        roles.push(role);
        return structuredClone(role);
      }

      const rolePath = path.match(/^\/guilds\/([0-9]+)\/roles\/([0-9]+)$/);
      if (rolePath && method === "PATCH") {
        const role = roles.find(item => item.id === rolePath[2]);
        assert.ok(role, "patched role should exist");
        Object.assign(role, options.body);
        return structuredClone(role);
      }

      if (path === "/guilds/" + guildId + "/channels" && method === "POST") {
        const channel = { id: String(nextId++), ...options.body };
        channels.push(channel);
        messages.set(channel.id, []);
        return structuredClone(channel);
      }

      const messagePath = path.match(/^\/channels\/([0-9]+)\/messages(?:\?limit=100)?$/);
      if (messagePath && method === "GET") return structuredClone(messages.get(messagePath[1]) ?? []);
      if (messagePath && method === "POST") {
        const created = { id: String(nextId++), ...options.body };
        messages.get(messagePath[1])?.push(created);
        return structuredClone(created);
      }

      const channelPath = path.match(/^\/channels\/([0-9]+)$/);
      if (channelPath && method === "PATCH") {
        const channel = channels.find(item => item.id === channelPath[1]);
        assert.ok(channel, "patched channel should exist");
        Object.assign(channel, options.body);
        return structuredClone(channel);
      }

      throw new Error("Unexpected mock Discord API request: " + method + " " + path);
    },
  };

  return { api, roles, channels, messages, calls };
}

test("server setup creates the Snoozer roles, channel layout and starter posts once", async () => {
  const state = createGuildApi();
  const setup = new DiscordGuildSetup({ guildId, botUserId, token: "test-token" }, {
    api: state.api,
    logger: { info() {}, warn() {}, error() {} },
  });

  const result = await setup.run();
  assert.equal(result.alreadyComplete, false);
  assert.equal(result.rolesCreated, 8);
  assert.equal(result.categoriesCreated, 6);
  assert.equal(result.channelsCreated, 24);
  assert.equal(result.messagesCreated, 3);

  assert.ok(state.roles.some(role => role.name === "Snoozer Admin" && role.permissions === "8"));
  assert.ok(state.roles.some(role => role.name === "Moderator" && role.permissions !== "0"));
  assert.ok(state.channels.some(channel => channel.name === "STAFF HQ" && channel.type === 4));
  assert.ok(state.channels.some(channel => channel.name === "moderation-log" && channel.permission_overwrites.length > 0));
  assert.ok(state.channels.some(channel => channel.name === "community-lounge" && channel.type === 2));

  const markerChannel = state.channels.find(channel => channel.name === "snoozer-setup-state");
  assert.ok(markerChannel.topic.includes(SETUP_COMPLETE_MARKER));
  assert.ok(state.messages.get(state.channels.find(channel => channel.name === "welcome").id).length === 1);
  assert.ok(state.messages.get(state.channels.find(channel => channel.name === "rules").id).length === 1);
  assert.ok(state.messages.get(state.channels.find(channel => channel.name === "faq").id).length === 1);

  const writeCount = state.calls.filter(call => call.method !== "GET").length;
  const secondResult = await setup.run();
  assert.equal(secondResult.alreadyComplete, true);
  assert.equal(state.calls.filter(call => call.method !== "GET").length, writeCount);
});

test("an identically named channel outside a category is not reused for a private staff channel", async () => {
  const state = createGuildApi();
  state.channels.push(
    { id: "600000000000000001", name: "OLDER CATEGORY", type: 4 },
    { id: "600000000000000002", name: "staff-chat", type: 0, parent_id: "600000000000000001" },
  );
  const setup = new DiscordGuildSetup({ guildId, botUserId, token: "test-token" }, {
    api: state.api,
    logger: { info() {}, warn() {}, error() {} },
  });

  await setup.run();
  const staffCategory = state.channels.find(channel => channel.type === 4 && channel.name === "STAFF HQ");
  const staffChat = state.channels.find(channel => channel.type === 0 && channel.name === "staff-chat" && channel.parent_id === staffCategory.id);
  assert.ok(staffChat, "setup should create a separate staff-chat channel under STAFF HQ");
  assert.notEqual(staffChat.id, "600000000000000002");
  assert.ok(staffChat.permission_overwrites.some(entry => entry.id === guildId && entry.d !== "0"));
});

test("a public or misplaced setup-state channel is rejected rather than trusted", async () => {
  const state = createGuildApi();
  state.channels.push(
    { id: "600000000000000003", name: "snoozer-setup-state", type: 0, topic: SETUP_COMPLETE_MARKER, parent_id: null },
  );
  const setup = new DiscordGuildSetup({ guildId, botUserId, token: "test-token" }, {
    api: state.api,
    logger: { info() {}, warn() {}, error() {} },
  });

  await assert.rejects(setup.run(), /already exists outside the private INTERNAL category/);
});

test("an interrupted setup can be safely resumed without duplicating existing resources", async () => {
  const state = createGuildApi();
  const originalRequest = state.api.request.bind(state.api);
  let failOnce = true;
  state.api.request = async (path, options = {}) => {
    if (failOnce && path === "/guilds/" + guildId + "/channels" && options.method === "POST" && options.body?.name === "general") {
      failOnce = false;
      throw new Error("simulated transient failure");
    }
    return originalRequest(path, options);
  };

  const setup = new DiscordGuildSetup({ guildId, botUserId, token: "test-token" }, {
    api: state.api,
    logger: { info() {}, warn() {}, error() {} },
  });
  await assert.rejects(setup.run(), /simulated transient failure/);
  assert.equal(state.channels.filter(channel => channel.name === "START HERE").length, 1);

  const resumed = await setup.run();
  assert.equal(resumed.alreadyComplete, false);
  assert.equal(state.channels.filter(channel => channel.name === "START HERE").length, 1);
  assert.equal(state.channels.filter(channel => channel.name === "general").length, 1);
  assert.ok(state.channels.find(channel => channel.name === "snoozer-setup-state").topic.includes(SETUP_COMPLETE_MARKER));
});

test("the setup command is restricted to administrators and requires explicit confirmation", () => {
  assert.equal(SNOOZER_SETUP_COMMAND.default_member_permissions, "8");
  assert.equal(SNOOZER_SETUP_COMMAND.options[0].name, "confirm");
  assert.equal(SNOOZER_SETUP_COMMAND.options[0].required, true);
  assert.equal(hasAdministratorPermission("8"), true);
  assert.equal(hasAdministratorPermission("0"), false);
  assert.equal(hasAdministratorPermission("not-a-permission"), false);
});

test("non-administrators cannot invoke the setup operation", async () => {
  const requests = [];
  const worker = new DiscordPresenceWorker({
    token: "test-token",
    secret: "s".repeat(64),
    guildId,
    baseUrl: "https://snoozer.example",
  }, {
    fetcher: async () => new Response(null, { status: 204 }),
    discordFetcher: async (url, options) => {
      requests.push({ url, options });
      return new Response(null, { status: 204 });
    },
    logger: { info() {}, warn() {}, error() {} },
  });
  worker.applicationId = botUserId;
  worker.botUserId = botUserId;

  await worker.handleServerSetupInteraction({
    id: "444444444444444444",
    application_id: botUserId,
    guild_id: guildId,
    token: "interaction-token",
    member: { permissions: "0" },
    data: { options: [{ name: "confirm", value: true }] },
  });

  assert.equal(requests.length, 1);
  assert.match(requests[0].url, /\/interactions\/444444444444444444\/interaction-token\/callback$/);
  const body = JSON.parse(requests[0].options.body);
  assert.equal(body.type, 4);
  assert.equal(body.data.flags, 64);
  assert.match(body.data.content, /Only a server administrator/);
});

test("setup interactions from a different guild are ignored", async () => {
  const requests = [];
  const worker = new DiscordPresenceWorker({
    token: "test-token",
    secret: "s".repeat(64),
    guildId,
    baseUrl: "https://snoozer.example",
  }, {
    fetcher: async () => new Response(null, { status: 204 }),
    discordFetcher: async (url, options) => {
      requests.push({ url, options });
      return new Response(null, { status: 204 });
    },
    logger: { info() {}, warn() {}, error() {} },
  });
  worker.applicationId = botUserId;

  await worker.handleServerSetupInteraction({
    id: "444444444444444444",
    application_id: botUserId,
    guild_id: "555555555555555555",
    token: "interaction-token",
    member: { permissions: "8" },
    data: { options: [{ name: "confirm", value: true }] },
  });

  assert.equal(requests.length, 0);
});

test("worker registers /snoozer-setup only in the configured guild", async () => {
  const requests = [];
  const worker = new DiscordPresenceWorker({
    token: "test-token",
    secret: "s".repeat(64),
    guildId,
    baseUrl: "https://snoozer.example",
  }, {
    fetcher: async () => new Response(null, { status: 204 }),
    discordFetcher: async (url, options) => {
      requests.push({ url, options });
      if (url.endsWith("/users/@me")) {
        return new Response(JSON.stringify({ id: botUserId }), { status: 200, headers: { "content-type": "application/json" } });
      }
      if (url.endsWith("/oauth2/applications/@me")) {
        return new Response(JSON.stringify({ id: "777777777777777777" }), { status: 200, headers: { "content-type": "application/json" } });
      }
      return new Response(JSON.stringify({ id: "666666666666666666", name: "snoozer-setup" }), {
        status: 201,
        headers: { "content-type": "application/json" },
      });
    },
    logger: { info() {}, warn() {}, error() {} },
  });

  await worker.registerServerSetupCommand();
  assert.equal(worker.applicationId, "777777777777777777");
  assert.equal(worker.botUserId, botUserId);
  assert.equal(requests.length, 3);
  assert.match(requests[2].url, new RegExp("/applications/777777777777777777/guilds/" + guildId + "/commands$"));
  assert.equal(requests[2].options.method, "PUT");
  const commands = JSON.parse(requests[2].options.body);
  const command = commands.find(item => item.name === "snoozer-setup");
  assert.ok(command);
  assert.equal(command.default_member_permissions, "8");
  assert.equal(command.options[0].name, "confirm");
});

test("Gateway command interactions are routed to the Snoozer setup handler", async () => {
  const worker = new DiscordPresenceWorker({
    token: "test-token",
    secret: "s".repeat(64),
    guildId,
    baseUrl: "https://snoozer.example",
  }, {
    fetcher: async () => new Response(null, { status: 204 }),
    logger: { info() {}, warn() {}, error() {} },
  });
  worker.applicationId = botUserId;
  let received = null;
  worker.handleServerSetupInteraction = async interaction => { received = interaction; };

  await worker.dispatch({
    t: "INTERACTION_CREATE",
    d: {
      type: 2,
      application_id: botUserId,
      guild_id: guildId,
      data: { name: "snoozer-setup" },
    },
  });

  assert.equal(received?.guild_id, guildId);
  assert.equal(received?.data?.name, "snoozer-setup");
});

test("server setup can run without enabling or configuring public Presence", () => {
  const config = loadConfig({
    DISCORD_SERVER_SETUP_ENABLED: "true",
    DISCORD_PRESENCE_ENABLED: "false",
    DISCORD_BOT_TOKEN: "test-token",
    DISCORD_PRESENCE_GUILD_ID: guildId,
  });
  assert.equal(config.serverSetupEnabled, true);
  assert.equal(config.presenceEnabled, false);
  assert.equal(config.baseUrl, "");
  assert.equal(config.secret, "");
  assert.throws(() => loadConfig({
    DISCORD_SERVER_SETUP_ENABLED: "false",
    DISCORD_PRESENCE_ENABLED: "false",
    DISCORD_BOT_TOKEN: "test-token",
    DISCORD_PRESENCE_GUILD_ID: guildId,
  }), /Enable DISCORD_SERVER_SETUP_ENABLED, DISCORD_BOT_ENABLED or DISCORD_PRESENCE_ENABLED/);
});


test("repair reconciles drifted Snoozer role and channel permissions without duplicating resources", async () => {
  const state = createGuildApi();
  const setup = new DiscordGuildSetup({ guildId, botUserId, token: "test-token" }, {
    api: state.api,
    logger: { info() {}, warn() {}, error() {} },
  });

  await setup.run();
  const moderator = state.roles.find(role => role.name === "Moderator");
  moderator.permissions = "0";
  moderator.color = 0;
  moderator.hoist = false;

  const staffCategory = state.channels.find(channel => channel.type === 4 && channel.name === "STAFF HQ");
  staffCategory.permission_overwrites = [{
    id: "600000000000000009",
    type: 0,
    allow: "1024",
    deny: "0",
  }];
  const staffChat = state.channels.find(channel => channel.type === 0 && channel.name === "staff-chat");
  staffChat.permission_overwrites = [{
    id: "600000000000000010",
    type: 1,
    allow: "1024",
    deny: "0",
  }];

  const channelCount = state.channels.length;
  const roleCount = state.roles.length;
  const messageCount = [...state.messages.values()].reduce((sum, messages) => sum + messages.length, 0);
  const result = await setup.repair();

  assert.equal(result.rolesUpdated, 1);
  assert.equal(result.categoriesUpdated, 1);
  assert.ok(result.channelsUpdated >= 1);
  assert.notEqual(moderator.permissions, "0");
  assert.ok(staffCategory.permission_overwrites.some(entry => entry.id === "600000000000000009"), "custom category override must survive repair");
  assert.ok(staffChat.permission_overwrites.some(entry => entry.id === "600000000000000010"), "custom channel override must survive repair");
  assert.ok(staffChat.permission_overwrites.some(entry => entry.id === guildId), "required Snoozer-managed privacy override must be restored");
  assert.equal(state.channels.length, channelCount);
  assert.equal(state.roles.length, roleCount);
  assert.equal([...state.messages.values()].reduce((sum, messages) => sum + messages.length, 0), messageCount);
});

test("setup-only mode identifies with the GUILDS intent and not the privileged Presence intent", async () => {
  const gatewayMessages = [];
  const worker = new DiscordPresenceWorker({
    token: "test-token",
    guildId,
    presenceEnabled: false,
    serverSetupEnabled: true,
  }, {
    fetcher: async () => new Response(null, { status: 204 }),
    logger: { info() {}, warn() {}, error() {} },
  });
  worker.socket = {
    readyState: 1,
    send: payload => gatewayMessages.push(JSON.parse(payload)),
  };

  await worker.handleMessage(JSON.stringify({ op: 10, d: { heartbeat_interval: 45_000 } }));
  const identify = gatewayMessages.find(message => message.op === 2);
  assert.equal(identify.d.intents, 1);
  worker.stopHeartbeat();
});
