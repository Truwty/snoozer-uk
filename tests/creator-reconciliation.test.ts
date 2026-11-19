import { beforeEach,expect,it,vi } from "vitest";
import type Stripe from "stripe";
import { inspectCreatorCheckout,processCreatorReceipt,readCreatorCheckout,reconcileCreatorOrder } from "../src/lib/creator-reconciliation";
import type { CreatorOrder } from "../src/lib/creator-orders";
import type { CreatorReceipt } from "../src/lib/creator-webhook";
vi.mock("server-only",()=>({}));
const mocks=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock("../src/lib/supabase",()=>({storageAdmin:()=>({rpc:mocks.rpc})}));
const now=Date.parse("2026-11-19T01:00:00Z");
const order:CreatorOrder={id:"96d1a429-7773-4170-982c-c7d93004ee79",buyerId:"1dce924d-1611-4270-a705-07ef394df432",sellerId:"a8118598-c149-4d85-acee-799ca34d598e",
  profileId:"0286ea68-2694-45c8-bef2-2b968457e98c",versionId:"4e791fc7-3603-41ef-8e56-d8c4f1fb9877",platformId:"acct_Platform",accountId:"acct_Creator",
  createdAt:new Date(now).toISOString(),checkoutId:"cs_test_Order",checkoutExpiresAt:new Date(now+86340000).toISOString(),paymentId:null,chargeId:null,
  state:"pending",paidAt:null,accessUntil:null,holds:[],title:"Sandbox guide",description:"Fixture",amount:500,currency:"gbp",bytes:100,sha256:"a".repeat(64)};
const receipt:CreatorReceipt={id:"evt_Creator",accountId:order.accountId,type:"checkout.session.completed",objectId:order.checkoutId!,occurredAt:order.createdAt};
function provider() {
  const metadata={snoozer_order:order.id,snoozer_version:order.versionId};
  const charge={id:"ch_Order",object:"charge",livemode:false,amount:500,currency:"gbp",payment_intent:"pi_Order",paid:true,captured:true,status:"succeeded",
    amount_refunded:0,refunded:false,disputed:false,fraud_details:{},outcome:{risk_level:"normal"},application_fee:null,application_fee_amount:null,on_behalf_of:null,transfer_data:null};
  const payment={id:"pi_Order",object:"payment_intent",livemode:false,metadata,amount:500,currency:"gbp",amount_received:500,status:"succeeded",
    application_fee_amount:null,on_behalf_of:null,transfer_data:null,latest_charge:charge};
  const session={id:order.checkoutId,object:"checkout.session",livemode:false,mode:"payment",status:"complete",payment_status:"paid",currency:"gbp",amount_subtotal:500,amount_total:500,
    client_reference_id:order.id,metadata,created:now/1000,expires_at:now/1000+86340,total_details:{amount_discount:0,amount_shipping:0,amount_tax:0},
    line_items:{object:"list",has_more:false,data:[{object:"item",quantity:1,amount_subtotal:500,amount_total:500,currency:"gbp",price:{currency:"gbp",unit_amount:500,type:"one_time",recurring:null}}]},payment_intent:payment};
  const retrieve=vi.fn().mockResolvedValue(session),list=vi.fn().mockResolvedValue({object:"list",has_more:false,data:[]}),self=vi.fn().mockResolvedValue({id:order.platformId});
  const charges=vi.fn().mockResolvedValue({...charge,payment_intent:payment});
  const dispute=vi.fn().mockResolvedValue({id:"du_Order",object:"dispute",livemode:false,charge:charge.id});
  return {session,payment,charge,retrieve,list,self,charges,dispute,stripe:{accounts:{retrieve:self},checkout:{sessions:{retrieve}},charges:{retrieve:charges},
    disputes:{retrieve:dispute},radar:{earlyFraudWarnings:{list,retrieve:vi.fn()}}} as unknown as Stripe};
}
beforeEach(()=>{mocks.rpc.mockReset();mocks.rpc.mockImplementation(async(name:string,params:Record<string,unknown>)=>({error:null,data:
  name==="get_creator_sandbox_order"?order:name==="reconcile_creator_sandbox_order"?{...order,state:params.p_state,paymentId:params.p_payment,chargeId:params.p_charge,
    holds:params.p_holds,paidAt:order.createdAt,accessUntil:new Date(now+30*86400000).toISOString()}:true}));});
