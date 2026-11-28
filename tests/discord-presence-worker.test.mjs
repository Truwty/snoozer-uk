import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { DiscordPresenceWorker, normaliseGatewayPresence, signInternalRequest } from "../workers/discord-presence/worker.mjs";

const discordUserId = "111111111111111111";

test("Gateway presence projection drops secrets and keeps only public activity fields", () => {
  const event = normaliseGatewayPresence(discordUserId, {
    status: "online",
    activities: [
      { type: 0, name: "Minecraft", details: "Building", state: "Survival", application_id: "private", secrets: { join: "secret" }, buttons: ["private"] },
      { type: 4, name: "Custom Status", state: "Working on it", emoji: { id: "private" } },
    ],
  }, "2026-11-23T00:00:00.000Z", { showStatus: true, showActivity: true, showCustomStatus: true });
  assert.deepEqual(event, {
    type: "presence",
    eventId: event.eventId,
    discordUserId,
    status: "online",
    activity: { type: "playing", name: "Minecraft", details: "Building", state: "Survival" },
    customStatus: "Working on it",
    observedAt: "2026-11-23T00:00:00.000Z",
  });
  assert.equal(JSON.stringify(event).includes("secret"), false);
  assert.equal(JSON.stringify(event).includes("private"), false);
});

test("invisible and offline states never retain activity or custom status", () => {
  for (const status of ["offline", "invisible"]) {
    const event = normaliseGatewayPresence(discordUserId, {
      status,
      activities: [{ type: 0, name: "Private game" }, { type: 4, state: "Private status" }],
    });
    assert.equal(event.status, "offline");
    assert.equal(event.activity, null);
    assert.equal(event.customStatus, null);
  }
});

test("invalid Discord IDs and unknown statuses are ignored", () => {
  assert.equal(normaliseGatewayPresence("not-a-snowflake", { status: "online" }), null);
  assert.equal(normaliseGatewayPresence(discordUserId, { status: "unknown" }), null);
});


test("live Gateway PRESENCE_UPDATE events are ingested only for the configured guild and opted-in identity", async () => {
  const posted = [];
  const fetcher = async (_url, options) => {
    posted.push(JSON.parse(options.body));
    return new Response(null, { status: 204 });
  };
  const worker = new DiscordPresenceWorker({
    token: "test-token",
    secret: "s".repeat(64),
    guildId: "222222222222222222",
    baseUrl: "https://snoozer.example",
  }, {
    fetcher,
    logger: { info() {}, warn() {}, error() {} },
  });
  worker.subscriptions.set(discordUserId, {
    showStatus: true,
    showActivity: true,
    showCustomStatus: false,
  });

  await worker.dispatch({
    t: "PRESENCE_UPDATE",
    d: {
      guild_id: "333333333333333333",
      user: { id: discordUserId },
      status: "online",
      activities: [],
    },
  });
  await worker.dispatch({
    t: "PRESENCE_UPDATE",
    d: {
      guild_id: "222222222222222222",
      user: { id: "444444444444444444" },
      status: "online",
      activities: [],
    },
  });
  assert.equal(posted.length, 0);

  await worker.dispatch({
    t: "PRESENCE_UPDATE",
    d: {
      guild_id: "222222222222222222",
      user: { id: discordUserId },
      status: "idle",
      activities: [{ type: 0, name: "Minecraft", details: "Building" }],
    },
  });
  assert.equal(posted.length, 1);
  assert.equal(posted[0].type, "presence");
  assert.equal(posted[0].discordUserId, discordUserId);
  assert.equal(posted[0].status, "idle");
  assert.deepEqual(posted[0].activity, {
    type: "playing",
    name: "Minecraft",
    details: "Building",
    state: null,
  });
  assert.equal(posted[0].customStatus, null);
});



