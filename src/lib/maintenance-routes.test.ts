import { describe, expect, it } from "vitest";
import { isMaintenanceExempt } from "./maintenance-routes";

describe("maintenance recovery exceptions", () => {
 it.each(["/owner","/owner/settings","/api/v1/billing/webhook","/api/v1/billing/checkout",
 "/auth/callback","/auth/confirm","/sign-in","/forgot-password",
 "/account-restricted","/appeal","/legal","/privacy","/terms","/health",
 "/.well-known/snoozer-domain","/_next/image","/media/photo"])(
  "keeps %s available during maintenance", pathname => {
   expect(isMaintenanceExempt(pathname,"GET")).toBe(true);
  }
 );
 it.each(["/","/templates","/pricing","/leaderboard","/studio","/trusnooze","/help"])(
  "shows public 503 maintenance for %s", pathname => {
   expect(isMaintenanceExempt(pathname,"GET")).toBe(false);
  }
 );
 it("allows API and form writes for payment and session continuity",() => {
  expect(isMaintenanceExempt("/studio","POST")).toBe(true);
  expect(isMaintenanceExempt("/api/v1/billing/webhook","POST")).toBe(true);
 });
 it("does not exempt spoofed path prefixes",() => {
  expect(isMaintenanceExempt("/ownerfake","GET")).toBe(false);
  expect(isMaintenanceExempt("/api-evil","GET")).toBe(false);
 });
});
