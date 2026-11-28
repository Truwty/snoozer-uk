import test from "node:test";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

import { SNOOZER_ROLE_LAYOUT, SNOOZER_SERVER_LAYOUT, SNOOZER_RESOURCE_KEYS } from "../workers/discord-presence/server-layout.mjs";
import { DiscordStore } from "../workers/discord-presence/discord-store.mjs";
import { DiscordServerRebuilder } from "../workers/discord-presence/server-rebuilder.mjs";
import { DiscordCommunityPanels, SNOOZER_REBUILD_COMMAND } from "../workers/discord-presence/community-panels.mjs";
import { DiscordSecurityGuard } from "../workers/discord-presence/security-guard.mjs";
import { DiscordApiClient, SETUP_COMPLETE_MARKER } from "../workers/discord-presence/server-setup.mjs";
import { buildGuildCommands, DiscordPresenceWorker } from "../workers/discord-presence/worker.mjs";

const guildId = "1574262035519115284";
const botUserId = "1574262035519115285";
const snowflake = value => /^[1-9][0-9]{16,19}$/.test(value);

test("new Snoozer server layout has unique resource keys and names", () => {
  const categoryKeys = SNOOZER_SERVER_LAYOUT.map(category => category.key);
  assert.equal(new Set(categoryKeys).size, categoryKeys.length);

  const channelKeys = SNOOZER_SERVER_LAYOUT.flatMap(category => category.channels.map(channel => channel.key));
  assert.equal(new Set(channelKeys).size, channelKeys.length);
  assert.ok(channelKeys.includes("welcome"));
  assert.ok(channelKeys.includes("member_hub"));
  assert.ok(channelKeys.includes("ticket_panel"));
  assert.ok(channelKeys.includes("service_status"));
  assert.ok(channelKeys.includes("bot_control"));
  assert.ok(channelKeys.includes("moderation_log"));
  assert.ok(channelKeys.includes("security_alerts"));
  assert.ok(channelKeys.includes("server_boosts"));
  assert.ok(channelKeys.includes("goodbye"));

  const roleKeys = SNOOZER_ROLE_LAYOUT.map(role => role.key);
  assert.equal(new Set(roleKeys).size, roleKeys.length);
  for (const required of ["admin","moderator","premium","creator","member","booster","notify_updates","notify_events","notify_giveaways"]) {
    assert.ok(roleKeys.includes(required), "missing role " + required);
  }

  const resourceKeys = SNOOZER_RESOURCE_KEYS.map(resource => resource.key);
  assert.equal(new Set(resourceKeys).size, resourceKeys.length);
  assert.ok(SNOOZER_SERVER_LAYOUT.every(category => category.name.length <= 100));
  assert.ok(SNOOZER_SERVER_LAYOUT.flatMap(category => category.channels).every(channel => channel.name.length <= 100));
});

test("DiscordStore uses the service-only public RPC surface", async () => {
  let captured;
  const store = new DiscordStore({
    url: "https://example.supabase.co",
    serviceKey: "test-service-role-key",
  }, {
    fetcher: async (url, options) => {
      captured = { url, options };
      return new Response("true", { status: 200, headers: { "content-type": "application/json" } });
    },
  });
  const ok = await store.registerResources(guildId, [{
    resource_key: "guild",
    resource_type: "category",
    discord_id: guildId,
    name: "Snoozer Discord Guild",
  }]);
  assert.equal(ok, true);
  assert.equal(captured.url, "https://example.supabase.co/rest/v1/rpc/discord_bot_register_resources");
  assert.equal(captured.options.method, "POST");
  assert.equal(captured.options.headers.apikey, "test-service-role-key");
  assert.equal(captured.options.headers["Content-Profile"], "public");
  assert.deepEqual(JSON.parse(captured.options.body), {
    p_guild_id: guildId,
    p_resources: [{
      resource_key: "guild", resource_type: "category", discord_id: guildId, name: "Snoozer Discord Guild",
    }],
  });
});

test("DiscordStore rejects invalid Supabase configuration and RPC names", async () => {
  assert.throws(() => new DiscordStore({ url: "http://not-https", serviceKey: "key" }), /not configured/i);
  const store = new DiscordStore({ url: "https://example.supabase.co", serviceKey: "key" }, {
    fetcher: async () => new Response("{}", { status: 200 }),
  });
  await assert.rejects(store.rpc("../admin"), /Invalid internal Discord RPC name/);
});

test("DiscordStore surfaces useful PostgREST details for failed storage operations", async () => {
  const store = new DiscordStore({ url: "https://example.supabase.co", serviceKey: "key" }, {
    fetcher: async () => new Response(JSON.stringify({
      code: "42702",
      message: 'column reference "display_name" is ambiguous',
      details: "It could refer to either a PL/pgSQL variable or a table column.",
    }), { status: 400, headers: { "content-type": "application/json" } }),
  });
  await assert.rejects(
    store.memberSummary("1574262035519115287"),
    /HTTP 400.*42702.*display_name.*ambiguous/,
  );
});

test("DiscordStore routes ticket and Creator submissions through persistent cooldown RPCs", async () => {
  const calls = [];
  const store = new DiscordStore({ url: "https://example.supabase.co", serviceKey: "key" }, {
    fetcher: async (url, options) => {
      calls.push({ url, body: JSON.parse(options.body) });
      const result = url.endsWith("/discord_bot_ticket_preflight")
        ? { allowed: true }
        : { created: false, reason: "cooldown", retry_after_seconds: 86_400 };
      return new Response(JSON.stringify(result), { status: 200, headers: { "content-type": "application/json" } });
    },
  });

  const ownerId = "1574262035519115835";
  const discordId = "1574262035519115836";
  const ticket = await store.ticketPreflight(guildId, ownerId);
  const creator = await store.creatorRequest(discordId, "https://snoozer.uk/testcreator", "I create useful community projects and tutorials.");

  assert.deepEqual(ticket, { allowed: true });
  assert.deepEqual(creator, { created: false, reason: "cooldown", retry_after_seconds: 86_400 });
  assert.equal(calls[0].url, "https://example.supabase.co/rest/v1/rpc/discord_bot_ticket_preflight");
  assert.deepEqual(calls[0].body, { p_guild_id: guildId, p_owner_discord_id: ownerId });
  assert.equal(calls[1].url, "https://example.supabase.co/rest/v1/rpc/discord_bot_creator_request_limited");
  assert.deepEqual(calls[1].body, {
    p_discord_user_id: discordId,
    p_profile_url: "https://snoozer.uk/testcreator",
    p_reason: "I create useful community projects and tutorials.",
  });
});

