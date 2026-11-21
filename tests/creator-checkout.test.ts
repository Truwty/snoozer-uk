import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type Stripe from "stripe";
import type { CreatorMerchant } from "../src/lib/creator-merchant";
import { creatorOrder, type CreatorOrder } from "../src/lib/creator-orders";
import { createCreatorSandboxCheckout, creatorCheckoutConfig } from "../src/lib/creator-checkout";
import { creatorSandboxConfig } from "../src/lib/creator-stripe";
vi.mock("server-only",()=>({}));
afterEach(()=>vi.unstubAllEnvs());
const now=Date.parse("2026-11-19T01:00:00Z");
const order:CreatorOrder={id:"96d1a429-7773-4170-982c-c7d93004ee79",buyerId:"1dce924d-1611-4270-a705-07ef394df432",sellerId:"a8118598-c149-4d85-acee-799ca34d598e",
  profileId:"0286ea68-2694-45c8-bef2-2b968457e98c",versionId:"4e791fc7-3603-41ef-8e56-d8c4f1fb9877",platformId:"acct_Platform",accountId:"acct_Creator",
  createdAt:new Date(now).toISOString(),checkoutId:null,checkoutExpiresAt:null,paymentId:null,chargeId:null,state:"pending",paidAt:null,accessUntil:null,holds:[],
  title:"Sandbox guide",description:"Private test fixture",amount:500,currency:"gbp",bytes:100,sha256:"a".repeat(64)};
