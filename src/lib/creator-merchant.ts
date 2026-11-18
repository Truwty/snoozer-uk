import { z } from "zod";

export const stripeAccountId = z.string().regex(/^acct_[A-Za-z0-9]{1,128}$/);
export const creatorMerchant = z.object({ id: z.uuid(), platformId: stripeAccountId, accountId: stripeAccountId.nullable(),
  country: z.literal("GB"), createdAt: z.iso.datetime({ offset: true }), ready: z.boolean(), checkedAt: z.iso.datetime({ offset: true }).nullable() });
export type CreatorMerchant = z.infer<typeof creatorMerchant>;
