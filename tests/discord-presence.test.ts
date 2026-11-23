import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DiscordPresenceWidget } from "../src/components/discord-presence-widget";
import { normaliseDiscordPresence, type DiscordPresencePublic } from "../src/lib/discord-presence";
import { createDiscordPresencePoller, DISCORD_PRESENCE_POLL_INTERVAL_MS } from "../src/lib/discord-presence-polling";
import { receiveDiscordPresenceInternal, verifyDiscordPresenceSignature } from "../src/lib/discord-presence-internal";

const secret = "a".repeat(64);
const now = 1_800_000_000_000;
const discordUserId = "111111111111111111";
const eventId = "00000000-0000-4000-8000-000000000201";
const observedAt = new Date(now).toISOString();

function signedRequest(payload: unknown, timestamp = now, bodyOverride?: string) {
  const body = bodyOverride ?? JSON.stringify(payload);
  const stamp = String(timestamp);
  const signature = createHmac("sha256", secret).update(stamp + "." + body).digest("hex");
  return new Request("https://snoozer.uk/api/v1/internal/discord/presence", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-snoozer-timestamp": stamp,
      "x-snoozer-signature": "sha256=" + signature,
    },
    body,
  });
}

function dependencies() {
  return {
    subscriptions: vi.fn(async () => [{ discordUserId, showStatus: true, showActivity: true, showCustomStatus: false }]),
    heartbeat: vi.fn(async () => true),
    ingest: vi.fn(async () => true),
    clear: vi.fn(async () => true),
  };
}

describe("Discord Gateway presence projection", () => {
  it("keeps only the selected activity fields and separately gated custom status", () => {
    expect(normaliseDiscordPresence(discordUserId, {
      status: "online",
      activities: [
        { type: 0, name: "Minecraft", details: "Building", state: "Survival", application_id: "private", secrets: { join: "secret" } },
        { type: 4, name: "Custom Status", state: "Working on a build", emoji: { id: "private" } },
      ],
    }, eventId, observedAt, { showStatus: true, showActivity: true, showCustomStatus: true })).toEqual({
      eventId, discordUserId, status: "online",
      activity: { type: "playing", name: "Minecraft", details: "Building", state: "Survival" },
      customStatus: "Working on a build", observedAt,
    });
  });

  it("maps invisible to offline and never publishes offline activities", () => {
    expect(normaliseDiscordPresence(discordUserId, {
      status: "invisible",
      activities: [{ type: 0, name: "Private game" }, { type: 4, state: "Hidden status" }],
    }, eventId, observedAt, { showStatus: true, showActivity: true, showCustomStatus: true })).toMatchObject({
      status: "offline", activity: null, customStatus: null,
    });
  });

  it("rejects malformed Discord IDs and unsupported presence statuses", () => {
    expect(normaliseDiscordPresence("not-a-snowflake", { status: "online" }, eventId, observedAt)).toBeNull();
    expect(normaliseDiscordPresence(discordUserId, { status: "unknown" }, eventId, observedAt)).toBeNull();
  });
});

describe("live public presence updates", () => {
  const projection = (status: "online" | "idle" | "dnd" | "offline"): DiscordPresencePublic => ({
    version: 1,
    state: "live",
    status,
    activity: null,
    customStatus: null,
    observedAt,
  });
  const response = (status: number, value: unknown) => ({
    status,
    ok: status >= 200 && status < 300,
    json: async () => value,
  }) as unknown as Response;

  it("renders only a compact Discord mark and exposes the live state in its hover label", () => {
    const markup = renderToStaticMarkup(createElement(DiscordPresenceWidget, {
      username: "example",
      initialPresence: projection("dnd"),
    }));
    expect(markup).toContain('class="discord-presence-badge"');
    expect(markup).toContain('data-status="dnd"');
    expect(markup).toContain('title="Discord status: Do Not Disturb"');
    expect(markup).toContain("Do Not Disturb");
    expect(markup).not.toContain("discord-presence-card");
    expect(markup).not.toContain("LIVE PROFILE STATUS");
  });

  it("fetches a fresh projection immediately and updates the status on the next poll", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response(200, projection("online")))
      .mockResolvedValueOnce(response(200, projection("idle")));
    const changes: string[] = [];
    const poller = createDiscordPresencePoller({
      username: "example",
      fetcher: fetcher as unknown as typeof fetch,
      onPresence: (value) => changes.push(value.status ?? "hidden"),
      onUnavailable: vi.fn(),
      onDisabled: vi.fn(),
    });
    try {
      await poller.start();
      expect(changes).toEqual(["online"]);
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(fetcher).toHaveBeenCalledWith(
        "/api/v1/discord/presence?username=example",
        expect.objectContaining({ cache: "no-store" }),
      );
      expect(DISCORD_PRESENCE_POLL_INTERVAL_MS).toBe(8_000);

      await vi.advanceTimersByTimeAsync(DISCORD_PRESENCE_POLL_INTERVAL_MS);
      expect(fetcher).toHaveBeenCalledTimes(2);
      expect(changes).toEqual(["online", "idle"]);
    } finally {
      poller.stop();
      vi.useRealTimers();
    }
  });

  it("stops polling and removes the badge when public consent is withdrawn", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn().mockResolvedValue(response(404, { error: "Presence is not enabled." }));
    const onDisabled = vi.fn();
    const poller = createDiscordPresencePoller({
      username: "example",
      fetcher: fetcher as unknown as typeof fetch,
      onPresence: vi.fn(),
      onUnavailable: vi.fn(),
      onDisabled,
    });
    try {
      await poller.start();
      expect(onDisabled).toHaveBeenCalledOnce();
      await vi.advanceTimersByTimeAsync(DISCORD_PRESENCE_POLL_INTERVAL_MS * 3);
      expect(fetcher).toHaveBeenCalledOnce();
    } finally {
      poller.stop();
      vi.useRealTimers();
    }
  });

  it("does not poll a hidden tab and refreshes as soon as it becomes visible", async () => {
    let visible = false;
    const fetcher = vi.fn().mockResolvedValue(response(200, projection("online")));
    const poller = createDiscordPresencePoller({
      username: "example",
      fetcher: fetcher as unknown as typeof fetch,
      isVisible: () => visible,
      onPresence: vi.fn(),
      onUnavailable: vi.fn(),
      onDisabled: vi.fn(),
    });
    try {
      await poller.start();
      expect(fetcher).not.toHaveBeenCalled();
      visible = true;
      await poller.refreshNow();
      expect(fetcher).toHaveBeenCalledOnce();
    } finally {
      poller.stop();
    }
  });
});

