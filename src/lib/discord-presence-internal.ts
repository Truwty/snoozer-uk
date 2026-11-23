import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { boundedBody } from "./bounded-request";
import { discordPresenceEvent, discordSnowflake } from "./discord-presence";

const internalMessage = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("subscriptions") }),
  z.strictObject({ type: z.literal("heartbeat"), connected: z.boolean(), guildReady: z.boolean() }),
  z.strictObject({ type: z.literal("presence"), ...discordPresenceEvent.shape }),
  z.strictObject({ type: z.literal("clear"), eventId: z.uuid(), discordUserId: discordSnowflake }),
]);

export type DiscordPresenceInternalMessage = z.infer<typeof internalMessage>;
export type DiscordPresenceInternalDependencies = {
  subscriptions(): Promise<unknown>;
  heartbeat(connected: boolean, guildReady: boolean): Promise<boolean>;
  ingest(event: z.infer<typeof discordPresenceEvent>): Promise<boolean>;
  clear(discordUserId: string, eventId: string): Promise<boolean>;
};

function response(status: number, body?: unknown) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json; charset=utf-8" }),
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}

export function verifyDiscordPresenceSignature(secret: string, timestamp: string, signature: string, body: string, now = Date.now()) {
  if (secret.length < 64 || !/^[0-9]{13}$/.test(timestamp) || Math.abs(now - Number(timestamp)) > 60_000) return false;
  const supplied = signature.replace(/^sha256=/, "");
  if (!/^[a-f0-9]{64}$/i.test(supplied)) return false;
  const expected = createHmac("sha256", secret).update(timestamp + "." + body).digest();
  const actual = Buffer.from(supplied, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function receiveDiscordPresenceInternal(
  request: Request,
  secret: string,
  dependencies: DiscordPresenceInternalDependencies,
  now = Date.now(),
) {
  if (request.method !== "POST" || !request.headers.get("content-type")?.toLowerCase().includes("application/json")) return response(415);
  const bytes = await boundedBody(request, 12_288);
  if (!bytes) return response(413);
  let body: string;
  let raw: unknown;
  try {
    body = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    const timestamp = request.headers.get("x-snoozer-timestamp") ?? "";
    const signature = request.headers.get("x-snoozer-signature") ?? "";
    if (!verifyDiscordPresenceSignature(secret, timestamp, signature, body, now)) return response(401);
    raw = JSON.parse(body);
  } catch {
    return response(400);
  }
  const parsed = internalMessage.safeParse(raw);
  if (!parsed.success) return response(400);

  try {
    if (parsed.data.type === "subscriptions") {
      const ids = z.array(discordSnowflake).max(5000).safeParse(await dependencies.subscriptions());
      return ids.success ? response(200, { discordUserIds: ids.data }) : response(503);
    }
    if (parsed.data.type === "heartbeat") {
      const ok = await dependencies.heartbeat(parsed.data.connected, parsed.data.guildReady && parsed.data.connected);
      return response(ok ? 204 : 503);
    }
    if (parsed.data.type === "clear") {
      const ok = await dependencies.clear(parsed.data.discordUserId, parsed.data.eventId);
      return response(ok ? 204 : 503);
    }
    const { type: _type, ...eventData } = parsed.data;
    const event = discordPresenceEvent.parse(eventData);
    const ok = await dependencies.ingest(event);
    return response(ok ? 204 : 503);
  } catch {
    return response(503);
  }
}
