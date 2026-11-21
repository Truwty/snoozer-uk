import { z } from "zod";
export const affiliateDisclosureText=z.string().max(500)
  .refine(s=>!/[\u0000-\u0008\u000b-\u001f\u007f]/.test(s));
export const creatorAffiliateDisclosure=z.object({
  revision:z.number().int().nonnegative(),
  disclosure:affiliateDisclosureText,
  enabled:z.boolean(),
}).refine(v=>!v.enabled||v.disclosure.trim().length>0);