describe("signed worker ingestion boundary", () => {
  it("verifies the exact timestamp and body with a constant-time HMAC comparison", () => {
    const body = JSON.stringify({ type: "subscriptions" });
    const stamp = String(now);
    const signature = "sha256=" + createHmac("sha256", secret).update(stamp + "." + body).digest("hex");
    expect(verifyDiscordPresenceSignature(secret, stamp, signature, body, now)).toBe(true);
    expect(verifyDiscordPresenceSignature(secret, stamp, signature, body + " ", now)).toBe(false);
    expect(verifyDiscordPresenceSignature(secret, String(now - 61_000), signature, body, now)).toBe(false);
    expect(verifyDiscordPresenceSignature("short", stamp, signature, body, now)).toBe(false);
  });

  it("returns only opted-in Discord IDs to a correctly signed worker", async () => {
    const deps = dependencies();
    const response = await receiveDiscordPresenceInternal(signedRequest({ type: "subscriptions" }), secret, deps, now);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ subscriptions: [{ discordUserId, showStatus: true, showActivity: true, showCustomStatus: false }] });
    expect(deps.subscriptions).toHaveBeenCalledOnce();
  });

  it("accepts signed presence and heartbeat messages and forwards only validated values", async () => {
    const deps = dependencies();
    const presence = {
      type: "presence", eventId, discordUserId, status: "online",
      activity: { type: "playing", name: "Minecraft", details: "Building", state: null },
      customStatus: "Working on a build", observedAt,
    };
    const presenceResponse = await receiveDiscordPresenceInternal(signedRequest(presence), secret, deps, now);
    expect(presenceResponse.status).toBe(204);
    const { type, ...expectedEvent } = presence;
    void type;
    expect(deps.ingest).toHaveBeenCalledWith(expectedEvent);

    const heartbeatResponse = await receiveDiscordPresenceInternal(
      signedRequest({ type: "heartbeat", connected: true, guildReady: true }), secret, deps, now,
    );
    expect(heartbeatResponse.status).toBe(204);
    expect(deps.heartbeat).toHaveBeenCalledWith(true, true);

    const clearResponse = await receiveDiscordPresenceInternal(
      signedRequest({ type: "clear", eventId, discordUserId }), secret, deps, now,
    );
    expect(clearResponse.status).toBe(204);
    expect(deps.clear).toHaveBeenCalledWith(discordUserId, eventId);
  });

  it("rejects unsigned, tampered, stale, malformed and oversized requests before database access", async () => {
    const deps = dependencies();
    const validBody = JSON.stringify({ type: "subscriptions" });
    const unsigned = new Request("https://snoozer.uk/api/v1/internal/discord/presence", {
      method: "POST", headers: { "content-type": "application/json" }, body: validBody,
    });
    expect((await receiveDiscordPresenceInternal(unsigned, secret, deps, now)).status).toBe(401);

    const validSignature = createHmac("sha256", secret).update(String(now) + "." + validBody).digest("hex");
    const tampered = new Request("https://snoozer.uk/api/v1/internal/discord/presence", {
      method: "POST",
      headers: { "content-type": "application/json", "x-snoozer-timestamp": String(now), "x-snoozer-signature": "sha256=" + validSignature },
      body: validBody + " ",
    });
    expect((await receiveDiscordPresenceInternal(tampered, secret, deps, now)).status).toBe(401);
    expect((await receiveDiscordPresenceInternal(signedRequest({ type: "subscriptions" }, now - 61_000), secret, deps, now)).status).toBe(401);

    const unknownField = signedRequest({ type: "subscriptions", token: "must-not-be-accepted" });
    expect((await receiveDiscordPresenceInternal(unknownField, secret, deps, now)).status).toBe(400);

    const oversized = signedRequest({ type: "subscriptions", padding: "x".repeat(13_000) });
    expect((await receiveDiscordPresenceInternal(oversized, secret, deps, now)).status).toBe(413);
    expect(deps.subscriptions).not.toHaveBeenCalled();
    expect(deps.ingest).not.toHaveBeenCalled();
  });

  it("fails closed when the database or subscription projection is unavailable", async () => {
    const deps = dependencies();
    deps.subscriptions.mockRejectedValueOnce(new Error("database unavailable"));
    expect((await receiveDiscordPresenceInternal(signedRequest({ type: "subscriptions" }), secret, deps, now)).status).toBe(503);
    deps.ingest.mockResolvedValueOnce(false);
    expect((await receiveDiscordPresenceInternal(signedRequest({
      type: "presence", eventId, discordUserId, status: "online", activity: null, customStatus: null, observedAt,
    }), secret, deps, now)).status).toBe(503);
  });
});
