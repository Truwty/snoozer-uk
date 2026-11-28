import assert from "node:assert/strict";
import test from "node:test";
import {
  DiscordGuildSetup,
  SETUP_COMPLETE_MARKER,
  SNOOZER_SETUP_COMMAND,
  hasAdministratorPermission,
} from "../workers/discord-presence/server-setup.mjs";
import { DiscordPresenceWorker } from "../workers/discord-presence/worker.mjs";

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