test("GUILD_CREATE requests a targeted snapshot using Map keys, not subscription entry tuples", async () => {
  const posted = [];
  const gatewayMessages = [];
  const worker = new DiscordPresenceWorker({
    token: "test-token",
    secret: "s".repeat(64),
    guildId: "222222222222222222",
    baseUrl: "https://snoozer.example",
  }, {
    fetcher: async (_url, options) => {
      posted.push(JSON.parse(options.body));
      return new Response(null, { status: 204 });
    },
    logger: { info() {}, warn() {}, error() {} },
  });
  worker.subscriptions.set(discordUserId, {
    showStatus: true,
    showActivity: true,
    showCustomStatus: false,
  });
  worker.socket = {
    readyState: 1,
    send: (payload) => gatewayMessages.push(JSON.parse(payload)),
  };

  await worker.dispatch({
    t: "GUILD_CREATE",
    d: {
      id: "222222222222222222",
      presences: [],
    },
  });

  const request = gatewayMessages.find(message => message.op === 8);
  assert.ok(request, "GUILD_CREATE should immediately request a targeted presence snapshot");
  assert.deepEqual(request.d.user_ids, [discordUserId]);
  assert.equal(request.d.user_ids.some(Array.isArray), false);
  assert.equal(request.d.presences, true);

  await worker.handleChunk({
    guild_id: "222222222222222222",
    nonce: request.d.nonce,
    chunk_index: 0,
    chunk_count: 1,
    members: [{ user: { id: discordUserId } }],
    presences: [{
      user: { id: discordUserId },
      status: "online",
      activities: [],
    }],
    not_found: [],
  });

  assert.equal(posted.some(payload => payload.type === "presence"
    && payload.discordUserId === discordUserId
    && payload.status === "online"), true);
});

test("worker requests targeted snapshots only for opted-in IDs and handles the response chunk", async () => {
  const posted = [];
  const gatewayMessages = [];
  const worker = new DiscordPresenceWorker({
    token: "test-token",
    secret: "s".repeat(64),
    guildId: "222222222222222222",
    baseUrl: "https://snoozer.example",
  }, {
    fetcher: async (_url, options) => {
      posted.push(JSON.parse(options.body));
      return new Response(null, { status: 204 });
    },
    logger: { info() {}, warn() {}, error() {} },
  });
  worker.subscriptions.set(discordUserId, {
    showStatus: true,
    showActivity: true,
    showCustomStatus: false,
  });
  worker.guildReady = true;
  worker.socket = {
    readyState: 1,
    send: (payload) => gatewayMessages.push(JSON.parse(payload)),
  };

  const pending = worker.requestSnapshots([discordUserId, "333333333333333333"]);
  const request = gatewayMessages[0];
  assert.equal(request.op, 8);
  assert.deepEqual(request.d.user_ids, [discordUserId]);
  assert.equal(request.d.presences, true);
  assert.equal(request.d.query, undefined);
  assert.equal(request.d.limit, undefined);

  await worker.handleChunk({
    guild_id: "222222222222222222",
    nonce: request.d.nonce,
    chunk_index: 0,
    chunk_count: 1,
    members: [{ user: { id: discordUserId } }],
    presences: [{
      user: { id: discordUserId },
      status: "idle",
      activities: [{ type: 0, name: "Minecraft", details: "Building" }],
    }],
    not_found: [],
  });
  await pending;

  assert.equal(posted.length, 1);
  assert.equal(posted[0].type, "presence");
  assert.equal(posted[0].discordUserId, discordUserId);
  assert.equal(posted[0].status, "idle");
  assert.equal(posted[0].activity.name, "Minecraft");
});

test("worker clears cached presence when a targeted snapshot reports the account is not in the guild", async () => {
  const posted = [];
  const gatewayMessages = [];
  const worker = new DiscordPresenceWorker({
    token: "test-token",
    secret: "s".repeat(64),
    guildId: "222222222222222222",
    baseUrl: "https://snoozer.example",
  }, {
    fetcher: async (_url, options) => {
      posted.push(JSON.parse(options.body));
      return new Response(null, { status: 204 });
    },
    logger: { info() {}, warn() {}, error() {} },
  });
  worker.subscriptions.set(discordUserId, {
    showStatus: true,
    showActivity: true,
    showCustomStatus: false,
  });
  worker.guildReady = true;
  worker.socket = {
    readyState: 1,
    send: (payload) => gatewayMessages.push(JSON.parse(payload)),
  };

  const pending = worker.requestSnapshots([discordUserId]);
  const request = gatewayMessages[0];
  await worker.handleChunk({
    guild_id: "222222222222222222",
    nonce: request.d.nonce,
    chunk_index: 0,
    chunk_count: 1,
    members: [],
    presences: [],
    not_found: [discordUserId],
  });
  await pending;

  assert.equal(posted.length, 1);
  assert.equal(posted[0].type, "clear");
  assert.equal(posted[0].discordUserId, discordUserId);
  assert.match(posted[0].eventId, /^[0-9a-f-]{36}$/);
});

