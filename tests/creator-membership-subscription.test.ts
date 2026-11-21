import {expect,it,vi} from "vitest";
vi.mock("server-only",()=>({}));
import {memberRecord,membershipAccess} from "../src/lib/creator-membership-subscription";
import {inspectMembershipCheckout,inspectMembershipSubscription,inspectMembershipInvoice,membershipCheckoutConfig} from "../src/lib/creator-membership-provider";
const id="00000000-0000-4000-8000-000000000001",buyer="00000000-0000-4000-8000-000000000002",seller="00000000-0000-4000-8000-000000000003",offer="00000000-0000-4000-8000-000000000004";
const now=Date.parse("2026-11-21T08:00:00Z"),start=now/1000-60,end=start+30*86400;
const date=(n:number)=>new Date(n*1000).toISOString();
const m=memberRecord.parse({id,buyerId:buyer,sellerId:seller,offerId:offer,offerRevision:0,title:"Supporter",benefits:"Updates",monthlyPence:500,
 platformId:"acct_Platform",accountId:"acct_Seller",createdAt:date(start),checkoutId:"cs_test_Member",subscriptionId:"sub_Member",customerId:"cus_Member",
 state:"active",periodEnd:date(end),checkedAt:date(now/1000-5),cancelAtEnd:false,holds:[],pendingReceipt:false});
const tags={snoozer_membership:id,snoozer_membership_offer:offer};
const session={id:"cs_test_Member",object:"checkout.session",livemode:false,mode:"subscription",status:"complete",currency:"gbp",amount_total:500,amount_subtotal:500,client_reference_id:id,metadata:tags,created:start,expires_at:start+86340,subscription:"sub_Member",customer:"cus_Member",total_details:{amount_discount:0,amount_shipping:0,amount_tax:0},url:null};
const item={id:"si_Member",quantity:1,price:{id:"price_Member",currency:"gbp",unit_amount:500,type:"recurring",recurring:{interval:"month",interval_count:1,usage_type:"licensed"}},current_period_start:start,current_period_end:end};
const sub={id:"sub_Member",object:"subscription",livemode:false,customer:"cus_Member",status:"active",metadata:tags,cancel_at_period_end:false,collection_method:"charge_automatically",latest_invoice:"in_Member",application_fee_percent:null,transfer_data:null,on_behalf_of:null,pause_collection:null,items:{has_more:false,data:[item]}};
const invoice={id:"in_Member",object:"invoice",livemode:false,parent:{type:"subscription_details",subscription_details:{subscription:"sub_Member"}},customer:"cus_Member",currency:"gbp",status:"paid",amount_due:500,amount_paid:500,amount_remaining:0,total:500,lines:{has_more:false,data:[{amount:500,currency:"gbp",period:{start,end},parent:{type:"subscription_item_details",subscription_item_details:{subscription_item:"si_Member"}}}]}};
it("denies stale, pending, held, expired or inactive access even after a previously active period",()=>{
 expect(membershipAccess(m,now)).toBe(true);
 for(const v of [{...m,pendingReceipt:true},{...m,holds:["refund"] as const},{...m,checkedAt:date(now/1000-31)},{...m,periodEnd:date(start)},{...m,state:"inactive" as const}]) expect(membershipAccess(memberRecord.parse(v),now)).toBe(false);
 expect(membershipAccess({...m,cancelAtEnd:true},now)).toBe(true);
});
it("checks the exact sandbox subscription Checkout and rejects foreign or changed payment bindings",()=>{
 expect(inspectMembershipCheckout(session,m).subscriptionId).toBe("sub_Member");
 for(const v of [{...session,livemode:true},{...session,mode:"payment"},{...session,amount_total:100},{...session,subscription:"sub_Other"},{...session,metadata:{}},{...session,customer:"cus_Other"}]) expect(()=>inspectMembershipCheckout(v,m)).toThrow();
});
it("only accepts a current active monthly single-item subscription and its exact paid invoice",()=>{
 const proof=inspectMembershipSubscription(sub,m,now);expect(proof.state).toBe("active");
 expect(inspectMembershipInvoice(invoice,m,proof)).toBe("in_Member");
 for(const status of ["past_due","trialing","unpaid","paused","incomplete","canceled"]) expect(inspectMembershipSubscription({...sub,status},m,now).state).not.toBe("active");
 expect(inspectMembershipSubscription({...sub,cancel_at_period_end:true},m,now).cancelAtEnd).toBe(true);
 expect(()=>inspectMembershipSubscription({...sub,items:{has_more:false,data:[{...item,quantity:2}]}},m,now)).toThrow();
 for(const v of [{...invoice,status:"open"},{...invoice,amount_paid:0},{...invoice,customer:"cus_Other"},{...invoice,lines:{has_more:true,data:invoice.lines.data}}]) expect(()=>inspectMembershipInvoice(v,m,proof)).toThrow();
});
it("keeps new recurring Checkout disabled without independently configured flags and webhook secret",()=>{
 expect(membershipCheckoutConfig()).toBeNull();
});
