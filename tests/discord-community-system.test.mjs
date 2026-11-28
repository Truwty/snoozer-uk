import test from "node:test";
import assert from "node:assert/strict";

import { SNOOZER_ROLE_LAYOUT, SNOOZER_SERVER_LAYOUT, SNOOZER_RESOURCE_KEYS } from "../workers/discord-presence/server-layout.mjs";
import { DiscordStore } from "../workers/discord-presence/discord-store.mjs";
import { DiscordServerRebuilder } from "../workers/discord-presence/server-rebuilder.mjs";
import { DiscordCommunityPanels, SNOOZER_REBUILD_COMMAND } from "../workers/discord-presence/community-panels.mjs";

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

test("server reset preflight stops before writes when the bot lacks permissions", async () => {
  const writes = [];
  const api = {
    async request(path, options = {}) {
      if (path.endsWith("/roles")) return [{ id: guildId, permissions: "0", position: 0 }];
      if (path.endsWith("/members/" + botUserId)) return { roles: [] };
      if (path.endsWith("/channels")) return [];
      writes.push({ path, options });
      return {};
    },
  };
  const store = { async saveBackup() { throw new Error("must not reach backup"); } };
  const rebuilder = new DiscordServerRebuilder({ guildId, botUserId }, { api, store });
  await assert.rejects(rebuilder.rebuild(botUserId), /missing required permissions/i);
  assert.equal(writes.length, 0);
});

test("server reset preflight refuses a bot role below managed legacy roles", async () => {
  const permissionBits = (1n << 4n) | (1n << 10n) | (1n << 11n) | (1n << 14n) | (1n << 16n) | (1n << 28n);
  const api = {
    async request(path) {
      if (path.endsWith("/roles")) return [
        { id: guildId, permissions: "0", position: 0, name: "@everyone" },
        { id: "1574262035519115286", permissions: permissionBits.toString(), position: 10, name: "Snoozer Bot" },
        { id: "1574262035519115287", permissions: "0", position: 11, name: "Snoozer Admin" },
      ];
      if (path.endsWith("/members/" + botUserId)) return { roles: ["1574262035519115286"] };
      if (path.endsWith("/channels")) return [];
      throw new Error("unexpected request " + path);
    },
  };
  const rebuilder = new DiscordServerRebuilder({ guildId, botUserId }, { api, store: {} });
  await assert.rejects(rebuilder.permissionPreflight(), /Move the bot role above/i);
});

test("member-role migration never copies unverified Premium or Creator roles", async () => {
  const oldRoles = [
    { id: "1574262035519115301", name: "Premium" },
    { id: "1574262035519115302", name: "Creator" },
    { id: "1574262035519115303", name: "Member" },
    { id: "1574262035519115304", name: "Snoozer Admin" },
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
  });
  assert.ok(patch.roles.includes("1574262035519115323"));
  assert.ok(patch.roles.includes("1574262035519115324"));
  assert.ok(!patch.roles.includes("1574262035519115301"));
  assert.ok(!patch.roles.includes("1574262035519115302"));
  assert.ok(!patch.roles.includes("1574262035519115321"));
  assert.ok(!patch.roles.includes("1574262035519115322"));
});

test("rebuild command uses the full confirmation phrase and button controls are present", () => {
  assert.equal("REBUILD SNOOZER SERVER".length, 22);
  assert.equal(SNOOZER_REBUILD_COMMAND.options[0].min_length, 22);
  assert.equal(SNOOZER_REBUILD_COMMAND.options[0].max_length, 22);
  assert.equal(typeof DiscordCommunityPanels.prototype.ticketAction, "function");
  assert.equal(typeof DiscordCommunityPanels.prototype.publishPermanentPanels, "function");
  assert.ok(snowflake(guildId));
});