test("community bot requests the privileged Guild Members intent for welcome and boost events", async () => {
  const sent = [];
  const worker = new DiscordPresenceWorker({
    token: "test-token",
    guildId: "222222222222222222",
    botEnabled: true,
    presenceEnabled: false,
    serverSetupEnabled: false,
  }, {
    logger: { info() {}, warn() {}, error() {} },
  });
  worker.socket = {
    readyState: 1,
    send: payload => sent.push(JSON.parse(payload)),
  };

  await worker.handleMessage(JSON.stringify({
    op: 10,
    d: { heartbeat_interval: 45_000 },
  }));
  const identify = sent.find(packet => packet.op === 2);
  assert.ok(identify);
  assert.ok((identify.d.intents & (1 << 0)) !== 0, "Guilds intent remains enabled");
  assert.ok((identify.d.intents & (1 << 1)) !== 0, "Guild Members intent is enabled for community events");
  assert.equal((identify.d.intents & (1 << 8)), 0, "Presence intent remains disabled unless explicitly configured");
  worker.stopHeartbeat();
});

test("member join and update events are handled only for the configured Snoozer server", async () => {
  const events = [];
  const worker = new DiscordPresenceWorker({
    token: "test-token",
    guildId: "222222222222222222",
    botEnabled: true,
    presenceEnabled: false,
    serverSetupEnabled: false,
  }, {
    logger: { info() {}, warn() {}, error() {} },
  });
  worker.communityBot = {
    seedKnownBoosters: members => events.push(["seed", members.length]),
    welcomeMember: member => events.push(["welcome", member.user.id]),
    handleMemberRemove: member => events.push(["remove", member.user.id]),
    handleMemberUpdate: member => events.push(["boost", member.user.id]),
  };

  await worker.dispatch({
    t: "GUILD_CREATE",
    d: { id: "999999999999999999", members: [{ user: { id: "111111111111111111" } }] },
  });
  await worker.dispatch({
    t: "GUILD_CREATE",
    d: { id: "222222222222222222", members: [{ user: { id: "111111111111111111" }, premium_since: "2026-11-28T00:00:00.000Z" }] },
  });
  await worker.dispatch({
    t: "GUILD_MEMBER_ADD",
    d: { guild_id: "999999999999999999", user: { id: "333333333333333333" } },
  });
  await worker.dispatch({
    t: "GUILD_MEMBER_ADD",
    d: { guild_id: "222222222222222222", user: { id: "444444444444444444" } },
  });
  await worker.dispatch({
    t: "GUILD_MEMBER_REMOVE",
    d: { guild_id: "999999999999999999", user: { id: "444444444444444444" } },
  });
  await worker.dispatch({
    t: "GUILD_MEMBER_REMOVE",
    d: { guild_id: "222222222222222222", user: { id: "444444444444444444" } },
  });
  await worker.dispatch({
    t: "GUILD_MEMBER_ADD",
    d: { guild_id: "222222222222222222", user: { id: "444444444444444444" } },
  });
  await worker.dispatch({
    t: "GUILD_MEMBER_UPDATE",
    d: { guild_id: "222222222222222222", user: { id: "555555555555555555" }, premium_since: "2026-11-28T00:00:00.000Z" },
  });

  assert.deepEqual(events, [
    ["seed", 1],
    ["welcome", "444444444444444444"],
    ["remove", "444444444444444444"],
    ["welcome", "444444444444444444"],
    ["boost", "555555555555555555"],
  ]);
});

test("worker signs the exact JSON body with a timestamped HMAC", () => {
  const secret = "b".repeat(64);
  const payload = { type: "heartbeat", connected: true, guildReady: true };
  const signed = signInternalRequest(secret, payload, 1_800_000_000_000);
  const expected = createHmac("sha256", secret).update("1800000000000." + signed.body).digest("hex");
  assert.equal(signed.headers["x-snoozer-timestamp"], "1800000000000");
  assert.equal(signed.headers["x-snoozer-signature"], "sha256=" + expected);
  assert.deepEqual(JSON.parse(signed.body), payload);
});
