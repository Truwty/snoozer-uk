import { z } from "zod";
import { profileRevisionNumber } from "./profile";
export const publicationSchedule = z.object({
  revision: profileRevisionNumber, runAt: z.iso.datetime({ offset: true }),
  state: z.enum(["pending", "published", "cancelled", "blocked"]),
  reason: z.enum(["manual", "superseded", "plan_changed", "quota", "snapshot_unavailable", "owner_unavailable"]).nullable(),
});
export type PublicationSchedule = z.infer<typeof publicationSchedule>;

export const publicationScheduleStatus = z.object({ automatic: z.boolean(), schedule: publicationSchedule.nullable() });
