import Stripe from "stripe";
import { expect,it,vi } from "vitest";
import { creatorSandboxReceipt,receiveCreatorWebhook } from "../src/lib/creator-webhook";

const secret="whsec_fixture_"+"z".repeat(32);
const event={id:"evt_Creator",object:"event",account:"acct_Creator",type:"checkout.session.completed",created:1760000000,livemode:false,
  data:{object:{id:"cs_test_Order",object:"checkout.session",livemode:false,customer_email:"private@example.com"}}};
function request(value:unknown,stamp?:number) {
  const payload=JSON.stringify(value);
  return new Request("https://example.com/api/v1/commerce/stripe/webhook",{method:"POST",body:payload,
    headers:{"stripe-signature":Stripe.webhooks.generateTestHeaderString({payload,secret,timestamp:stamp})}});
}
it("verifies connected-account raw bytes, strips customer payloads and acknowledges only after durable processing",async()=>{
  const record=vi.fn().mockRejectedValueOnce(new Error("database offline")).mockResolvedValue(undefined);
  expect((await receiveCreatorWebhook(request(event),secret,record)).status).toBe(503);
  expect((await receiveCreatorWebhook(request(event),secret,record)).status).toBe(204);
  expect(record).toHaveBeenLastCalledWith({id:event.id,type:event.type,accountId:event.account,objectId:"cs_test_Order",occurredAt:"2025-10-09T08:53:20.000Z"});
});
it("rejects live, platform-only, thin, stale, object-confused and incorrectly signed events",async()=>{
  const record=vi.fn();
  for(const patch of [{livemode:true},{account:null},{context:"acct_Context"},{data:{object:{...event.data.object,livemode:true}}},
    {data:{object:{...event.data.object,id:"cs_live_Order"}}},{data:{object:{...event.data.object,object:"charge"}}}])
    expect((await receiveCreatorWebhook(request({...event,...patch}),secret,record)).status).toBe(400);
  expect((await receiveCreatorWebhook(request(event,Math.floor(Date.now()/1000)-301),secret,record)).status).toBe(400);
  const body=JSON.stringify(event);
  const altered=new Request("https://example.com",{method:"POST",body:body+" ",headers:{"stripe-signature":Stripe.webhooks.generateTestHeaderString({payload:body,secret})}});
  expect((await receiveCreatorWebhook(altered,secret,record)).status).toBe(400);expect(record).not.toHaveBeenCalled();
  expect((await receiveCreatorWebhook(request({...event,type:"charge.refunded",data:{object:{id:"ch_"+"x".repeat(129),object:"charge",livemode:false}}}),secret,record)).status).toBe(400);
});
it("accepts Stripe snapshot context only when it matches the required connected account",async()=>{
  const record=vi.fn().mockResolvedValue(undefined);
  expect((await receiveCreatorWebhook(request({...event,api_version:"2026-10-28.endive",context:event.account}),secret,record)).status).toBe(204);
  expect(record).toHaveBeenCalledTimes(1);
  for(const patch of [{account:undefined,context:event.account},{context:"acct_Other"},{context:event.account,data:undefined}])
    expect((await receiveCreatorWebhook(request({...event,...patch}),secret,record)).status).toBe(400);
  expect(record).toHaveBeenCalledTimes(1);
});
it("bounds streams and keeps unrelated connected-account events separate from premium billing",async()=>{
  const record=vi.fn();
  expect((await receiveCreatorWebhook(new Request("https://example.com",{method:"POST",body:"x".repeat(262145),headers:{"stripe-signature":"test"}}),secret,record)).status).toBe(413);
  expect((await receiveCreatorWebhook(request({...event,type:"customer.subscription.updated"}),secret,record)).status).toBe(204);
  expect((await receiveCreatorWebhook(request(event),undefined,record)).status).toBe(503);expect(record).not.toHaveBeenCalled();
});
it("recognizes every required async, refund, dispute and fraud event",()=>{
  for(const [type,object,id] of [["checkout.session.async_payment_succeeded","checkout.session","cs_test_O"],["checkout.session.async_payment_failed","checkout.session","cs_test_O"],
    ["checkout.session.expired","checkout.session","cs_test_O"],["charge.refunded","charge","ch_O"],["charge.dispute.created","dispute","du_O"],
    ["charge.dispute.updated","dispute","du_O"],["charge.dispute.closed","dispute","du_O"],["radar.early_fraud_warning.created","radar.early_fraud_warning","issfr_O"],
    ["radar.early_fraud_warning.updated","radar.early_fraud_warning","issfr_O"]])
    expect(creatorSandboxReceipt({...event,type,data:{object:{id,object,livemode:false}}})).toMatchObject({type,objectId:id});
});
