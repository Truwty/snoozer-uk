import {afterEach,describe,expect,it,vi} from "vitest";
import {sendZohoApiNotice,zohoMailApiConfigured} from "./zoho-mail-api";
afterEach(()=>vi.unstubAllEnvs());
function configure(label:string){
 vi.stubEnv("ZOHO_MAIL_REGION","eu");
 vi.stubEnv("ZOHO_MAIL_ACCOUNT_ID","1234567890");
 vi.stubEnv("SNOOZER_NOTIFICATION_FROM","snoozersupport@snoozer.uk");
 vi.stubEnv("ZOHO_OAUTH_CLIENT_ID","client-id-"+label);
 vi.stubEnv("ZOHO_OAUTH_CLIENT_SECRET","client-secret-"+label);
 vi.stubEnv("ZOHO_OAUTH_REFRESH_TOKEN","refresh-token-"+label);
}
describe("Zoho Mail HTTPS OAuth transport",()=>{
 it("refreshes the access token and sends a plaintext message over fixed HTTPS hosts",async()=>{
  configure("success");
  const send=vi.fn(async(url:string,options:RequestInit)=>{
   if(url.includes("/oauth/v2/token")){
    expect(url).toBe("https://accounts.zoho.eu/oauth/v2/token");
    expect(String(options.body)).toContain("grant_type=refresh_token");
    return Response.json({access_token:"verified-oauth-access-token",expires_in:3600});
   }
   expect(url).toBe("https://mail.zoho.eu/api/accounts/1234567890/messages");
   expect(options.headers).toMatchObject({Authorization:"Zoho-oauthtoken verified-oauth-access-token"});
   expect(JSON.parse(options.body as string)).toMatchObject({toAddress:"owner@example.com",
    fromAddress:"snoozersupport@snoozer.uk",mailFormat:"plaintext"});
   return Response.json({status:{code:200,description:"success"},data:{}});
  });
  expect(zohoMailApiConfigured()).toBe(true);
  expect(await sendZohoApiNotice("owner@example.com","Snoozer test","Test email",send as never)).toBe(true);
  expect(send).toHaveBeenCalledTimes(2);
 });
 it("rejects unknown regions and header injection without external calls",async()=>{
  configure("invalid");
  vi.stubEnv("ZOHO_MAIL_REGION","malicious.example");
  const send=vi.fn();
  expect(zohoMailApiConfigured()).toBe(false);
  expect(await sendZohoApiNotice("owner@example.com","Test","Body",send as never)).toBe(false);
  vi.stubEnv("ZOHO_MAIL_REGION","uk");
  expect(await sendZohoApiNotice("owner@example.com","test\r\nBcc: other@example.com","Body",send as never)).toBe(false);
  expect(send).not.toHaveBeenCalled();
 });
 it("rejects an unsuccessful provider response even with HTTP 200",async()=>{
  configure("reject");
  const send=vi.fn(async(url:string)=>{
   if(url.includes("/oauth/v2/token"))
    return Response.json({access_token:"valid-access-token-for-reject",expires_in:3600});
   return Response.json({status:{code:500,description:"failed"}});
  });
  expect(await sendZohoApiNotice("owner@example.com","Test","Body",send as never)).toBe(false);
 });
 it("fails closed if OAuth refresh is rejected",async()=>{
  configure("auth-failure");
  const send=vi.fn(async()=>Response.json({error:"invalid_client"},{status:401}));
  expect(await sendZohoApiNotice("owner@example.com","Test","Body",send as never)).toBe(false);
  expect(send).toHaveBeenCalledTimes(1);
 });
});