test("ticket reliability migration matches the existing ticket event and job constraints", async () => {
  const sql = await readFile(new URL("../supabase/migrations/20261128101500_discord_bot_reliability_and_cooldowns.sql", import.meta.url), "utf8");
  const actionStart = sql.indexOf("create or replace function public.discord_bot_ticket_action");
  const enqueueStart = sql.indexOf("create or replace function public.discord_bot_enqueue_job", actionStart);
  assert.ok(actionStart >= 0 && enqueueStart > actionStart);
  const actionSql = sql.slice(actionStart, enqueueStart);
  assert.match(actionSql, /when 'claim' then 'claimed'/);
  assert.match(actionSql, /when 'assign' then 'assigned'/);
  assert.match(actionSql, /when 'close' then 'closed'/);
  assert.match(actionSql, /when 'reopen' then 'reopened'/);
  assert.match(actionSql, /when 'escalate' then 'escalated'/);
  assert.doesNotMatch(actionSql, /revoke all on function|grant execute on function/);

  const enqueueSql = sql.slice(enqueueStart);
  assert.match(enqueueSql, /'tempban_unban','ticket_delete'/);
  assert.match(sql, /revoke all on function public\.discord_bot_enqueue_job/);
  assert.match(sql, /grant execute on function public\.discord_bot_enqueue_job/);
  assert.equal(sql.split("$").length - 1, 10);
});

test("DiscordStore reads poll results through the service-only RPC", async () => {
  let captured;
  const store = new DiscordStore({ url: "https://example.supabase.co", serviceKey: "key" }, {
    fetcher: async (url, options) => {
      captured = { url, body: JSON.parse(options.body) };
      return new Response(JSON.stringify({ total: 2, options: [] }), { status: 200 });
    },
  });
  const pollId = "c25d3f44-6c1a-4d9c-8c3d-21a81f6d4c90";
  const results = await store.pollResults(pollId);
  assert.equal(results.total, 2);
  assert.equal(captured.url, "https://example.supabase.co/rest/v1/rpc/discord_bot_poll_results");
  assert.deepEqual(captured.body, { p_id: pollId });
});

test("permanent panel publishing creates rules, FAQ and service status posts without internal marker footers", async () => {
  const ids = {
    rules: "1574262035519115801",
    faq: "1574262035519115802",
    service_status: "1574262035519115803",
  };
  const posts = [];
  const panel = new DiscordCommunityPanels({ guildId, botUserId, applicationId: "1574262035519115288" }, {
    api: { async request(path, options = {}) {
      if (path.endsWith("/messages?limit=100")) return [];
      if (options.method === "POST" && path.startsWith("/channels/")) {
        posts.push({ path, body: structuredClone(options.body) });
        return { id: "1574262035519115804" };
      }
      throw new Error("unexpected Discord request " + path);
    } },
    store: { async getResources() { return { map: ids }; }, async getConfig() { return {}; } },
  });
  const result = await panel.publishPermanentPanels();
  assert.equal(result.errors.length, 0);
  assert.equal(posts.length, 3);
  for (const key of Object.keys(ids)) {
    const post = posts.find(item => item.path === "/channels/" + ids[key] + "/messages");
    assert.ok(post, "missing published panel " + key);
    assert.doesNotMatch(post.body.embeds[0].footer.text, /^SNOOZER_PANEL:/);
  }
  assert.match(posts.find(item => item.path.includes(ids.faq)).body.embeds[0].title, /Frequently Asked Questions/);
  assert.match(posts.find(item => item.path.includes(ids.rules)).body.embeds[0].title, /Community Rules/);
  assert.match(posts.find(item => item.path.includes(ids.service_status)).body.embeds[0].title, /Service Status/);
});

test("bug report modal respects Discord's 4,000 character text input limit", async () => {
  let modal;
  const panel = new DiscordCommunityPanels({ guildId, botUserId, applicationId: "1574262035519115288" }, {
    api: { async request() { return {}; } },
    store: { async recordInteraction() { return true; } },
  });
  panel.showModal = async (_interaction, value) => { modal = value; };
  await panel.handle({
    guild_id: guildId, application_id: "1574262035519115288", type: 3,
    id: "1574262035519115810", token: "test-interaction-token",
    user: { id: botUserId }, data: { custom_id: "bug:open" },
  });
  assert.ok(modal);
  assert.equal(modal.components[1].components[0].max_length, 4000);
});

test("poll voting refreshes the poll embed with voter mentions and suppresses mention notifications", async () => {
  const pollId = "c25d3f44-6c1a-4d9c-8c3d-21a81f6d4c90";
  const option = "Keep the current design";
  const voterId = "1574262035519115287";
  let patched = null;
  let savedVote = null;
  const panel = new DiscordCommunityPanels({ guildId, botUserId, applicationId: "1574262035519115288" }, {
    api: { async request(path, options = {}) {
      if (path === "/channels/1574262035519115811/messages?limit=100") return [];
      if (path === "/channels/1574262035519115811/messages/1574262035519115812" && !options.method) {
        return { embeds: [{ title: "📊 Choose a design" }] };
      }
      if (path === "/channels/1574262035519115811/messages/1574262035519115812" && options.method === "PATCH") {
        patched = structuredClone(options.body);
        return {};
      }
      throw new Error("unexpected Discord request " + path);
    } },
    store: {
      async getConfig() { return { ["poll_" + pollId.replaceAll("-", "")]: {
        title: "Choose a design", options: [option, "Try a new design"],
        channel_id: "1574262035519115811", message_id: "1574262035519115812",
      } }; },
      async recordInteraction() { return true; },
      async voteSubmission(id, userIdValue, choice) { savedVote = { id, userId: userIdValue, choice }; },
      async pollResults() { return { total: 1, options: [
        { choice: option, votes: 1, voters: [voterId] },
        { choice: "Try a new design", votes: 0, voters: [] },
      ] }; },
    },
  });
  panel.reply = async () => true;
  await panel.handle({
    guild_id: guildId, application_id: "1574262035519115288", type: 3,
    id: "1574262035519115813", token: "test-interaction-token",
    user: { id: botUserId }, data: { custom_id: "poll:vote:" + pollId + ":0" },
  });
  assert.deepEqual(savedVote, { id: pollId, userId: botUserId, choice: option });
  assert.ok(patched);
  assert.match(patched.embeds[0].fields[0].value, new RegExp("<@" + voterId + ">"));
  assert.deepEqual(patched.allowed_mentions.parse, []);
  assert.equal(patched.embeds[0].footer.text, "Snoozer · Community poll");
});


test("server reset preflight stops before writes when the bot lacks permissions", async () => {
  const writes = [];
  const api = {
    async request(path, options = {}) {
      if (path.endsWith("/roles")) return [{ id: guildId, permissions: "0", position: 0 }];
      if (path.endsWith("/members/" + botUserId)) return { roles: [] };
      if (path.endsWith("/channels")) return [];
      if (path === "/guilds/" + guildId) return {};
      writes.push({ path, options });
      return {};
    },
  };
  const store = { async saveBackup() { throw new Error("must not reach backup"); } };
  const rebuilder = new DiscordServerRebuilder({ guildId, botUserId }, { api, store });
  await assert.rejects(rebuilder.rebuild(botUserId), /missing required permissions/i);
  assert.equal(writes.length, 0);
});


test("server reset preflight accepts the Discord Administrator permission", async () => {
  const api = {
    async request(path) {
      if (path.endsWith("/roles")) return [
        { id: guildId, permissions: "0", position: 0, name: "@everyone" },
        { id: "1574262035519115286", permissions: String(1n << 3n), position: 10, name: "Snoozer Bot" },
        { id: "1574262035519115287", permissions: "0", position: 5, name: "Snoozer Member" },
      ];
      if (path.endsWith("/members/" + botUserId)) return { roles: ["1574262035519115286"] };
      if (path.endsWith("/channels")) return [];
      if (path === "/guilds/" + guildId) return {};
      throw new Error("unexpected request " + path);
    },
  };
  const rebuilder = new DiscordServerRebuilder({ guildId, botUserId }, { api, store: {} });
  const result = await rebuilder.permissionPreflight();
  assert.equal(result.permissions, 1n << 3n);
  assert.equal(result.botTop, 10);
});

