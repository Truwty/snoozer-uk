import {beforeEach,describe,expect,it,vi} from "vitest";
vi.mock("server-only",()=>({}));
const mocks=vi.hoisted(()=>({getUser:vi.fn(),rpc:vi.fn(),verify:vi.fn(),
 subscription:vi.fn(),invoice:vi.fn()}));
vi.mock("@/lib/supabase",()=>({sessionClient:async()=>({auth:{getUser:mocks.getUser},rpc:mocks.rpc})}));
vi.mock("@/lib/creator-membership-server",()=>({
 verifyMyMembership:mocks.verify,
 membershipStripe:()=>({config:{platformId:"acct_Platform"},stripe:{
  subscriptions:{retrieve:mocks.subscription},
  invoices:{retrieve:mocks.invoice},
 }}),
}));
import {GET} from "../src/app/studio/memberships/invoice/[id]/route";
import {verifiedStripeTestInvoicePdf} from "../src/lib/creator-membership-invoice";
import type {MemberRecord} from "../src/lib/creator-membership-subscription";
import {inspectMembershipSubscription} from "../src/lib/creator-membership-provider";
const id="00000000-0000-4000-8000-000000000001",buyer="00000000-0000-4000-8000-000000000002";
const seller="00000000-0000-4000-8000-000000000003",offer="00000000-0000-4000-8000-000000000004";
const now=Math.floor(Date.now()/1000),start=now-90,end=now+30*86400;
const date=(s:number)=>new Date(s*1000).toISOString();
const member:MemberRecord={id,buyerId:buyer,sellerId:seller,offerId:offer,offerRevision:0,title:"Test Supporter",
 benefits:"Updates",monthlyPence:500,platformId:"acct_Platform",accountId:"acct_Seller",createdAt:date(start-120),
 checkoutId:"cs_test_Member",subscriptionId:"sub_Member",customerId:"cus_Member",state:"active",
 periodEnd:date(end),checkedAt:date(now),cancelAtEnd:false,holds:[],pendingReceipt:false};
const tags={snoozer_membership:id,snoozer_membership_offer:offer};
const subscription={id:"sub_Member",object:"subscription",livemode:false,customer:"cus_Member",status:"active",
 metadata:tags,cancel_at_period_end:false,collection_method:"charge_automatically",latest_invoice:"in_Member",
 application_fee_percent:null,transfer_data:null,on_behalf_of:null,pause_collection:null,
 items:{has_more:false,data:[{id:"si_Member",quantity:1,price:{id:"price_Member",currency:"gbp",unit_amount:500,
 type:"recurring",recurring:{interval:"month",interval_count:1,usage_type:"licensed"}},
 current_period_start:start,current_period_end:end}]}};
const pdf="https://pay.stripe.com/invoice/acct_Seller/test_abc123DEF/pdf?token=safe";
const invoice={id:"in_Member",object:"invoice",livemode:false,customer:"cus_Member",currency:"gbp",status:"paid",
 amount_due:500,amount_paid:500,amount_remaining:0,total:500,invoice_pdf:pdf,
 parent:{type:"subscription_details",subscription_details:{subscription:"sub_Member"}},
 lines:{has_more:false,data:[{amount:500,currency:"gbp",period:{start,end},
  parent:{type:"subscription_item_details",subscription_item_details:{subscription_item:"si_Member"}}}]}};
const request=(ref=id)=>GET(new Request("https://example.com/studio/memberships/invoice/"+ref),
 {params:Promise.resolve({id:ref})});
beforeEach(()=>{vi.resetAllMocks();
 mocks.getUser.mockResolvedValue({data:{user:{id:buyer,email_confirmed_at:"confirmed"}},error:null});
 mocks.rpc.mockResolvedValue({data:true,error:null});
 mocks.verify.mockResolvedValue({record:member,active:true});
 mocks.subscription.mockResolvedValue(subscription);
 mocks.invoice.mockResolvedValue(invoice);
});
describe("fresh verified buyer Stripe test invoice handoff",()=>{
 it("redirects to an exact seller-scoped Stripe TEST paid invoice PDF only",async()=>{
  const response=await request();
  expect(response.status).toBe(303);expect(response.headers.get("location")).toBe(pdf);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  expect(mocks.subscription).toHaveBeenCalledWith("sub_Member",{}, {stripeAccount:"acct_Seller"});
  expect(mocks.invoice).toHaveBeenCalledWith("in_Member",{}, {stripeAccount:"acct_Seller"});
 });
 it("rejects foreign, unverified, malformed, stale or unavailable entitlements before invoice reads",async()=>{
  expect((await request("bad")).status).toBe(404);
  mocks.rpc.mockResolvedValueOnce({data:false,error:null});
  expect((await request()).status).toBe(404);
  mocks.getUser.mockResolvedValueOnce({data:{user:null},error:null});
  expect((await request()).status).toBe(404);
  mocks.verify.mockResolvedValueOnce({record:member,active:false});
  expect((await request()).status).toBe(404);
  mocks.verify.mockResolvedValueOnce({record:{...member,holds:["refund"]},active:true});
  expect((await request()).status).toBe(404);
  expect(mocks.subscription).not.toHaveBeenCalled();
 });
 it("refuses suspicious links, cross-seller invoices, live sessions and unpaid totals",async()=>{
  const proof=inspectMembershipSubscription(subscription,member);
  expect(verifiedStripeTestInvoicePdf(invoice,member,proof)).toBe(pdf);
  for(const url of ["https://pay.stripe.com.evil.test/invoice/acct_Seller/test_x/pdf",
   "http://pay.stripe.com/invoice/acct_Seller/test_x/pdf",
   "https://pay.stripe.com/invoice/acct_Other/test_x/pdf",
   "https://pay.stripe.com/invoice/acct_Seller/live_x/pdf",
   "https://pay.stripe.com@bad.test/invoice/acct_Seller/test_x/pdf",
   "https://pay.stripe.com/invoice/acct_Seller/test_x/pdf#bad"]) {
   expect(()=>verifiedStripeTestInvoicePdf({...invoice,invoice_pdf:url},member,proof)).toThrow();
  }
  for(const alteration of [{status:"open"},{amount_paid:300},{customer:"cus_Foreign"},{currency:"usd"},{livemode:true}]){
   expect(()=>verifiedStripeTestInvoicePdf({...invoice,...alteration},member,proof)).toThrow();
  }
  mocks.invoice.mockResolvedValueOnce({...invoice,invoice_pdf:"https://evil.test/pdf"});
  expect((await request()).status).toBe(503);
  expect(mocks.verify).toHaveBeenCalled();
 });
 it("denies expired or structurally changed current subscription billing periods",async()=>{
  mocks.subscription.mockResolvedValueOnce({...subscription,status:"past_due"});
  expect((await request()).status).toBe(404);
  mocks.subscription.mockResolvedValueOnce({...subscription,items:{has_more:false,data:[]}});
  expect((await request()).status).toBe(503);
 });
});
