import { z } from "zod";
import { username } from "./profile";
export const aliasInventory = z.object({
  limit: z.number().int().nonnegative(), used: z.number().int().nonnegative(),
  items: z.array(z.object({ name: username, expiresAt: z.iso.datetime({ offset: true }), state: z.enum(["active", "expired", "retired", "unpublished", "plan-limit"]) })).max(100),
});
export type AliasInventory = z.infer<typeof aliasInventory>;