it("requires the immutable GBP copy, exact scope, expanded payment/charge and a single undiscounted item before paid proof",async()=>{
  const p=provider();expect(inspectCreatorCheckout(p.session,order)).toMatchObject({state:"paid",holds:[],paymentId:"pi_Order",chargeId:"ch_Order"});
  await readCreatorCheckout(p.stripe,order);
  expect(p.retrieve).toHaveBeenCalledWith(order.checkoutId,{expand:["payment_intent.latest_charge","line_items"]},{stripeAccount:order.accountId});
  expect(p.list).toHaveBeenCalledWith({charge:"ch_Order",limit:1},{stripeAccount:order.accountId});
  for(const patch of [{livemode:true},{amount_total:501},{currency:"usd"},{id:"cs_test_Other"},{mode:"subscription"},{client_reference_id:order.versionId},
    {line_items:{...p.session.line_items,has_more:true}},{line_items:{...p.session.line_items,data:[...p.session.line_items.data,...p.session.line_items.data]}},
    {total_details:{amount_discount:1,amount_shipping:0,amount_tax:0}},{payment_intent:"pi_Order"},{payment_intent:null},{expires_at:now/1000+90000}])
    expect(()=>inspectCreatorCheckout({...p.session,...patch},order)).toThrow();
});
it("does not grant access for open, expired or asynchronous pending sessions",()=>{
  const p=provider();
  expect(inspectCreatorCheckout({...p.session,status:"open",payment_status:"unpaid",payment_intent:null},order).state).toBe("pending");
  expect(inspectCreatorCheckout({...p.session,status:"expired",payment_status:"unpaid",payment_intent:null},order).state).toBe("expired");
  p.session.payment_status="unpaid";p.payment.status="processing";p.payment.amount_received=0;p.charge.paid=false;
  expect(inspectCreatorCheckout(p.session,order).state).toBe("pending");
});
it("rejects incomplete paid proof, mismatched identities, fees, transfers and changed prices",()=>{
  for(const patch of [{amount_received:499},{status:"processing"},{application_fee_amount:50},{transfer_data:{destination:"acct_Other"}},
    {metadata:{snoozer_order:order.versionId,snoozer_version:order.versionId}},{latest_charge:"ch_Order"},{latest_charge:null}]) {
    const p=provider();expect(()=>inspectCreatorCheckout({...p.session,payment_intent:{...p.payment,...patch}},order)).toThrow();
  }
  for(const patch of [{captured:false},{paid:false},{amount:499},{payment_intent:"pi_Other"},{livemode:true},{on_behalf_of:"acct_Other"}]) {
    const p=provider();expect(()=>inspectCreatorCheckout({...p.session,payment_intent:{...p.payment,latest_charge:{...p.charge,...patch}}},order)).toThrow();
  }
  const p=provider();expect(()=>inspectCreatorCheckout(p.session,{...order,chargeId:"ch_Other"})).toThrow();
});
it("does not pin failed charge attempts and expires a canonically failed asynchronous Checkout",()=>{
  const p=provider();p.session.payment_status="unpaid";p.payment.status="requires_payment_method";p.payment.amount_received=0;
  p.charge.paid=false;p.charge.captured=false;p.charge.status="failed";
  expect(inspectCreatorCheckout(p.session,order)).toMatchObject({state:"expired",chargeId:null,paymentId:"pi_Order"});
  p.session.status="open";expect(inspectCreatorCheckout(p.session,order)).toMatchObject({state:"pending",chargeId:null});
});
it("holds partial refunds, disputes, high-risk charges and current early fraud warnings",async()=>{
  const p=provider();p.charge.amount_refunded=1;p.charge.disputed=true;p.charge.outcome.risk_level="highest";
  expect(inspectCreatorCheckout(p.session,order).holds).toEqual(["refund","dispute","fraud"]);
  const clean=provider();clean.list.mockResolvedValue({object:"list",has_more:false,data:[{id:"issfr_Order",object:"radar.early_fraud_warning",livemode:false,charge:"ch_Order"}]});
  expect((await readCreatorCheckout(clean.stripe,order)).holds).toEqual(["fraud"]);
  clean.list.mockRejectedValue(new Error("provider unavailable"));await expect(readCreatorCheckout(clean.stripe,order)).rejects.toThrow();
});
it("persists before provider reads and reconciles only the bound platform/account/order",async()=>{
  const p=provider();await processCreatorReceipt(p.stripe,order.platformId,receipt);
  expect(mocks.rpc.mock.calls.map(c=>c[0])).toEqual(["record_creator_sandbox_receipt","get_creator_sandbox_order","reconcile_creator_sandbox_order"]);
  expect(mocks.rpc).toHaveBeenLastCalledWith("reconcile_creator_sandbox_order",expect.objectContaining({p_order:order.id,p_account:order.accountId,p_checkout:order.checkoutId,p_state:"paid",p_receipt:receipt.id}));
  mocks.rpc.mockResolvedValue({error:new Error("offline"),data:null});p.self.mockClear();
  await expect(processCreatorReceipt(p.stripe,order.platformId,receipt)).rejects.toThrow();expect(p.self).not.toHaveBeenCalled();
});
it("ignores unknown sellers without provider access and durably disposes unrelated seller payments",async()=>{
  const p=provider();mocks.rpc.mockResolvedValueOnce({error:null,data:false});await processCreatorReceipt(p.stripe,order.platformId,receipt);expect(p.self).not.toHaveBeenCalled();
  p.session.metadata={snoozer_order:"not-an-order",snoozer_version:order.versionId};await processCreatorReceipt(p.stripe,order.platformId,receipt);
  expect(mocks.rpc).toHaveBeenLastCalledWith("ignore_creator_sandbox_receipt",expect.objectContaining({p_id:receipt.id}));
});
it("stops cross-account events and preserves dispute holds before the success event arrives",async()=>{
  const p=provider();await expect(processCreatorReceipt(p.stripe,order.platformId,{...receipt,accountId:"acct_Other"})).rejects.toThrow();
  expect(mocks.rpc.mock.calls.some(c=>c[0]==="reconcile_creator_sandbox_order")).toBe(false);mocks.rpc.mockClear();
  await processCreatorReceipt(p.stripe,order.platformId,{...receipt,type:"charge.dispute.closed",objectId:"du_Order"});
  expect(mocks.rpc).toHaveBeenLastCalledWith("reconcile_creator_sandbox_order",expect.objectContaining({p_holds:["dispute"],p_charge:"ch_Order"}));
  p.charge.id="ch_Other";await expect(processCreatorReceipt(p.stripe,order.platformId,{...receipt,type:"charge.dispute.created",objectId:"du_Order"})).rejects.toThrow();
});
it("recovers a canonical Checkout before payment persistence and never acknowledges failed binding or state writes",async()=>{
  const p=provider();const unbound={...order,checkoutId:null,checkoutExpiresAt:null};
  await reconcileCreatorOrder(p.stripe,unbound,receipt,receipt.objectId);
  expect(mocks.rpc.mock.calls.map(c=>c[0])).toEqual(["recover_creator_sandbox_checkout","reconcile_creator_sandbox_order"]);
  mocks.rpc.mockReset().mockResolvedValue({error:null,data:false});
  await expect(reconcileCreatorOrder(p.stripe,unbound,receipt,receipt.objectId)).rejects.toThrow();expect(mocks.rpc).toHaveBeenCalledTimes(1);
});
