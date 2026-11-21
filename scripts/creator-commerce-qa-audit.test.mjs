import { test } from "node:test";
import assert from "node:assert/strict";
import { inspectCreatorQaPayment } from "./creator-commerce-qa-core.mjs";

const id="11111111-1111-4111-8111-111111111111";
const version="22222222-2222-4222-8222-222222222222";
const now=Date.parse("2026-11-21T12:00:00Z");
function fixture() {
  const order={
    id,versionId:version,platformId:"acct_Platform",accountId:"acct_Seller",
    checkoutId:"cs_test_Isolated",paymentId:"pi_Isolated",chargeId:"ch_Isolated",
    state:"paid",paidAt:"2026-11-20T12:00:00Z",accessUntil:"2026-12-20T12:00:00Z",
    amount:500,holds:[],
  };
  const session={
    id:order.checkoutId,object:"checkout.session",livemode:false,mode:"payment",
    status:"complete",payment_status:"paid",client_reference_id:id,
    metadata:{snoozer_order:id,snoozer_version:version},
    currency:"gbp",amount_total:500,payment_intent:{
      id:"pi_Isolated",object:"payment_intent",livemode:false,status:"succeeded",
      amount_received:500,latest_charge:{
        id:"ch_Isolated",object:"charge",livemode:false,payment_intent:"pi_Isolated",
        currency:"gbp",amount:500,paid:true,captured:true,status:"succeeded",
        amount_refunded:0,refunded:false,disputed:false,
        fraud_details:null,outcome:null,
      },
    },
  };
  return {order,session,disputes:{object:"list",has_more:false,data:[]},
    warnings:{object:"list",has_more:false,data:[]}};
}
test("read-only QA report verifies bindings but does not claim provider risk before a genuine signal",()=>{
  const e=inspectCreatorQaPayment(fixture(),now);
  assert.equal(e.paid,true);
  assert.equal(e.storedAccessEligible,true);
  assert.equal(e.riskObserved,false);
  assert.equal(e.allObservedRiskHeld,true);
});
test("partial refund requires a sticky hold and disables access in the recorded order",()=>{
  const p=fixture();
  p.session.payment_intent.latest_charge.amount_refunded=1;
  let e=inspectCreatorQaPayment(p,now);
  assert.deepEqual(e.missingHolds,["refund"]);
  assert.equal(e.allObservedRiskHeld,false);
  p.order.holds=["refund"];
  e=inspectCreatorQaPayment(p,now);
  assert.deepEqual(e.missingHolds,[]);
  assert.equal(e.storedAccessEligible,false);
});
test("dispute and fraud warning require their own recorded holds, even if a refund hold exists",()=>{
  const p=fixture();
  p.order.holds=["refund"];
  p.disputes.data.push({id:"du_Test",object:"dispute",livemode:false,charge:"ch_Isolated"});
  p.warnings.data.push({id:"issfr_Test",object:"radar.early_fraud_warning",livemode:false,charge:"ch_Isolated"});
  let e=inspectCreatorQaPayment(p,now);
  assert.deepEqual(e.missingHolds,["dispute","fraud"]);
  p.order.holds=["refund","dispute","fraud"];
  e=inspectCreatorQaPayment(p,now);
  assert.equal(e.allObservedRiskHeld,true);
  assert.equal(e.storedAccessEligible,false);
});
test("foreign charge, live-mode and incomplete risk evidence fail closed",()=>{
  for(const mutate of [
    p=>{p.session.client_reference_id=version;},
    p=>{p.session.livemode=true;},
    p=>{p.order.accountId=p.order.platformId;},
    p=>{p.session.payment_intent.latest_charge.amount_refunded=9999;},
    p=>{p.disputes.has_more=true;},
    p=>{p.disputes.data=[{object:"dispute",charge:"ch_Foreign",livemode:false}];},
    p=>{p.warnings.data=[{object:"radar.early_fraud_warning",charge:"ch_Foreign",livemode:false}];},
    p=>{p.session.payment_intent.latest_charge.payment_intent="pi_Foreign";},
  ]) {
    const p=fixture();mutate(p);
    assert.throws(()=>inspectCreatorQaPayment(p,now));
  }
});
test("a paid but expired test order does not retain database access eligibility",()=>{
  const p=fixture();p.order.accessUntil="2026-11-20T12:00:00Z";
  const e=inspectCreatorQaPayment(p,now);
  assert.equal(e.paid,true);
  assert.equal(e.accessWindowOpen,false);
  assert.equal(e.storedAccessEligible,false);
});