const merchant:CreatorMerchant={id:"71ee2bc2-3003-48a3-a2f1-5145613293b3",platformId:order.platformId,accountId:order.accountId,country:"GB",createdAt:order.createdAt,ready:false,checkedAt:null};
beforeEach(()=>{
  vi.stubEnv("SNOOZER_CREATOR_SANDBOX_ENABLED","true");vi.stubEnv("STRIPE_CREATOR_SANDBOX_PLATFORM_ID",order.platformId);
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY","unit-fixture");vi.stubEnv("STRIPE_CREATOR_SANDBOX_API_KEY",["rk","test","x".repeat(32)].join("_"));
  vi.stubEnv("SNOOZER_CREATOR_CHECKOUT_ENABLED","true");vi.stubEnv("STRIPE_CREATOR_SANDBOX_WEBHOOK_SECRET","whsec_"+"x".repeat(32));
});
function provider() {
  const account={id:order.accountId,object:"v2.core.account",livemode:false,dashboard:"full",metadata:{snoozer_operation:merchant.id},
    defaults:{responsibilities:{fees_collector:"stripe",losses_collector:"stripe"}},
    configuration:{merchant:{capabilities:{card_payments:{status:"active"},stripe_balance:{payouts:{status:"active"}}}}}};
  const session={id:"cs_test_Creator",object:"checkout.session",livemode:false,mode:"payment",status:"open",payment_status:"unpaid",currency:"gbp",amount_subtotal:500,amount_total:500,
    client_reference_id:order.id,metadata:{snoozer_order:order.id,snoozer_version:order.versionId},expires_at:Math.floor(now/1000)+86340,url:"https://checkout.stripe.com/c/pay/cs_test_Creator"};
  const self=vi.fn().mockResolvedValue({id:order.platformId}); const retrieve=vi.fn().mockResolvedValue(account); const create=vi.fn().mockResolvedValue(session);
  const stripe={accounts:{retrieve:self},v2:{core:{accounts:{retrieve}}},checkout:{sessions:{create}}} as unknown as Stripe;
  return {stripe,account,session,self,retrieve,create};
}
it("requires a separate Checkout gate, pinned seller/test key and signing secret",()=>{
  vi.stubEnv("SNOOZER_CREATOR_SANDBOX_ENABLED","true");vi.stubEnv("STRIPE_CREATOR_SANDBOX_PLATFORM_ID",order.platformId);
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY","unit-fixture");vi.stubEnv("STRIPE_CREATOR_SANDBOX_API_KEY",["rk","test","x".repeat(32)].join("_"));
  vi.stubEnv("SNOOZER_CREATOR_CHECKOUT_ENABLED","false");vi.stubEnv("STRIPE_CREATOR_SANDBOX_WEBHOOK_SECRET","whsec_"+"x".repeat(32));
  expect(creatorCheckoutConfig()).toBeNull();
  // Closing new Checkout must not disable existing buyer refresh or webhook handling.
  expect(creatorSandboxConfig()?.platformId).toBe(order.platformId);
  vi.stubEnv("SNOOZER_CREATOR_CHECKOUT_ENABLED","true");expect(creatorCheckoutConfig()?.platformId).toBe(order.platformId);
  vi.stubEnv("STRIPE_CREATOR_SANDBOX_WEBHOOK_SECRET","");expect(creatorCheckoutConfig()).toBeNull();
});
it("enforces the default-off gate at the provider write boundary",async()=>{
  const p=provider();vi.stubEnv("SNOOZER_CREATOR_CHECKOUT_ENABLED","false");
  await expect(createCreatorSandboxCheckout(p.stripe,order,merchant,new URL("https://example.com"),now)).rejects.toThrow();
  expect(p.self).not.toHaveBeenCalled();expect(p.create).not.toHaveBeenCalled();
});
it("uses the immutable order, exact connected-account scope and stable idempotency without buyer identity or platform fees",async()=>{
  const p=provider();
  expect(await createCreatorSandboxCheckout(p.stripe,order,merchant,new URL("https://example.com"),now)).toMatchObject({id:p.session.id,expiresAt:new Date(now+86340000).toISOString()});
  const [params,options]=p.create.mock.calls[0];
  expect(options).toEqual({stripeAccount:order.accountId,idempotencyKey:"snoozer-creator-checkout-"+order.id});
  expect(params).toMatchObject({mode:"payment",client_reference_id:order.id,metadata:{snoozer_order:order.id,snoozer_version:order.versionId},
    line_items:[{quantity:1,price_data:{currency:"gbp",unit_amount:500,product_data:{name:order.title}}}],adaptive_pricing:{enabled:false}});
  expect(params.integration_identifier).toMatch(/^snoozer-creator-[a-z]{8}$/);
  expect(params.success_url).toBe("https://example.com/studio/purchases?order="+order.id);
  expect(params.cancel_url).toBe("https://example.com/studio/purchases?order="+order.id+"&cancelled=1");
  expect(params.payment_intent_data).toEqual({metadata:params.metadata});
  for(const key of ["customer","customer_email","payment_method_types","automatic_tax","allow_promotion_codes"])expect(params[key]).toBeUndefined();
  await createCreatorSandboxCheckout(p.stripe,order,merchant,new URL("https://example.com"),now+60000);
  expect(p.create.mock.calls[1]).toEqual(p.create.mock.calls[0]);
});
it("refuses held, expired, bound, future, uncertain and wrong-merchant attempts before provider writes",async()=>{
  const p=provider();
  for(const value of [{...order,holds:["refund"]},{...order,state:"expired"},{...order,createdAt:new Date(now+60000).toISOString()},
    {...order,createdAt:new Date(now-24*3600000).toISOString()},{...order,checkoutId:"cs_test_Bound",checkoutExpiresAt:new Date(now+3600000).toISOString()},
    {...order,accountId:"acct_Other"}])await expect(createCreatorSandboxCheckout(p.stripe,value as CreatorOrder,merchant,new URL("https://example.com"),now)).rejects.toThrow();
  await expect(createCreatorSandboxCheckout(p.stripe,order,merchant,new URL("http://example.com"),now)).rejects.toThrow();
  await expect(createCreatorSandboxCheckout(p.stripe,order,merchant,new URL("ftp://localhost"),now)).rejects.toThrow();
  await expect(createCreatorSandboxCheckout(p.stripe,order,merchant,new URL("https://user:pass@example.com"),now)).rejects.toThrow();
  expect(p.create).not.toHaveBeenCalled();
});
it("requires both current capabilities and the pinned platform before creating Checkout",async()=>{
  const p=provider();p.account.configuration.merchant.capabilities.stripe_balance.payouts.status="pending";
  await expect(createCreatorSandboxCheckout(p.stripe,order,merchant,new URL("https://example.com"),now)).rejects.toThrow();expect(p.create).not.toHaveBeenCalled();
  p.self.mockResolvedValueOnce({id:"acct_Other"});
  await expect(createCreatorSandboxCheckout(p.stripe,order,merchant,new URL("https://example.com"),now)).rejects.toThrow();expect(p.create).not.toHaveBeenCalled();
});
it("rejects live, altered-money, mismatched and unsafe provider responses",async()=>{
  for(const patch of [{livemode:true},{amount_total:501},{currency:"usd"},{client_reference_id:merchant.id},{expires_at:1},{metadata:{snoozer_order:merchant.id}},
    {url:"https://checkout.stripe.com.evil.example/pay"},{url:"https://user:pass@checkout.stripe.com/pay"},{url:"http://checkout.stripe.com/pay"}]){
    const p=provider();p.create.mockResolvedValue({...p.session,...patch});
    await expect(createCreatorSandboxCheckout(p.stripe,order,merchant,new URL("https://example.com"),now)).rejects.toThrow();
  }
});
it("validates the internal money and identity projection without coercion",()=>{
  for(const value of [{...order,amount:"500"},{...order,amount:49},{...order,buyerId:order.sellerId},{...order,accountId:order.platformId},
    {...order,holds:["refund","refund"]},{...order,state:"paid"},{...order,checkoutId:"cs_live_Invalid",checkoutExpiresAt:order.createdAt}])expect(creatorOrder.safeParse(value).success).toBe(false);
});
