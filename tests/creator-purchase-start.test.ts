import { beforeEach,expect,it,vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { startCreatorPurchase } from "../src/lib/creator-purchase-start";
vi.mock("server-only",()=>({}));
const mocks=vi.hoisted(()=>({rpc:vi.fn(),claim:vi.fn(),config:vi.fn(),create:vi.fn(),ready:vi.fn(),read:vi.fn(),reconcile:vi.fn(),stripe:{}}));
vi.mock("stripe",()=>({default:vi.fn(function(){return mocks.stripe;})}));
vi.mock("../src/lib/supabase",()=>({storageAdmin:()=>({rpc:mocks.rpc})}));
vi.mock("../src/lib/creator-store-server",()=>({refreshCreatorStore:vi.fn().mockResolvedValue(true)}));
vi.mock("../src/lib/creator-checkout",()=>({creatorCheckoutConfig:mocks.config,createCreatorSandboxCheckout:mocks.create}));
vi.mock("../src/lib/creator-reconciliation",()=>({readCreatorCheckout:mocks.read,reconcileCreatorOrder:mocks.reconcile}));
vi.mock("../src/lib/creator-stripe",async()=>({...await vi.importActual("../src/lib/creator-stripe"),readCreatorSandboxAccount:mocks.ready}));
const order={id:"96d1a429-7773-4170-982c-c7d93004ee79",buyerId:"1dce924d-1611-4270-a705-07ef394df432",sellerId:"a8118598-c149-4d85-acee-799ca34d598e",
  profileId:"0286ea68-2694-45c8-bef2-2b968457e98c",versionId:"4e791fc7-3603-41ef-8e56-d8c4f1fb9877",platformId:"acct_Platform",accountId:"acct_Creator",
  createdAt:"2026-11-19T01:00:00Z",checkoutId:null,checkoutExpiresAt:null,paymentId:null,chargeId:null,
  state:"pending",paidAt:null,accessUntil:null,holds:[],title:"Sandbox guide",description:"Fixture",amount:500,currency:"gbp",bytes:100,sha256:"a".repeat(64)};
const merchant={id:"71ee2bc2-3003-48a3-a2f1-5145613293b3",platformId:order.platformId,accountId:order.accountId,country:"GB",createdAt:order.createdAt,ready:true,checkedAt:order.createdAt};
const checkout={id:"cs_test_Order",url:"https://checkout.stripe.com/c/pay/cs_test_Order",expiresAt:"2026-11-20T00:59:00Z"};
const client={rpc:mocks.claim} as unknown as SupabaseClient;
const start=()=>startCreatorPurchase(client,order.buyerId,order.versionId,new URL("https://example.com"));
beforeEach(()=>{
  vi.resetAllMocks();mocks.config.mockReturnValue({key:["rk","test","fixture"].join("_"),platformId:order.platformId});mocks.claim.mockResolvedValue({error:null,data:true});
  mocks.rpc.mockImplementation(async(name:string)=>({error:null,data:name==="reserve_creator_sandbox_order"?order:name==="get_creator_sandbox_merchant"?merchant:true}));
  mocks.create.mockResolvedValue(checkout);mocks.ready.mockResolvedValue({ready:true});mocks.read.mockResolvedValue({state:"pending",holds:[],checkoutUrl:checkout.url});mocks.reconcile.mockResolvedValue(order);
});
it("returns Checkout only after durable buyer/account/session binding",async()=>{
  expect(await start()).toBe(checkout.url);
  expect(mocks.rpc.mock.calls.map(c=>c[0])).toEqual(["reserve_creator_sandbox_order","get_creator_sandbox_merchant","bind_creator_sandbox_checkout"]);
  expect(mocks.rpc).toHaveBeenLastCalledWith("bind_creator_sandbox_checkout",{p_order:order.id,p_buyer:order.buyerId,p_account:order.accountId,p_checkout:checkout.id,p_expires:checkout.expiresAt});
  expect(mocks.claim).toHaveBeenCalledWith("claim_my_creator_order_check",{p_order:order.id});
  expect(mocks.create.mock.invocationCallOrder[0]).toBeLessThan(mocks.rpc.mock.invocationCallOrder[2]);
});
it("never releases the provider URL after an uncertain binding failure",async()=>{
  mocks.rpc.mockImplementation(async(name:string)=>({error:null,data:name==="reserve_creator_sandbox_order"?order:name==="get_creator_sandbox_merchant"?merchant:false}));
  await expect(start()).rejects.toThrow("binding failed");expect(mocks.create).toHaveBeenCalledTimes(1);
});
it("resumes the same bound session without creating or rebinding another Checkout",async()=>{
  mocks.rpc.mockResolvedValueOnce({error:null,data:{...order,checkoutId:checkout.id,checkoutExpiresAt:checkout.expiresAt}});
  expect(await start()).toBe(checkout.url);expect(mocks.ready).toHaveBeenCalledWith(mocks.stripe,merchant);expect(mocks.create).not.toHaveBeenCalled();
  expect(mocks.rpc.mock.calls.some(c=>c[0]==="bind_creator_sandbox_checkout")).toBe(false);
});
it("reconciles a closed or held provider session and returns only the fixed private receipt page",async()=>{
  mocks.rpc.mockResolvedValueOnce({error:null,data:{...order,checkoutId:checkout.id,checkoutExpiresAt:checkout.expiresAt}});
  mocks.read.mockResolvedValueOnce({state:"paid",holds:[],checkoutUrl:null});expect(await start()).toBe("https://example.com/studio/purchases?order="+order.id);
  expect(mocks.reconcile).toHaveBeenCalledTimes(1);expect(mocks.create).not.toHaveBeenCalled();
});
it("rejects disabled gates, invalid identities and unsafe sites before reservation or provider writes",async()=>{
  mocks.config.mockReturnValueOnce(null);await expect(start()).rejects.toThrow();
  await expect(startCreatorPurchase(client,"invalid",order.versionId,new URL("https://example.com"))).rejects.toThrow();
  await expect(startCreatorPurchase(client,order.buyerId,order.versionId,new URL("ftp://localhost"))).rejects.toThrow();
  expect(mocks.rpc).not.toHaveBeenCalled();expect(mocks.create).not.toHaveBeenCalled();
});
it("stops swapped reservation, seller and throttle results before creating a payment",async()=>{
  for(const value of [{...order,buyerId:order.sellerId},{...order,versionId:order.profileId},{...order,platformId:"acct_Other"}]) {
    mocks.rpc.mockResolvedValueOnce({error:null,data:value});await expect(start()).rejects.toThrow();
  }
  mocks.claim.mockResolvedValueOnce({error:null,data:false});await expect(start()).rejects.toThrow("ten seconds");
  mocks.rpc.mockImplementation(async(name:string)=>({error:null,data:name==="reserve_creator_sandbox_order"?order:{...merchant,accountId:"acct_Other"}}));
  await expect(start()).rejects.toThrow();expect(mocks.create).not.toHaveBeenCalled();
});
