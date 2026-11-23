import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { normaliseGatewayPresence, signInternalRequest } from "../workers/discord-presence/worker.mjs";

const discordUserId = "123456789012345678";

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

test("worker signs the exact JSON body with a timestamped HMAC", () => {
  const secret = "b".repeat(64);
  const payload = { type: "heartbeat", connected: true, guildReady: true };
  const signed = signInternalRequest(secret, payload, 1_800_000_000_000);
  const expected = createHmac("sha256", secret).update("1800000000000." + signed.body).digest("hex");
  assert.equal(signed.headers["x-snoozer-timestamp"], "1800000000000");
  assert.equal(signed.headers["x-snoozer-signature"], "sha256=" + expected);
  assert.deepEqual(JSON.parse(signed.body), payload);
});
