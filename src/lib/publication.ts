import { z } from "zod";
import { publishedProfile } from "./profile";

const publicationDetails = z.object({
  revision: z.number().int().nonnegative(),
  display_name: z.string(),
  published_at: z.iso.datetime({ offset: true }),
  live: z.boolean(),
});

export const publicationList = z.array(publicationDetails);
export const publicationPreview = publishedProfile.extend({
  ...publicationDetails.shape,
  draft_revision: z.number().int().nonnegative(),
});

export function publicationDate(timestamp: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London",
  }).format(new Date(timestamp));
}
