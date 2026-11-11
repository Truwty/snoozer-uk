import { z } from "zod";

const quota = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const accountPlan = z.strictObject({
  plan: z.enum(["free", "plus", "pro", "studio"]),
  version: z.number().int().positive(),
  quotas: z.strictObject({
    profiles: quota, links: quota, mediaBytes: quota, domains: quota,
    aliases: quota, analyticsDays: quota, teamSeats: quota,
  }),
  capabilities: z.strictObject({
    premiumLayouts: z.boolean(), advancedEffects: z.boolean(), scheduledPublishing: z.boolean(),
    abTesting: z.boolean(), removeBranding: z.boolean(), advancedSeo: z.boolean(), prioritySupport: z.boolean(),
    apiAccess: z.enum(["read", "limited", "standard", "extended"]),
  }),
  expiresAt: z.iso.datetime({ offset: true }).nullable(),
  usage: z.strictObject({ publishedProfiles: quota, draftLinks: quota }),
});
export type AccountPlan = z.infer<typeof accountPlan>;

type QuotaKey = keyof AccountPlan["quotas"];
type FeatureKey = Exclude<keyof AccountPlan["capabilities"], "apiAccess">;
type Action = { feature: FeatureKey } | { quota: QuotaKey; used: number; increment: number };

export function can(
  user: { id: string; plan: AccountPlan },
  action: Action,
  resource: { ownerId: string },
  now = Date.now(),
) {
  if (user.id !== resource.ownerId) return false;
  if (user.plan.expiresAt && Date.parse(user.plan.expiresAt) <= now) return false;
  if ("feature" in action) return user.plan.capabilities[action.feature] === true;
  const { used, increment } = action;
  return Number.isSafeInteger(used) && used >= 0 && Number.isSafeInteger(increment) && increment > 0
    && increment <= user.plan.quotas[action.quota] - used;
}
