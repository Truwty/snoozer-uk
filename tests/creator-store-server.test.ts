import { beforeEach,expect,it,vi } from "vitest";
import { refreshCreatorStore } from "../src/lib/creator-store-server";
vi.mock("server-only",()=>({}));
const mocks=vi.hoisted(()=>({rpc:vi.fn(),config:vi.fn(),read:vi.fn(),stripe:{}}));
vi.mock("stripe",()=>({default:vi.fn(function(){return mocks.stripe;})}));
vi.mock("../src/lib/supabase",()=>({storageAdmin:()=>({rpc:mocks.rpc})}));
vi.mock("../src/lib/creator-checkout",()=>({creatorCheckoutConfig:mocks.config}));
vi.mock("../src/lib/creator-stripe",()=>({readCreatorSandboxAccount:mocks.read}));
const ownerId="00000000-0000-4000-8000-000000000001",version="00000000-0000-4000-8000-000000000002",lease="00000000-0000-4000-8000-000000000003";
const merchant={id:lease,platformId:"acct_Platform",accountId:"acct_Creator",country:"GB",createdAt:"2026-11-18T00:00:00Z",ready:true,checkedAt:"2026-11-18T00:00:00Z"};
beforeEach(()=>{
  vi.resetAllMocks();mocks.config.mockReturnValue({key:"fixture",platformId:merchant.platformId});mocks.read.mockResolvedValue({ready:true});
  mocks.rpc.mockImplementation(async(name:string)=>({error:null,data:name==="get_creator_store_check_target"?{ownerId,merchant}:name==="claim_creator_sandbox_check"?lease:true}));
});
it("refreshes a stale public fixture through real provider proof and the existing seller lease",async()=>{
  expect(await refreshCreatorStore("test-store",null)).toBe(true);
  expect(mocks.rpc.mock.calls.map(c=>c[0])).toEqual(["get_creator_store_check_target","claim_creator_sandbox_check","complete_creator_sandbox_check"]);
  expect(mocks.read).toHaveBeenCalledWith(mocks.stripe,merchant);
  expect(mocks.rpc).toHaveBeenLastCalledWith("complete_creator_sandbox_check",{p_owner:ownerId,p_account:merchant.accountId,p_lease:lease,p_ready:true});
});
it("uses recent proof without provider work and looks up purchase targets by immutable version",async()=>{
  mocks.rpc.mockResolvedValue({error:null,data:{ownerId,merchant:{...merchant,checkedAt:new Date(Date.now()-1000).toISOString()}}});
  expect(await refreshCreatorStore(null,version)).toBe(true);expect(mocks.rpc).toHaveBeenCalledTimes(1);expect(mocks.read).not.toHaveBeenCalled();
  expect(mocks.rpc).toHaveBeenCalledWith("get_creator_store_check_target",{p_name:null,p_version:version});
});
it("rejects invalid selectors and disabled configuration without privileged lookups",async()=>{
  for(const [name,id] of [[null,null],["test-store",version],["invalid name",null],[null,"invalid"]] as const) expect(await refreshCreatorStore(name,id)).toBe(false);
  mocks.config.mockReturnValue(null);expect(await refreshCreatorStore("test-store",null)).toBe(false);expect(mocks.rpc).not.toHaveBeenCalled();
});
it("does not read Stripe for absent fixtures, mismatched platforms or a busy seller lease",async()=>{
  mocks.rpc.mockResolvedValueOnce({error:null,data:null});expect(await refreshCreatorStore("test-store",null)).toBe(false);
  mocks.rpc.mockResolvedValueOnce({error:null,data:{ownerId,merchant:{...merchant,platformId:"acct_Other"}}});expect(await refreshCreatorStore("test-store",null)).toBe(false);
  mocks.rpc.mockResolvedValueOnce({error:null,data:{ownerId,merchant}}).mockResolvedValueOnce({error:null,data:null});
  expect(await refreshCreatorStore("test-store",null)).toBe(false);expect(mocks.read).not.toHaveBeenCalled();
});
it("pauses readiness on provider failure and never accepts a failed completion",async()=>{
  mocks.read.mockRejectedValueOnce(new Error("offline"));expect(await refreshCreatorStore("test-store",null)).toBe(false);
  expect(mocks.rpc).toHaveBeenLastCalledWith("complete_creator_sandbox_check",expect.objectContaining({p_ready:false}));
  mocks.rpc.mockResolvedValueOnce({error:null,data:{ownerId,merchant}}).mockResolvedValueOnce({error:null,data:lease}).mockResolvedValueOnce({error:null,data:false});
  expect(await refreshCreatorStore("test-store",null)).toBe(false);
});
