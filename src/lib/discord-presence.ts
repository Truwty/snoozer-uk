import { z } from "zod";

export const discordSnowflake = z.string().regex(/^[1-9][0-9]{16,19}$/);
export const discordPresenceStatuses = ["online", "idle", "dnd", "offline"] as const;
export const discordActivityTypes = ["playing", "streaming", "listening", "watching", "competing"] as const;

export const discordPresenceActivity = z.strictObject({
  type: z.enum(discordActivityTypes),
  name: z.string().trim().min(1).max(100),
  details: z.string().trim().max(120).nullable(),
  state: z.string().trim().max(120).nullable(),
});

export const discordPresenceEvent = z.strictObject({
  eventId: z.uuid(),
  discordUserId: discordSnowflake,
  status: z.enum(discordPresenceStatuses).nullable(),
  activity: discordPresenceActivity.nullable(),
  customStatus: z.string().trim().max(128).nullable(),
  observedAt: z.iso.datetime({ offset: true }),
});

export const discordPresencePublic = z.strictObject({
  version: z.literal(1),
  state: z.enum(["live", "unavailable"]),
  status: z.enum([...discordPresenceStatuses, "unavailable"]).nullable(),
  activity: discordPresenceActivity.nullable(),
  customStatus: z.string().max(128).nullable(),
  observedAt: z.iso.datetime({ offset: true }).nullable(),
});

export const discordPresenceSettings = z.strictObject({
  connected: z.boolean(),
  enabled: z.boolean(),
  showStatus: z.boolean(),
  showActivity: z.boolean(),
  showCustomStatus: z.boolean(),
  serviceReady: z.boolean(),
});

export type DiscordPresenceActivity = z.infer<typeof discordPresenceActivity>;
export type DiscordPresenceEvent = z.infer<typeof discordPresenceEvent>;
export type DiscordPresencePublic = z.infer<typeof discordPresencePublic>;
export type DiscordPresenceSettings = z.infer<typeof discordPresenceSettings>;

function safeText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max);
  return text || null;
}

const activityTypes: Record<number, DiscordPresenceActivity["type"] | undefined> = {
  0: "playing",
  1: "streaming",
  2: "listening",
  3: "watching",
  5: "competing",
};

export function normaliseDiscordPresence(
  discordUserId: string,
  presence: { status?: unknown; activities?: unknown },
  eventId: string,
  observedAt = new Date().toISOString(),
  fields: { showStatus?: boolean; showActivity?: boolean; showCustomStatus?: boolean } = {},
): DiscordPresenceEvent | null {
  const rawStatus = presence.status;
  const status = rawStatus === "invisible" ? "offline"
    : discordPresenceStatuses.includes(rawStatus as typeof discordPresenceStatuses[number]) ? rawStatus as typeof discordPresenceStatuses[number]
    : null;
  if (!status || !discordSnowflake.safeParse(discordUserId).success) return null;

  const showStatus = fields.showStatus ?? true;
  const showActivity = fields.showActivity ?? true;
  const showCustomStatus = fields.showCustomStatus ?? false;
  const rawActivities = Array.isArray(presence.activities) ? presence.activities.slice(0, 12) : [];
  let customStatus: string | null = null;
  const candidates: DiscordPresenceActivity[] = [];

  for (const raw of rawActivities) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    if (item.type === 4) {
      if (!showCustomStatus) continue;
      customStatus ??= safeText(item.state, 128);
      continue;
    }
    if (!showActivity) continue;
    const type = typeof item.type === "number" ? activityTypes[item.type] : undefined;
    const name = safeText(item.name, 100);
    if (!type || !name) continue;
    candidates.push({
      type,
      name,
      details: safeText(item.details, 120),
      state: safeText(item.state, 120),
    });
  }

  const activity = candidates[0] ?? null;
  return discordPresenceEvent.parse({
    eventId,
    discordUserId,
    status: showStatus ? status : null,
    activity: status === "offline" || !showActivity ? null : activity,
    customStatus: status === "offline" || !showCustomStatus ? null : customStatus,
    observedAt,
  });
}
