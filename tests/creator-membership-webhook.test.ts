import Stripe from "stripe";
import {expect,it,vi} from "vitest";
vi.mock("server-only",()=>({}));
vi.mock("../src/lib/creator-membership-server",()=>({}));
import {parseMembershipEvent,receiveMembershipWebhook} from "../src/lib/creator-membership-webhook";
const secret="whsec_fixture_"+"z".repeat(32);
const event={id:"evt_Member",object:"event",account:"acct_Creator",type:"invoice.paid",created:1760000000,livemode:false,
 data:{object:{id:"in_Member",object:"invoice",livemode:false,customer_email:"private@example.com"}}};
function request(value:unknown,stamp?:number) {
 const payload=JSON.stringify(value);
 return new Request("https://example.com/api/v1/commerce/memberships/webhook",{method:"POST",body:payload,headers:{"stripe-signature":Stripe.webhooks.generateTestHeaderString({payload,secret,timestamp:stamp})}});
}
it("requires signed connected-account test events and does not acknowledge failed processing",async()=>{
 const process=vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined);
 expect((await receiveMembershipWebhook(request(event),secret,process)).status).toBe(503);
 expect((await receiveMembershipWebhook(request(event),secret,process)).status).toBe(204);
 expect(process).toHaveBeenLastCalledWith({id:event.id,account:event.account,type:event.type,objectId:"in_Member",occurredAt:"2025-10-09T08:53:20.000Z"});
 for(const patch of [{livemode:true},{account:null},{context:"acct_Other"},{data:{object:{...event.data.object,livemode:true}}},{data:{object:{...event.data.object,object:"charge"}}}]) expect((await receiveMembershipWebhook(request({...event,...patch}),secret,process)).status).toBe(400);
 expect((await receiveMembershipWebhook(request(event,Math.floor(Date.now()/1000)-301),secret,process)).status).toBe(400);
 expect(process).toHaveBeenCalledTimes(2);
});
it("recognizes paid, failed, cancellation and risk events while stripping provider payloads",()=>{
 for(const [type,object,id] of [["customer.subscription.deleted","subscription","sub_M"],["invoice.payment_failed","invoice","in_M"],["charge.refunded","charge","ch_M"],["charge.dispute.closed","dispute","du_M"],["radar.early_fraud_warning.created","radar.early_fraud_warning","issfr_M"]])
  expect(parseMembershipEvent({...event,type,data:{object:{id,object,livemode:false}}})).toMatchObject({type,objectId:id});
 expect(parseMembershipEvent({...event,type:"payment_intent.succeeded"})).toBeNull();
});
