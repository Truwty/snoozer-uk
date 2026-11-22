import {describe,it,expect,vi,afterEach} from "vitest";
vi.mock("server-only",()=>({}));
import {mailReadiness,zohoMailReady,zohoOutboundEnabled} from "./mail-readiness";
afterEach(()=>vi.unstubAllEnvs());
describe("Zoho mail outbound readiness",()=>{
 it("fails closed with full credentials but without explicit network enablement",()=>{
  vi.stubEnv("ZOHO_SMTP_USER","snoozersupport@snoozer.uk");
  vi.stubEnv("ZOHO_SMTP_PASSWORD","test-password");
  vi.stubEnv("SNOOZER_NOTIFICATION_FROM","snoozersupport@snoozer.uk");
  vi.stubEnv("OWNER_EMAIL_DISPATCH_TOKEN","a".repeat(48));
  vi.stubEnv("ZOHO_SMTP_OUTBOUND_ENABLED","");
  expect(mailReadiness()).toMatchObject({
   credentialsConfigured:true,outboundEnabled:false,dispatchTokenConfigured:true});
  expect(zohoMailReady()).toBe(false);
 });
 it("only enables SMTP after an explicit flag",()=>{
  vi.stubEnv("ZOHO_SMTP_USER","snoozersupport@snoozer.uk");
  vi.stubEnv("ZOHO_SMTP_PASSWORD","test-password");
  vi.stubEnv("SNOOZER_NOTIFICATION_FROM","snoozersupport@snoozer.uk");
  vi.stubEnv("ZOHO_SMTP_OUTBOUND_ENABLED","true");
  expect(zohoOutboundEnabled()).toBe(true);
  expect(zohoMailReady()).toBe(true);
 });
 it("rejects invalid sender identity",()=>{
  vi.stubEnv("ZOHO_SMTP_USER","bad");
  vi.stubEnv("ZOHO_SMTP_PASSWORD","test-password");
  vi.stubEnv("SNOOZER_NOTIFICATION_FROM","snoozersupport@snoozer.uk");
  vi.stubEnv("ZOHO_SMTP_OUTBOUND_ENABLED","true");
  expect(zohoMailReady()).toBe(false);
 });
});