test("server reset preflight refuses a bot role below any replaceable custom role", async () => {
  const permissionBits = (1n << 1n) | (1n << 2n) | (1n << 4n) | (1n << 5n) | (1n << 7n)
    | (1n << 10n) | (1n << 11n) | (1n << 13n) | (1n << 14n) | (1n << 16n)
    | (1n << 28n) | (1n << 29n) | (1n << 33n) | (1n << 40n);
  const api = {
    async request(path) {
      if (path.endsWith("/roles")) return [
        { id: guildId, permissions: "0", position: 0, name: "@everyone" },
        { id: "1574262035519115286", permissions: permissionBits.toString(), position: 10, name: "Snoozer Bot" },
        { id: "1574262035519115287", permissions: "0", position: 11, name: "Unrelated Custom Role" },
      ];
      if (path.endsWith("/members/" + botUserId)) return { roles: ["1574262035519115286"] };
      if (path.endsWith("/channels")) return [];
      if (path === "/guilds/" + guildId) return {};
      throw new Error("unexpected request " + path);
    },
  };
  const rebuilder = new DiscordServerRebuilder({ guildId, botUserId }, { api, store: {} });
  await assert.rejects(rebuilder.permissionPreflight(), /Move the bot's highest role above/i);
});

test("server reset preflight protects Community channels, setup marker and invocation channel", async () => {
  const rulesId = "1574262035519115701";
  const updatesId = "1574262035519115702";
  const safetyId = "1574262035519115703";
  const systemId = "1574262035519115704";
  const afkId = "1574262035519115705";
  const markerId = "1574262035519115706";
  const invocationId = "1574262035519115707";
  const channels = [
    { id: rulesId, name: "rules", type: 0 },
    { id: updatesId, name: "community-updates", type: 0 },
    { id: safetyId, name: "safety-alerts", type: 0 },
    { id: systemId, name: "welcome", type: 0 },
    { id: afkId, name: "afk", type: 2 },
    { id: markerId, name: "snoozer-setup-state", type: 0 },
    { id: invocationId, name: "general", type: 0 },
  ];
  const api = {
    async request(path) {
      if (path === "/guilds/" + guildId + "/roles") return [
        { id: guildId, permissions: "0", position: 0, name: "@everyone" },
        { id: "1574262035519115710", permissions: String(1n << 3n), position: 10, name: "Snoozer Bot" },
      ];
      if (path === "/guilds/" + guildId + "/members/" + botUserId) return { roles: ["1574262035519115710"] };
      if (path === "/guilds/" + guildId + "/channels") return channels;
      if (path === "/guilds/" + guildId) return {
        rules_channel_id: rulesId,
        public_updates_channel_id: updatesId,
        safety_alerts_channel_id: safetyId,
        system_channel_id: systemId,
        afk_channel_id: afkId,
      };
      throw new Error("unexpected request " + path);
    },
  };
  const rebuilder = new DiscordServerRebuilder({ guildId, botUserId }, { api, store: {} });
  const result = await rebuilder.permissionPreflight({ invocationChannelId: invocationId });
  assert.deepEqual(new Set(result.protectedChannelIds), new Set([
    rulesId, updatesId, safetyId, systemId, afkId, markerId, invocationId,
  ]));
  assert.equal(result.protectedChannels.find(item => item.id === markerId).reason, "Snoozer one-time setup marker");
  assert.equal(result.protectedChannels.find(item => item.id === invocationId).reason, "Channel where the rebuild command was invoked");
  assert.ok(SNOOZER_SERVER_LAYOUT.flatMap(category => category.channels).some(channel =>
    channel.key === "setup_state" && channel.name === "snoozer-setup-state" && channel.topic.includes(SETUP_COMPLETE_MARKER)));
});

test("member-role migration never copies unverified Premium or Creator roles", async () => {
  const oldRoles = [
    { id: "1574262035519115301", name: "Premium" },
    { id: "1574262035519115302", name: "Creator" },
    { id: "1574262035519115303", name: "Member" },
    { id: "1574262035519115304", name: "Snoozer Admin" },
    { id: "1574262035519115305", name: "Old Custom Role" },
  ];
  let patch;
  const api = {
    async request(path, options = {}) {
      if (options.method === "PATCH") patch = JSON.parse(options.body ? JSON.stringify(options.body) : "{}");
      return {};
    },
  };
  const rebuilder = new DiscordServerRebuilder({ guildId, botUserId }, { api, store: {} });
  await rebuilder.migrateMemberRoles([{
    user: { id: "1574262035519115310", bot: false },
    roles: oldRoles.map(role => role.id),
  }], oldRoles, {
    premium: "1574262035519115321",
    creator: "1574262035519115322",
    member: "1574262035519115323",
    admin: "1574262035519115324",
  }, oldRoles.map(role => role.id));
  assert.ok(patch.roles.includes("1574262035519115323"));
  assert.ok(patch.roles.includes("1574262035519115324"));
  assert.ok(!patch.roles.includes("1574262035519115301"));
  assert.ok(!patch.roles.includes("1574262035519115302"));
  assert.ok(!patch.roles.includes("1574262035519115321"));
  assert.ok(!patch.roles.includes("1574262035519115322"));
  assert.ok(!patch.roles.includes("1574262035519115305"));
});

test("rebuild command uses the full confirmation phrase and button controls are present", () => {
  assert.equal("REBUILD SNOOZER SERVER".length, 22);
  assert.equal(SNOOZER_REBUILD_COMMAND.options[0].min_length, 22);
  assert.equal(SNOOZER_REBUILD_COMMAND.options[0].max_length, 22);
  assert.equal(typeof DiscordCommunityPanels.prototype.ticketAction, "function");
  assert.equal(typeof DiscordCommunityPanels.prototype.publishPermanentPanels, "function");
  assert.ok(snowflake(guildId));
});


test("security guard locks public chat after a join burst and restores exact overwrites", async () => {
  const state = { config: { security: { raidJoinThreshold: 2, raidLockdownSeconds: 300 } }, writes: [], events: [] };
  const channels = [{
    id: "1574262035519115401", type: 0, parent_id: "1574262035519115410", permission_overwrites: [],
  },{
    id: "1574262035519115402", type: 0, parent_id: "1574262035519115410",
    permission_overwrites: [{ id: guildId, type: 0, allow: "1024", deny: "0" }],
  }];
  const api = {
    async request(path, options = {}) {
      if (path === "/guilds/" + guildId) return { owner_id: "1574262035519115299" };
      if (path === "/guilds/" + guildId + "/channels") return structuredClone(channels);
      if (path.startsWith("/channels/") && options.method === "PATCH") {
        state.writes.push({ path, body: structuredClone(options.body) });
        return {};
      }
      if (path.startsWith("/channels/") && options.method === "POST") return {};
      throw new Error("unexpected API request " + path);
    },
  };
  const store = {
    async getConfig() { return structuredClone(state.config); },
    async setConfig(guild,key,value) { state.config = { ...state.config, [key]: structuredClone(value) }; return true; },
    async recordSecurityEvent(event) { state.events.push(event); return "event-id"; },
  };
  const guard = new DiscordSecurityGuard({ guildId, botUserId }, {
    api, store,
    getResources: () => ({ category_community: "1574262035519115410", security_alerts: "1574262035519115420" }),
  });
  await guard.initialise();
  await guard.handleMemberJoin({ user: { id: "1574262035519115321", bot: false } });
  await guard.handleMemberJoin({ user: { id: "1574262035519115322", bot: false } });
  assert.equal(state.config.raid_lockdown.active, true);
  assert.equal(state.writes.length, 2);
  const deny = BigInt(state.writes[0].body.permission_overwrites[0].deny);
  assert.ok((deny & (1n << 11n)) !== 0n);
  state.config.raid_lockdown.expires_at = new Date(0).toISOString();
  await guard.restoreExpiredLockdown();
  assert.equal(state.config.raid_lockdown.active, false);
  assert.deepEqual(state.writes[2].body.permission_overwrites, []);
  assert.deepEqual(state.writes[3].body.permission_overwrites, channels[1].permission_overwrites);
});

test("security guard records and removes an emergency mass-mention message", async () => {
  const calls = [];
  const store = {
    async recordSecurityEvent(event) { calls.push({ kind: "event", event }); },
    async getConfig() { return {}; },
    async setConfig() { return true; },
  };
  const api = { async request(path, options = {}) { calls.push({ path, method: options.method ?? "GET" }); return {}; } };
  const guard = new DiscordSecurityGuard({ guildId, botUserId }, {
    api, store, getResources: () => ({ security_alerts: "1574262035519115420" }),
  });
  const removed = await guard.handleMessage({
    guild_id: guildId, id: "1574262035519115330", channel_id: "1574262035519115401",
    author: { id: "1574262035519115331", bot: false },
    content: "", mention_everyone: true, mentions: [], mention_roles: [],
  });
  assert.equal(removed, true);
  assert.ok(calls.some(call => call.path === "/channels/1574262035519115401/messages/1574262035519115330" && call.method === "DELETE"));
  assert.ok(calls.some(call => call.kind === "event" && call.event.action === "automod_spam"));
});

test("security guard raises a temporary lockdown after repeated destructive audit actions", async () => {
  const config = { security: { antiNukeActions: 2, antiNukeWindowSeconds: 30, raidLockdownSeconds: 120 } };
  const patches = [];
  const api = {
    async request(path, options = {}) {
      if (path === "/guilds/" + guildId) return { owner_id: "1574262035519115299" };
      if (path === "/guilds/" + guildId + "/channels") return [{
        id: "1574262035519115401", type: 0, parent_id: "1574262035519115410", permission_overwrites: [],
      }];
      if (path.startsWith("/channels/") && options.method === "PATCH") patches.push(path);
      return {};
    },
  };
  const store = {
    async getConfig() { return structuredClone(config); },
    async setConfig(guild,key,value) { config[key] = structuredClone(value); return true; },
    async recordSecurityEvent() { return "event-id"; },
  };
  const guard = new DiscordSecurityGuard({ guildId, botUserId }, {
    api, store, getResources: () => ({ category_community: "1574262035519115410", security_alerts: "1574262035519115420" }),
  });
  await guard.initialise();
  await guard.handleAuditEntry({ guild_id:guildId,id:"1574262035519115501",user_id:"1574262035519115510",target_id:"1574262035519115520",action_type:12 });
  await guard.handleAuditEntry({ guild_id:guildId,id:"1574262035519115502",user_id:"1574262035519115510",target_id:"1574262035519115521",action_type:12 });
  assert.equal(config.raid_lockdown.active, true);
  assert.equal(patches.length, 1);
});


test("anti-nuke trusts the Snoozer Admin and Developer roles", async () => {
  const config = { security: { antiNukeActions: 2, antiNukeWindowSeconds: 30 } };
  const calls = [];
  const actorId = "1574262035519115601";
  const adminRoleId = "1574262035519115602";
  const api = {
    async request(path, options = {}) {
      calls.push({ path, method: options.method ?? "GET" });
      if (path === "/guilds/" + guildId) return { owner_id: "1574262035519115299" };
      if (path === "/guilds/" + guildId + "/members/" + actorId) return { roles: [adminRoleId] };
      if (path === "/guilds/" + guildId + "/channels") return [];
      return {};
    },
  };
  const store = {
    async getConfig() { return structuredClone(config); },
    async setConfig(_guild,key,value) { config[key] = structuredClone(value); return true; },
    async recordSecurityEvent() { throw new Error("trusted actor must not create a security incident"); },
  };
  const guard = new DiscordSecurityGuard({ guildId, botUserId }, {
    api, store, getResources: () => ({}), getRoleIds: () => ({ admin: adminRoleId }),
  });
  await guard.initialise();
  const handled = await guard.handleAuditEntry({
    guild_id:guildId,id:"1574262035519115610",user_id:actorId,
    target_id:"1574262035519115611",action_type:12,
  });
  assert.equal(handled, false);
  assert.equal(config.raid_lockdown, undefined);
  assert.ok(calls.some(call => call.path === "/guilds/" + guildId + "/members/" + actorId));
});


test("DiscordStore exposes persistent ticket statistics and staff review RPCs", async () => {
  const calls=[];
  const store=new DiscordStore({url:"https://example.supabase.co",serviceKey:"test-key"},{
    fetcher:async(url,options)=>{
      calls.push({url,body:JSON.parse(options.body)});
      return new Response(JSON.stringify({ok:true}),{status:200,headers:{"content-type":"application/json"}});
    },
  });
  await store.getTicket("2b74a90f-b239-4c62-8f43-e3cd5eaf3f3c");
  await store.ticketStatistics(guildId);
  await store.reviewSubmission("2b74a90f-b239-4c62-8f43-e3cd5eaf3f3c",botUserId,"approved","Looks good");
  assert.ok(calls.some(call=>call.url.endsWith("/discord_bot_ticket_get")));
  assert.ok(calls.some(call=>call.url.endsWith("/discord_bot_ticket_statistics")));
  const review=calls.find(call=>call.url.endsWith("/discord_bot_submission_review"));
  assert.deepEqual(review.body,{p_id:"2b74a90f-b239-4c62-8f43-e3cd5eaf3f3c",p_actor:botUserId,p_decision:"approved",p_note:"Looks good"});
});


test("server configuration backup includes every channel, not just the first 250", async () => {
  let saved;
  const roles=[{id:guildId,name:"@everyone",permissions:"0",position:0}];
  const channels=Array.from({length:270},(_,index)=>({
    id:String(BigInt(guildId)+BigInt(index+10)),name:"channel-"+index,type:0,
    topic:"topic "+index,permission_overwrites:[],
  }));
  const api={async request(path){
    if(path==="/guilds/"+guildId+"/roles")return roles;
    if(path==="/guilds/"+guildId+"/channels")return channels;
    throw new Error("unexpected request "+path);
  }};
  const store={async saveBackup(_guild,_actor,snapshot){saved=snapshot;return "c25d3f44-6c1a-4d9c-8c3d-21a81f6d4c90";},async pruneBackups(_guild,keep){assert.equal(keep,30);}};
  const result=await new DiscordServerRebuilder({guildId,botUserId},{api,store}).createBackup(botUserId);
  assert.equal(result.channelCount,270);
  assert.equal(saved.channels.length,270);
  assert.equal(saved.channels[269].topic,"topic 269");
  assert.equal(saved.version,2);
});

test("server backup rejects an incomplete Discord inventory without saving it", async () => {
  let saves=0;
  const api={async request(path){
    if(path==="/guilds/"+guildId+"/roles")return [{id:guildId,name:"@everyone"}];
    if(path==="/guilds/"+guildId+"/channels")return [{id:"not-a-snowflake",name:"invalid",type:0}];
    throw new Error("unexpected request "+path);
  }};
  const store={async saveBackup(){saves++;return "c25d3f44-6c1a-4d9c-8c3d-21a81f6d4c90";}};
  const rebuilder=new DiscordServerRebuilder({guildId,botUserId},{api,store});
  await assert.rejects(rebuilder.createBackup(botUserId),/cannot be represented safely/i);
  assert.equal(saves,0);
});

test("safe reconciliation preserves the current server and registers unique resource keys", async () => {
  let saved,registered,deleted=false;
  const roleIds=Object.fromEntries(SNOOZER_ROLE_LAYOUT.map((role,index)=>[
    role.key,String(BigInt(guildId)+BigInt(100+index)),
  ]));
  const rebuilder=new DiscordServerRebuilder({guildId,botUserId},{
    api:{async request(path){if(path==="/guilds/"+guildId+"/roles")return [{id:guildId,name:"@everyone",permissions:"0",position:0}];throw new Error("unexpected API call "+path);}},
    store:{
      async saveBackup(_guild,_actor,snapshot){saved=snapshot;return "c25d3f44-6c1a-4d9c-8c3d-21a81f6d4c90";},
      async registerResources(_guild,resources){registered=resources;return true;},
      async roleSyncTargets(){return [];},
    },
    onPanelsReady:async()=>({posted:2,errors:[]}),
  });
  const existingRoles=[{id:guildId,name:"@everyone",permissions:"0",position:0}];
  const existingChannels=[{id:"1574262035519115901",name:"general",type:0,permission_overwrites:[]}];
  rebuilder.permissionPreflight=async()=>({roles:existingRoles,channels:existingChannels,botMember:{roles:[]}});
  rebuilder.listMembers=async()=>[];
  rebuilder.ensureRoles=async()=>roleIds;
  rebuilder.positionManagedRoles=async()=>{};
  rebuilder.ensureCategory=async category=>({id:String(BigInt(guildId)+BigInt(1000+SNOOZER_SERVER_LAYOUT.findIndex(item=>item.key===category.key)))});
  let sequence=0;
  rebuilder.ensureChannel=async()=>({id:String(BigInt(guildId)+BigInt(2000+sequence++))});
  const result=await rebuilder.reconcile(botUserId);
  assert.ok(saved);
  assert.equal(deleted,false);
  assert.equal(new Set(registered.map(item=>item.resource_key)).size,registered.length);
  assert.equal(registered.filter(item=>item.resource_key==="category_tickets").length,1);
  assert.equal(result.complete,true);
});

test("DiscordStore calls the private backup retention RPC", async () => {
  let request;
  const store=new DiscordStore({url:"https://example.supabase.co",serviceKey:"test-key"},{
    fetcher:async(url,options)=>{
      request={url,body:JSON.parse(options.body)};
      return new Response("0",{status:200,headers:{"content-type":"application/json"}});
    },
  });
  await store.pruneBackups(guildId,30);
  assert.ok(request.url.endsWith("/discord_bot_prune_backups"));
  assert.deepEqual(request.body,{p_guild_id:guildId,p_keep:30});
});

test("server rebuilder registers the Tickets category only once", async () => {
  let registered;
  const roleIds=Object.fromEntries(SNOOZER_ROLE_LAYOUT.map((role,index)=>[
    role.key,String(BigInt(guildId)+BigInt(300+index)),
  ]));
  const rebuilder=new DiscordServerRebuilder({guildId,botUserId},{
    api:{async request(path){if(path==="/guilds/"+guildId+"/roles")return [{id:guildId,name:"@everyone",permissions:"0",position:0}];throw new Error("unexpected API call "+path);}},
    store:{async registerResources(_guild,resources){registered=resources;return true;},async roleSyncTargets(){return []; }},
  });
  rebuilder.ensureRoles=async()=>roleIds;
  rebuilder.positionManagedRoles=async()=>{};
  rebuilder.ensureCategory=async category=>({id:String(BigInt(guildId)+BigInt(4000+SNOOZER_SERVER_LAYOUT.findIndex(item=>item.key===category.key)))});
  rebuilder.ensureChannel=async()=>({id:String(BigInt(guildId)+BigInt(5000))});
  rebuilder.syncMembershipRoles=async()=>({checked:1,updated:0});
  await rebuilder.createNewStructure();
  const keys=registered.map(resource=>resource.resource_key);
  assert.equal(keys.length,new Set(keys).size);
  assert.equal(keys.filter(key=>key==="category_tickets").length,1);
});


test("ticket reminders defer when the latest channel message is newer than 24 hours", async () => {
  const scheduled=[];
  const posts=[];
  const state={status:"processing"};
  const panel=Object.create(DiscordCommunityPanels.prototype);
  panel.guildId=guildId;
  panel.logger={error(){}};
  panel.api={async request(path,options={}){
    if(path.endsWith("/messages?limit=1"))return [{timestamp:new Date().toISOString()}];
    if(path.endsWith("/messages")&&options.method==="POST"){posts.push(options.body);return {};}
    throw new Error("unexpected Discord request "+path);
  }};
  panel.store={
    async getTicket(){return {status:"open",created_at:new Date(Date.now()-60*60_000).toISOString()};},
    async enqueueJob(job){scheduled.push(job);state.status="pending";return "job-id";},
    async finishJob(_id,success){if(state.status!=="processing")return false;state.status=success?"done":"failed";return true;},
  };
  await panel.runJob({
    id:"c25d3f44-6c1a-4d9c-8c3d-21a81f6d4c90",job_type:"ticket_reminder",
    payload:{ticket_id:"c25d3f44-6c1a-4d9c-8c3d-21a81f6d4c91",channel_id:"1574262035519115901",reminder_number:1},
  });
  assert.equal(posts.length,0);
  assert.equal(scheduled.length,1);
  assert.equal(scheduled[0].dedupeKey,"ticket-reminder:c25d3f44-6c1a-4d9c-8c3d-21a81f6d4c91:1");
  assert.equal(scheduled[0].payload.reminder_number,1);
  assert.equal(state.status,"pending");
});

test("ticket reminders are capped at three and only continue for active tickets", async () => {
  const scheduled=[];
  const posts=[];
  const panel=Object.create(DiscordCommunityPanels.prototype);
  panel.guildId=guildId;
  panel.logger={error(){}};
  panel.api={async request(path,options={}){
    if(path.endsWith("/messages?limit=1"))return [{timestamp:new Date(Date.now()-48*60*60_000).toISOString()}];
    if(path.endsWith("/messages")&&options.method==="POST"){posts.push(options.body);return {};}
    throw new Error("unexpected Discord request "+path);
  }};
  panel.store={
    async getTicket(){return {status:"open",updated_at:new Date(Date.now()-48*60*60_000).toISOString()};},
    async enqueueJob(job){scheduled.push(job);return "job-id";},
    async finishJob(){return true;},
  };
  await panel.runJob({
    id:"c25d3f44-6c1a-4d9c-8c3d-21a81f6d4c90",job_type:"ticket_reminder",
    payload:{ticket_id:"c25d3f44-6c1a-4d9c-8c3d-21a81f6d4c91",channel_id:"1574262035519115901",reminder_number:3},
  });
  assert.equal(posts.length,1);
  assert.equal(scheduled.length,0);
});

test("ticket reminder jobs do not message tickets that have already closed", async () => {
  const calls=[];
  const panel=Object.create(DiscordCommunityPanels.prototype);
  panel.guildId=guildId;
  panel.logger={error(){}};
  panel.api={async request(){calls.push("discord");return [];}};
  panel.store={
    async getTicket(){return {status:"closed"};},
    async enqueueJob(){calls.push("enqueue");},
    async finishJob(){return true;},
  };
  await panel.runJob({
    id:"c25d3f44-6c1a-4d9c-8c3d-21a81f6d4c90",job_type:"ticket_reminder",
    payload:{ticket_id:"c25d3f44-6c1a-4d9c-8c3d-21a81f6d4c91",channel_id:"1574262035519115901",reminder_number:1},
  });
  assert.deepEqual(calls,[]);
});

test("community slash commands reach the complete router as well as rebuild", async () => {
  const applicationId = "1574262035519115288";
  const handled = [];
  const panels = new DiscordCommunityPanels({ guildId, botUserId, applicationId }, {
    api: { async request() { return {}; } },
    store: { async recordInteraction() { return true; } },
  });
  panels.healthStatus = async () => { handled.push("health"); };
  await panels.handle({
    guild_id: guildId,
    application_id: applicationId,
    type: 2,
    id: "1574262035519115290",
    token: "test-interaction-token",
    user: { id: botUserId },
    member: { permissions: "0", roles: [] },
    data: { name: "snoozer-health", options: [] },
  });
  assert.deepEqual(handled, ["health"]);
});



test("slash rebuild protects the channel where the command was invoked", async () => {
  const applicationId = "1574262035519115288";
  const invocationChannelId = "1574262035519115730";
  let received;
  const panels = new DiscordCommunityPanels({ guildId, botUserId, applicationId }, {
    api: { async request() { return {}; } },
    store: { async recordInteraction() { return true; } },
  });
  panels.isAdmin = () => true;
  panels.defer = async () => {};
  panels.complete = async () => {};
  panels.refreshResources = async () => {};
  panels.rebuilder.rebuild = async (actorId, options) => {
    received = { actorId, options };
    return {
      complete: true, categoryCount: 1, channelCount: 1, roleCount: 1,
      memberRolesMigrated: 0, backupId: "c25d3f44-6c1a-4d9c-8c3d-21a81f6d4c90",
      channelsPreserved: [],
    };
  };
  await panels.handleCommunitySlash({
    guild_id: guildId,
    application_id: applicationId,
    channel_id: invocationChannelId,
    type: 2,
    id: "1574262035519115731",
    token: "test-interaction-token",
    user: { id: botUserId },
    member: { user: { id: botUserId }, permissions: String(1n << 3n), roles: [] },
    data: {
      name: "snoozer-rebuild-server",
      options: [{ name: "confirmation", value: "REBUILD SNOOZER SERVER" }],
    },
  });
  assert.deepEqual(received, { actorId: botUserId, options: { invocationChannelId } });
});

test("voice channel creation omits the text-only topic field", async () => {
  const posted = [];
  const api = {
    async request(path, options = {}) {
      if (path === "/guilds/" + guildId + "/channels" && !options.method) return [];
      if (path === "/guilds/" + guildId + "/channels" && options.method === "POST") {
        posted.push(structuredClone(options.body));
        return { id: "1574262035519115601" };
      }
      throw new Error("unexpected Discord request " + path);
    },
  };
  const rebuilder = new DiscordServerRebuilder({ guildId, botUserId }, { api, store: {} });
  const category = SNOOZER_SERVER_LAYOUT.find(item => item.key === "community");
  const voice = category.channels.find(item => item.type === "voice");
  const text = category.channels.find(item => item.type === "text");
  const parent = { id: "1574262035519115602" };

  await rebuilder.ensureChannel(category, voice, parent, {});
  await rebuilder.ensureChannel(category, text, parent, {});

  assert.equal(posted.length, 2);
  assert.equal(Object.hasOwn(posted[0], "topic"), false);
  assert.equal(posted[0].type, 2);
  assert.equal(posted[1].topic, text.topic);
  assert.equal(posted[1].type, 0);
});

test("Discord API errors include field-level Invalid Form Body details", async () => {
  const client = new DiscordApiClient("test-token", async () => new Response(JSON.stringify({
    message: "Invalid Form Body",
    code: 50035,
    errors: {
      topic: { _errors: [{ code: "BASE_TYPE_FIELD_INVALID", message: "This field is not supported for voice channels." }] },
    },
  }), { status: 400, headers: { "content-type": "application/json" } }));
  await assert.rejects(
    client.request("/guilds/" + guildId + "/channels", { method: "POST", body: { name: "voice-room", topic: "invalid" } }),
    /body\.topic: This field is not supported for voice channels/,
  );
});

test("full reset deletes every replaceable custom role but preserves bot and managed roles", async () => {
  const everyone = { id: guildId, name: "@everyone", managed: false };
  const custom = { id: "1574262035519115610", name: "Old Custom Role", managed: false };
  const botRole = { id: "1574262035519115611", name: "Snoozer Bot", managed: false };
  const integration = { id: "1574262035519115612", name: "Integration Role", managed: true };
  const deleted = [];
  const rebuilder = new DiscordServerRebuilder({ guildId, botUserId }, {
    api: { async request(path, options = {}) {
      if (options.method === "DELETE") { deleted.push(path); return null; }
      throw new Error("unexpected API request " + path);
    } },
    store: {},
  });
  const result = await rebuilder.deleteOldRoles([everyone, custom, botRole, integration], [botRole.id]);
  assert.deepEqual(deleted, ["/guilds/" + guildId + "/roles/" + custom.id]);
  assert.deepEqual(result.deletedIds, [custom.id]);
  assert.equal(result.deleted, 1);
  assert.equal(result.preserved, 3);
});

test("channel reset skips preprotected channels and treats Discord 50074 Community protection as preserved", async () => {
  const protectedMarker = { id: "1574262035519115720", name: "snoozer-setup-state", type: 0 };
  const rules = { id: "1574262035519115721", name: "rules", type: 0, parent_id: "1574262035519115723" };
  const ordinary = { id: "1574262035519115722", name: "old-general", type: 0 };
  const category = { id: "1574262035519115723", name: "old-category", type: 4 };
  const deleted = [];
  const rebuilder = new DiscordServerRebuilder({ guildId, botUserId }, {
    api: { async request(path, options = {}) {
      if (options.method !== "DELETE") throw new Error("unexpected request " + path);
      if (path === "/channels/" + rules.id) {
        throw new Error("Discord API DELETE /channels/" + rules.id + " failed with HTTP 400 (Discord code 50074): Cannot delete a channel required for community servers.");
      }
      deleted.push(path);
      return null;
    } },
    store: {},
  });
  const result = await rebuilder.deleteOldChannels([protectedMarker, rules, ordinary, category], [protectedMarker.id]);
  assert.deepEqual(deleted, ["/channels/" + ordinary.id, "/channels/" + category.id]);
  assert.equal(result.deleted, 2);
  assert.deepEqual(result.remaining, []);
  assert.deepEqual(result.preserved.map(item => item.id).sort(), [protectedMarker.id, rules.id].sort());
  assert.equal(result.preserved.find(item => item.id === rules.id).reason, "Discord requires this channel for Community");
});

test("full server rebuild deletes channels and replaceable roles before creating the new layout", async () => {
  const events = [];
  const everyone = { id: guildId, name: "@everyone", permissions: "0", position: 0, managed: false };
  const oldRole = { id: "1574262035519115620", name: "Old Custom Role", permissions: "0", position: 2, managed: false };
  const botRole = { id: "1574262035519115621", name: "Snoozer Bot", permissions: String(1n << 3n), position: 10, managed: false };
  const oldChannel = { id: "1574262035519115630", name: "old-general", type: 0, permission_overwrites: [] };
  const backupId = "c25d3f44-6c1a-4d9c-8c3d-21a81f6d4c90";
  const rebuilder = new DiscordServerRebuilder({ guildId, botUserId }, {
    api: { async request() { throw new Error("unexpected API request"); } },
    store: {
      async saveBackup(_guild, _actor, snapshot) { events.push("backup"); assert.equal(snapshot.channels.length, 1); return backupId; },
      async pruneBackups() { events.push("prune"); },
    },
    onPanelsReady: async () => { events.push("panels"); return { posted: 1, errors: [] }; },
  });
  rebuilder.permissionPreflight = async ({ invocationChannelId } = {}) => ({
    roles: [everyone, oldRole, botRole],
    channels: [oldChannel],
    botMember: { roles: [botRole.id] },
    protectedRoleIds: new Set([botRole.id]),
    protectedChannelIds: new Set([invocationChannelId]),
  });
  rebuilder.listMembers = async () => [];
  rebuilder.deleteOldChannels = async (channels, protectedIds) => {
    events.push("delete-channels");
    assert.deepEqual(channels.map(channel => channel.id), [oldChannel.id]);
    assert.ok(protectedIds.has("1574262035519115642"));
    return { deleted: channels.length, remaining: [], preserved: [] };
  };
  rebuilder.deleteOldRoles = async (roles, protectedIds) => {
    events.push("delete-roles");
    assert.ok(new Set(protectedIds).has(botRole.id));
    return { deleted: 1, deletedIds: [oldRole.id], preserved: 2, remaining: [] };
  };
  rebuilder.createNewStructure = async () => {
    events.push("create-layout");
    return { roleIds: { member: "1574262035519115640" }, channelIds: { welcome: "1574262035519115641" },
      categories: { start_here: {} }, resources: [] };
  };
  rebuilder.migrateMemberRoles = async (_members, _oldRoles, _newIds, deletedIds) => {
    events.push("migrate-members");
    assert.deepEqual(deletedIds, [oldRole.id]);
    return 0;
  };
  rebuilder.syncMembershipRoles = async () => { events.push("sync-entitlements"); return { checked: 0, updated: 0 }; };

  const result = await rebuilder.rebuild(botUserId,{invocationChannelId:"1574262035519115642"});
  assert.deepEqual(events, [
    "backup", "prune", "delete-channels", "delete-roles",
    "create-layout", "migrate-members", "sync-entitlements", "panels",
  ]);
  assert.equal(result.channelsDeleted, 1);
  assert.equal(result.rolesDeleted, 1);
  assert.equal(result.rolesPreserved, 2);
  assert.equal(result.complete, true);
});

test("Discord guild command bulk list excludes retired commands and replaces legacy setup", () => {
  const commands = buildGuildCommands({ serverSetupEnabled: true, botEnabled: true });
  const names = commands.map(command => command.name);
  assert.ok(names.includes("snoozer-rebuild-server"));
  assert.ok(names.includes("snoozer-restore-server"));
  assert.ok(!names.includes("snoozer-repair"));
  assert.ok(!names.includes("snoozer-setup"));
  assert.equal(new Set(names).size, names.length);
  assert.deepEqual(
    buildGuildCommands({ serverSetupEnabled: true, botEnabled: false }).map(command => command.name),
    ["snoozer-setup"],
  );
});

test("ticket modal creates a private channel with string permission overwrites and logs the ticket", async () => {
  const applicationId = "1574262035519115288";
  const ownerId = "1574262035519115811";
  const ticketChannelId = "1574262035519115808";
  const queueChannelId = "1574262035519115809";
  const calls = [];
  const logs = [];
  const sequence = [];
  const panels = new DiscordCommunityPanels({ guildId, botUserId, applicationId }, {
    api: {
      async request(path, options = {}) {
        calls.push({ path, options: structuredClone(options) });
        if (path.startsWith("/interactions/") && path.endsWith("/callback")) sequence.push("initial acknowledgement");
        if (path === "/guilds/" + guildId + "/channels" && options.method === "POST") return { id: ticketChannelId };
        return {};
      },
    },
    store: {
      async recordInteraction() { sequence.push("interaction receipt"); return true; },
      async ticketPreflight() { sequence.push("ticket preflight"); return { allowed: true }; },
      async openTicket() { sequence.push("ticket record"); return { created: true, ticket_id: "c25d3f44-6c1a-4d9c-8c3d-21a81f6d4c90" }; },
      async enqueueJob() { return true; },
    },
    logEvent: async event => logs.push(event),
  });
  panels.resources.category_tickets = "1574262035519115802";
  panels.resources.ticket_queue = queueChannelId;

  await panels.handle({
    guild_id: guildId,
    application_id: applicationId,
    type: 5,
    id: "1574262035519115810",
    token: "test-interaction-token",
    member: { user: { id: ownerId, username: "test member" }, roles: [] },
    data: {
      custom_id: "ticket:submit:account",
      components: [
        { components: [{ value: "Account login problem" }] },
        { components: [{ value: "I cannot access my account since today." }] },
      ],
    },
  });

  const create = calls.find(call => call.path === "/guilds/" + guildId + "/channels" && call.options.method === "POST");
  assert.deepEqual(sequence, ["initial acknowledgement", "interaction receipt", "ticket preflight", "ticket record"]);
  assert.ok(create, "ticket channel should be created");
  assert.deepEqual(create.options.body.permission_overwrites.map(item => [item.type, item.allow, item.deny]), [
    [0, "0", "1024"],
    [1, "117760", "0"],
    [1, "117760", "0"],
  ]);
  assert.ok(create.options.body.permission_overwrites.every(item =>
    typeof item.allow === "string" && typeof item.deny === "string"));
  assert.ok(logs.some(event => event.title === "Support ticket opened" && event.description.includes(ticketChannelId)));
  const initialCallbacks = calls.filter(call => call.path.startsWith("/interactions/") && call.path.endsWith("/callback"));
  assert.equal(initialCallbacks.length, 1);
  assert.equal(initialCallbacks[0].options.body.type, 5);
  assert.equal(calls.some(call => call.path.startsWith("/interactions/") && call.options.body?.type === 4), false);
  const followUp = calls.find(call => call.path === "/webhooks/" + applicationId + "/test-interaction-token/messages/@original");
  assert.ok(followUp, "final response should edit the deferred interaction instead of sending a second initial callback");
  assert.match(followUp.options.body.content, /ticket has been created/i);
});

test("ticket deletion waits for the durable ticket close state and retries while it is still active", async () => {
  const channelId = "1574262035519115840";
  const ticketId = "c25d3f44-6c1a-4d9c-8c3d-21a81f6d4c93";
  const requests = [];
  const retries = [];
  const finished = [];
  const wakeups = [];
  let status = "open";
  const panel = Object.create(DiscordCommunityPanels.prototype);
  panel.guildId = guildId;
  panel.api = {
    async request(path, options = {}) { requests.push({ path, options }); return {}; },
  };
  panel.store = {
    async getTicket() { return { id: ticketId, channel_id: channelId, status }; },
    async enqueueJob(job) { retries.push(job); return true; },
    async finishJob(id, ok, error) { finished.push({ id, ok, error }); return true; },
  };
  panel.scheduleJobWake = (runAt, key) => wakeups.push({ runAt, key });
  panel.logEvent = async () => true;
  panel.logger = { error() {}, warn() {} };

  const job = {
    id: "c25d3f44-6c1a-4d9c-8c3d-21a81f6d4c94",
    job_type: "ticket_delete",
    payload: { ticket_id: ticketId, channel_id: channelId, retry_count: 0 },
  };
  await panel.runJob(job);

  assert.equal(requests.some(call => call.options.method === "DELETE"), false);
  assert.equal(retries.length, 1);
  assert.equal(retries[0].jobType, "ticket_delete");
  assert.equal(retries[0].payload.retry_count, 1);
  assert.equal(wakeups.length, 1);
  assert.equal(finished[0].ok, true);

  status = "closed";
  await panel.runJob({ ...job, id: "c25d3f44-6c1a-4d9c-8c3d-21a81f6d4c95", payload: { ...job.payload, retry_count: 1 } });
  assert.ok(requests.some(call => call.path === "/channels/" + channelId && call.options.method === "DELETE"));
  assert.equal(finished[1].ok, true);
});

test("Creator verification channel is private, registered and receives pending review cards", async () => {
  const categoryId = "1574262035519115830";
  const creatorChannelId = "1574262035519115831";
  const adminRoleId = "1574262035519115832";
  const developerRoleId = "1574262035519115833";
  const creatorId = "c25d3f44-6c1a-4d9c-8c3d-21a81f6d4c92";
  const messageId = "1574262035519115834";
  const state = {
    resources: [
      { resource_key: "category_internal", resource_type: "category", discord_id: categoryId, name: "INTERNAL" },
      { resource_key: "role_admin", resource_type: "role", discord_id: adminRoleId, name: "Admin" },
      { resource_key: "role_developer", resource_type: "role", discord_id: developerRoleId, name: "Developer" },
    ],
    config: {},
    posts: [],
    channel: null,
  };
  const panels = new DiscordCommunityPanels({ guildId, botUserId, applicationId }, {
    api: {
      async request(path, options = {}) {
        if (path === "/guilds/" + guildId + "/channels" && !options.method) return state.channel ? [state.channel] : [];
        if (path === "/guilds/" + guildId + "/channels" && options.method === "POST") {
          state.channel = { id: creatorChannelId, ...structuredClone(options.body) };
          return structuredClone(state.channel);
        }
        if (path === "/channels/" + creatorChannelId && options.method === "PATCH") {
          Object.assign(state.channel, structuredClone(options.body));
          return structuredClone(state.channel);
        }
        if (path === "/channels/" + creatorChannelId + "/messages?limit=100") return [];
        if (path === "/channels/" + creatorChannelId + "/messages" && options.method === "POST") {
          state.posts.push(structuredClone(options.body));
          return { id: messageId };
        }
        throw new Error("Unexpected Discord API request: " + path);
      },
    },
    store: {
      async getResources() { return { rows: structuredClone(state.resources), map: Object.fromEntries(state.resources.map(item => [item.resource_key, item.discord_id])) }; },
      async registerResources(_guild, rows) { state.resources = structuredClone(rows); return true; },
      async getConfig() { return structuredClone(state.config); },
      async setConfig(_guild, key, value) { state.config[key] = structuredClone(value); return true; },
      async creatorQueue() { return [{ id: creatorId, discord_user_id: "1574262035519115835", profile_url: "https://snoozer.uk/testcreator", reason: "I create useful community projects and tutorials.", created_at: new Date().toISOString() }]; },
    },
    logger: { info() {}, warn() {}, error() {} },
  });

  const registered = await panels.ensureCreatorVerificationChannel();
  assert.equal(registered, creatorChannelId);
  assert.equal(state.channel.parent_id, categoryId);
  const everyone = state.channel.permission_overwrites.find(item => item.id === guildId && item.type === 0);
  assert.equal(everyone.deny, String(1n << 10n));
  assert.ok(state.channel.permission_overwrites.some(item => item.id === adminRoleId && item.type === 0));
  assert.ok(!state.channel.permission_overwrites.some(item => item.id === developerRoleId && item.type === 0));
  assert.ok(state.resources.some(item => item.resource_key === "creator_verification" && item.discord_id === creatorChannelId));

  const published = await panels.publishCreatorQueue();
  assert.equal(published.posted, 1);
  assert.equal(state.posts.length, 1);
  assert.deepEqual(state.posts[0].components[0].components.map(item => item.custom_id), [
    "creator:approve:" + creatorId, "creator:reject:" + creatorId,
  ]);
  assert.equal(state.config["creator_" + creatorId.replaceAll("-", "")].message_id, messageId);
});

test("Discord server activity is posted to the configured bot logs channel without copying message content", async () => {
  const logChannelId = "1574262035519115807";
  const requests = [];
  const worker = {
    config: { guildId },
    communityPanels: { resources: { bot_logs: logChannelId } },
    discordApi: { async request(path, options) { requests.push({ path, options }); return {}; } },
    logServerEvent: DiscordPresenceWorker.prototype.logServerEvent,
    logger: { warn() {} },
    recordActivity() {},
    securityGuard: null,
    communityBot: null,
  };

  await DiscordPresenceWorker.prototype.dispatch.call(worker, {
    t: "MESSAGE_CREATE",
    d: {
      guild_id: guildId,
      id: "1574262035519115812",
      channel_id: "1574262035519115813",
      author: { id: "1574262035519115814", username: "member", bot: false },
      content: "this private message body must not be copied into logs",
      attachments: [],
      embeds: [],
    },
  });

  assert.equal(requests.length, 1);
  assert.equal(requests[0].path, "/channels/" + logChannelId + "/messages");
  const embed = requests[0].options.body.embeds[0];
  assert.equal(embed.title, "Message sent");
  assert.match(embed.description, /1574262035519115814/);
  assert.match(embed.description, /1574262035519115813/);
  assert.doesNotMatch(embed.description, /this private message body/);
  assert.deepEqual(requests[0].options.body.allowed_mentions, { parse: [] });
});

