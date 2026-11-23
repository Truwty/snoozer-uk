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

test("worker signs the exact JSON body with a timestamped HMAC", () => {
  const secret = "b".repeat(64);
  const payload = { type: "heartbeat", connected: true, guildReady: true };
  const signed = signInternalRequest(secret, payload, 1_800_000_000_000);
  const expected = createHmac("sha256", secret).update("1800000000000." + signed.body).digest("hex");
  assert.equal(signed.headers["x-snoozer-timestamp"], "1800000000000");
  assert.equal(signed.headers["x-snoozer-signature"], "sha256=" + expected);
  assert.deepEqual(JSON.parse(signed.body), payload);
});
