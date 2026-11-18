import { expect, it } from "vitest";
import { referralSignupData, growthReport } from "../src/lib/referrals";

it("sends referral metadata only for a valid code with explicit consent", () => {
  const code = "00000000-0000-4000-8000-000000000001";
  expect(referralSignupData(code, "on")).toEqual({ snoozer_referral: code, snoozer_referral_consent: true });
  for (const [candidate, consent] of [[code, null], [code, "true"], ["javascript:alert(1)", "on"], [null, "on"]]) {
    expect(referralSignupData(candidate, consent)).toBeUndefined();
  }
  expect(growthReport.safeParse({ code, enabled: true, canEnable: true, verified: 0, claimed: null, published: null, attribution: "none" }).success).toBe(true);
  expect(growthReport.safeParse({ code, verified: -1 }).success).toBe(false);
});
