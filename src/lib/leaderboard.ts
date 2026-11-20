import { z } from "zod";
import { username } from "./profile";

// PostgREST may serialize bigint counters as strings. Keep both safe without
// coercing potentially large values to imprecise JavaScript numbers.
export const leaderboardEntries = z.array(z.object({
  username,
  display_name: z.string().min(1).max(60),
  avatar: z.uuid().nullable(),
  views: z.union([z.number().int().nonnegative().safe(), z.string().regex(/^\d+$/)]),
})).max(50);

export function formatLeaderboardViews(value: string | number): string {
  return BigInt(value).toLocaleString("en-GB");
}
