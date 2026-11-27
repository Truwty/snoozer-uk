import "server-only";
import { storageAdmin } from "@/lib/supabase";

export type HomepageStats = {
  members: number;
  profiles: number;
  views: number;
  uploads: number;
};

function safeCount(value: unknown): number | null {
  const numeric = typeof value === "number"
    ? value
    : typeof value === "string" && /^\d+$/.test(value)
      ? Number(value)
      : Number.NaN;
  return Number.isSafeInteger(numeric) && numeric >= 0 ? numeric : null;
}

export function parseHomepageStats(value: unknown): HomepageStats | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const members = safeCount(raw.members);
  const profiles = safeCount(raw.profiles);
  const views = safeCount(raw.views);
  const uploads = safeCount(raw.uploads);
  if ([members, profiles, views, uploads].some((count) => count === null)) return null;
  return { members: members!, profiles: profiles!, views: views!, uploads: uploads! };
}

export async function getHomepageStats(): Promise<HomepageStats | null> {
  try {
    const { data, error } = await storageAdmin().rpc("get_public_homepage_stats");
    if (error) return null;
    return parseHomepageStats(data);
  } catch {
    // Do not fabricate figures when the production stats key or RPC is unavailable.
    return null;
  }
}
