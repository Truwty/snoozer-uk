import { z } from "zod";

export const referralCode = z.uuid();
export function referralSignupData(code: FormDataEntryValue | null, consent: FormDataEntryValue | null) {
  const parsed = referralCode.safeParse(code);
  return parsed.success && consent === "on"
    ? { snoozer_referral: parsed.data.toLowerCase(), snoozer_referral_consent: true } : undefined;
}
export const growthReport = z.object({
  code: referralCode.nullable(), enabled: z.boolean(), canEnable: z.boolean(),
  verified: z.number().int().nonnegative(), claimed: z.number().int().nonnegative().nullable(), published: z.number().int().nonnegative().nullable(),
  attribution: z.enum(["none", "accepted", "withdrawn", "removed"]),
});
