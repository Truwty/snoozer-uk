import { beforeEach,expect,it,vi } from "vitest";
import { recoverCreatorReceipts } from "../src/lib/creator-recovery";
const token="creator-retry-fixture-"+"x".repeat(32);
const receipt={id:"evt_Creator",accountId:"acct_Creator",type:"checkout.session.completed",objectId:"cs_test_Order",occurredAt:"2026-11-19T01:00:00Z"};
const load=vi.fn(),claim=vi.fn(),process=vi.fn();
const request=(value:unknown={},authorization="Bearer "+token)=>new Request("https://example.com/api/v1/commerce/stripe/recover",{method:"POST",body:JSON.stringify(value),headers:{authorization}});
const recover=(incoming=request(),secret:string|undefined=token)=>recoverCreatorReceipts(incoming,secret,load,claim,process);
beforeEach(()=>{vi.resetAllMocks();load.mockResolvedValue([receipt]);claim.mockResolvedValue(true);process.mockResolvedValue(undefined);});
it("requires the dedicated operator bearer before reading any receipt",async()=>{
  expect((await recoverCreatorReceipts(request(),undefined,load,claim,process)).status).toBe(503);
  expect((await recover(request({},"Bearer premium-billing-token-"+"y".repeat(32)))).status).toBe(401);
  expect(load).not.toHaveBeenCalled();expect(process).not.toHaveBeenCalled();
});
it("bounds the request and batch before database or provider work",async()=>{
  for(const value of [{id:"invalid"},{limit:0},{limit:11},{limit:"1"},{payment_status:"paid"}])expect((await recover(request(value))).status).toBe(400);
  expect((await recover(new Request("https://example.com",{method:"POST",body:"x".repeat(1025),headers:{authorization:"Bearer "+token}}))).status).toBe(413);
  expect(load).not.toHaveBeenCalled();
});
it("claims each stored receipt and waits for canonical persistence before reporting success",async()=>{
  const response=await recover();expect(response.status).toBe(200);expect(await response.json()).toEqual({attempted:1,processed:1,failed:0});
  expect(load).toHaveBeenCalledWith({limit:1});expect(claim).toHaveBeenCalledWith(receipt.id);expect(process).toHaveBeenCalledWith(receipt);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
});
it("continues a bounded batch after failure and reports a retryable failure without payloads",async()=>{
  load.mockResolvedValue([receipt,{...receipt,id:"evt_Second"}]);process.mockRejectedValueOnce(new Error("private provider error"));
  const response=await recover(request({limit:2}));expect(response.status).toBe(503);expect(await response.json()).toEqual({attempted:2,processed:1,failed:1});
  expect(process).toHaveBeenCalledTimes(2);
});
it("respects backoff claims and permits explicit replay only of the selected stored event",async()=>{
  claim.mockResolvedValue(false);expect(await (await recover()).json()).toEqual({attempted:0,processed:0,failed:0});expect(process).not.toHaveBeenCalled();
  expect((await recover(request({id:"evt_Other"}))).status).toBe(404);
  load.mockResolvedValue([]);expect((await recover(request({id:receipt.id}))).status).toBe(404);
});
it("fails closed on malformed, duplicate, oversized or unavailable queue projections",async()=>{
  for(const values of [[{...receipt,id:"invalid"}],[{...receipt,accountId:"not-an-account"}],[receipt,receipt]]) {
    load.mockResolvedValue(values);expect((await recover(request({limit:2}))).status).toBe(503);
  }
  load.mockRejectedValue(new Error("database unavailable"));expect((await recover()).status).toBe(503);expect(process).not.toHaveBeenCalled();
});
