import { beforeEach,expect,it,vi } from "vitest";
import { refreshCreatorPurchase } from "../src/lib/creator-purchases-server";
vi.mock("server-only",()=>({}));
const mocks=vi.hoisted(()=>({rpc:vi.fn(),config:vi.fn(),platform:vi.fn(),reconcile:vi.fn(),stripe:{}}));
vi.mock("stripe",()=>({default:vi.fn(function(){return mocks.stripe;})}));
vi.mock("../src/lib/supabase",()=>({storageAdmin:()=>({rpc:mocks.rpc})}));
vi.mock("../src/lib/creator-stripe",()=>({creatorSandboxConfig:mocks.config,assertCreatorPlatform:mocks.platform}));
vi.mock("../src/lib/creator-reconciliation",()=>({reconcileCreatorOrder:mocks.reconcile}));
const order={id:"96d1a429-7773-4170-982c-c7d93004ee79",buyerId:"1dce924d-1611-4270-a705-07ef394df432",sellerId:"a8118598-c149-4d85-acee-799ca34d598e",
  profileId:"0286ea68-2694-45c8-bef2-2b968457e98c",versionId:"4e791fc7-3603-41ef-8e56-d8c4f1fb9877",platformId:"acct_Platform",accountId:"acct_Creator",
  createdAt:"2026-11-19T01:00:00Z",checkoutId:"cs_test_Order",checkoutExpiresAt:"2026-11-20T00:59:00Z",paymentId:null,chargeId:null,
  state:"pending",paidAt:null,accessUntil:null,holds:[],title:"Sandbox guide",description:"Fixture",amount:500,currency:"gbp",bytes:100,sha256:"a".repeat(64)};
beforeEach(()=>{
  vi.resetAllMocks();mocks.config.mockReturnValue({key:["rk","test","fixture"].join("_"),platformId:order.platformId});
  mocks.rpc.mockResolvedValue({error:null,data:order});mocks.reconcile.mockResolvedValue(order);
});
it("checks the canonical buyer/id/platform projection before a pinned-provider reconciliation",async()=>{
  expect(await refreshCreatorPurchase(order.id,order.buyerId)).toEqual(order);
  expect(mocks.platform).toHaveBeenCalledWith(mocks.stripe,order.platformId);expect(mocks.reconcile).toHaveBeenCalledWith(mocks.stripe,order);
});
it("denies wrong buyers, switched platforms, malformed, unbound and missing orders before provider access",async()=>{
  await expect(refreshCreatorPurchase(order.id,order.sellerId)).rejects.toThrow();
  for(const value of [null,{...order,id:order.versionId},{...order,platformId:"acct_Other"},{...order,amount:"500"},{...order,checkoutId:null,checkoutExpiresAt:null}]) {
    mocks.rpc.mockResolvedValue({error:null,data:value});await expect(refreshCreatorPurchase(order.id,order.buyerId)).rejects.toThrow();
  }
  expect(mocks.platform).not.toHaveBeenCalled();expect(mocks.reconcile).not.toHaveBeenCalled();
});
it("fails closed when configuration, database, platform identity or current-state reconciliation fails",async()=>{
  mocks.config.mockReturnValueOnce(null);await expect(refreshCreatorPurchase(order.id,order.buyerId)).rejects.toThrow();expect(mocks.rpc).not.toHaveBeenCalled();
  mocks.rpc.mockResolvedValueOnce({error:new Error("database offline"),data:null});await expect(refreshCreatorPurchase(order.id,order.buyerId)).rejects.toThrow();
  mocks.platform.mockRejectedValueOnce(new Error("wrong platform"));await expect(refreshCreatorPurchase(order.id,order.buyerId)).rejects.toThrow();expect(mocks.reconcile).not.toHaveBeenCalled();
  mocks.reconcile.mockRejectedValueOnce(new Error("provider unavailable"));await expect(refreshCreatorPurchase(order.id,order.buyerId)).rejects.toThrow();
});
