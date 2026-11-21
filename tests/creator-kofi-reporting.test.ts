import {createHash} from "node:crypto";
import {describe,expect,it,vi} from "vitest";
import {creatorKofiReport,creatorKofiToken,formatReportedAmount} from "../src/lib/creator-kofi-reporting";
import {receiveCreatorKofiNotification} from "../src/lib/creator-kofi-webhook";
const token="aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const data={verification_token:token,message_id:"00000000-0000-4000-8000-000000000099",
 kofi_transaction_id:"kf-1",timestamp:"2026-11-21T16:00:00Z",type:"Donation",amount:"5.00",currency:"GBP"};
function request(payload:unknown,contentType="application/x-www-form-urlencoded") {
 return new Request("https://example.com/api/v1/commerce/kofi/webhook",{method:"POST",
  headers:{"Content-Type":contentType},body:new URLSearchParams({data:JSON.stringify(payload)}).toString()});
}
describe("creator Ko-fi notification receiver",()=>{
 it("stores only strict, token-hashed and bounded external donation data",async()=>{
  const record=vi.fn().mockResolvedValue(true);
  expect((await receiveCreatorKofiNotification(request(data),record)).status).toBe(200);
  expect(record).toHaveBeenCalledWith({tokenSha256:createHash("sha256").update(token).digest("hex"),
   messageId:data.message_id,transactionId:"kf-1",occurredAt:data.timestamp,amountMinor:500,currency:"GBP"});
  expect(JSON.stringify(record.mock.calls)).not.toContain("verification_token");
  expect(JSON.stringify(record.mock.calls)).not.toContain(token);
 });
 it("fails closed for spoofed, oversized, unsupported, or unrecognised notifications",async()=>{
  const record=vi.fn().mockResolvedValue(false);
  expect((await receiveCreatorKofiNotification(request(data),record)).status).toBe(401);
  for(const patch of [{currency:"EUR"},{amount:"5.001"},{amount:"0.00"},{message_id:"not-uuid"},{verification_token:"short"}]){
   expect((await receiveCreatorKofiNotification(request({...data,...patch}),record)).status).toBe(400);
  }
  expect((await receiveCreatorKofiNotification(request(data,"application/json"),record)).status).toBe(415);
  const other=vi.fn();
  expect((await receiveCreatorKofiNotification(request({...data,type:"Subscription"}),other)).status).toBe(200);
  expect(other).not.toHaveBeenCalled();
  record.mockRejectedValueOnce(new Error("unavailable"));
  expect((await receiveCreatorKofiNotification(request(data),record)).status).toBe(503);
 });
 it("does not treat notifications as verified revenue, entitlements or tax",()=>{
  expect(creatorKofiToken.safeParse(token).success).toBe(true);
  expect(creatorKofiToken.safeParse("short").success).toBe(false);
  expect(formatReportedAmount(500,"GBP")).toContain("5.00");
  expect(creatorKofiReport.safeParse({revision:null,enabled:false,lastReportedAt:null,totals:[],notifications:[]}).success).toBe(true);
 });
});
