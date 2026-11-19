import { createHash } from "node:crypto";
import { beforeEach,expect,it,vi } from "vitest";
import { GET } from "../src/app/studio/purchases/file/[id]/route";

const mocks=vi.hoisted(()=>({getUser:vi.fn(),rpc:vi.fn(),refresh:vi.fn(),download:vi.fn(),from:vi.fn()}));
vi.mock("@/lib/supabase",()=>({sessionClient:async()=>({auth:{getUser:mocks.getUser},rpc:mocks.rpc}),storageAdmin:()=>({storage:{from:mocks.from}})}));
vi.mock("@/lib/creator-purchases-server",()=>({refreshCreatorPurchase:mocks.refresh}));
const id="96d1a429-7773-4170-982c-c7d93004ee79",buyer="1dce924d-1611-4270-a705-07ef394df432",versionId="4e791fc7-3603-41ef-8e56-d8c4f1fb9877";
const bytes=Buffer.from("%PDF-1.7\nretained sandbox purchase\n%%EOF\n");
const file={orderId:id,versionId,id:"101ec49d-81c9-44bb-bbba-799b0e656b7b",productId:"eecaf0ac-5075-4893-a961-4884b576e448",
  scope:"74727fb3-eef5-4388-a174-aaf8391395ba",state:"ready",bytes:bytes.length,sha256:createHash("sha256").update(bytes).digest("hex")};
const order={id,versionId,state:"paid",holds:[],accessUntil:new Date(Date.now()+86400000).toISOString(),bytes:bytes.length,sha256:file.sha256};
const download=(value=id)=>GET(new Request("https://example.com/studio/purchases/file/"+value),{params:Promise.resolve({id:value})});
beforeEach(()=>{
  vi.resetAllMocks();mocks.getUser.mockResolvedValue({data:{user:{id:buyer,email_confirmed_at:"2026-11-19T00:00:00Z"}},error:null});
  mocks.rpc.mockImplementation(async(name:string)=>({error:null,data:name==="get_my_creator_order_file"?file:true}));
  mocks.refresh.mockResolvedValue(order);mocks.from.mockReturnValue({download:mocks.download});mocks.download.mockResolvedValue({data:new Blob([bytes]),error:null});
});
it("authenticates the buyer before provider reads and serves only the paid immutable attachment",async()=>{
  const response=await download();expect(response.status).toBe(200);expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes);
  expect(mocks.rpc.mock.calls.map(c=>c[0])).toEqual(["owns_my_creator_sandbox_order","claim_my_creator_order_check","get_my_creator_order_file"]);
  expect(mocks.refresh).toHaveBeenCalledWith(id,buyer);expect(mocks.download).toHaveBeenCalledWith(`${file.scope}/${file.id}.pdf`);
  expect(response.headers.get("cache-control")).toBe("private, no-store");expect(response.headers.get("content-disposition")).toContain("attachment");
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");expect(response.headers.get("content-security-policy")).toContain("sandbox");
});
it("denies malformed, anonymous, unverified and foreign orders before payment or storage access",async()=>{
  expect((await download("invalid")).status).toBe(404);expect(mocks.getUser).not.toHaveBeenCalled();
  for(const user of [null,{id:buyer}]) {mocks.getUser.mockResolvedValue({data:{user},error:null});expect((await download()).status).toBe(404);}
  mocks.getUser.mockResolvedValue({data:{user:{id:buyer,email_confirmed_at:"verified"}},error:null});mocks.rpc.mockResolvedValue({data:false,error:null});
  expect((await download()).status).toBe(404);expect(mocks.refresh).not.toHaveBeenCalled();expect(mocks.download).not.toHaveBeenCalled();
});
it("throttles repeated verification and fails closed on provider or identity errors",async()=>{
  mocks.rpc.mockImplementation(async(name:string)=>({error:null,data:name!=="claim_my_creator_order_check"}));
  const response=await download();expect(response.status).toBe(429);expect(response.headers.get("retry-after")).toBe("10");expect(mocks.refresh).not.toHaveBeenCalled();
  mocks.rpc.mockResolvedValue({error:null,data:true});mocks.refresh.mockRejectedValue(new Error("Stripe unavailable"));expect((await download()).status).toBe(503);
  mocks.getUser.mockResolvedValue({data:{user:null},error:{status:500}});expect((await download()).status).toBe(503);expect(mocks.download).not.toHaveBeenCalled();
});
it("withholds bytes for unpaid, refunded, disputed, fraudulent, expired or newly revoked purchases",async()=>{
  for(const value of [{...order,state:"pending"},{...order,state:"expired"},{...order,holds:["refund"]},{...order,holds:["dispute"]},
    {...order,holds:["fraud"]},{...order,accessUntil:new Date(Date.now()-1000).toISOString()}]) {
    mocks.refresh.mockResolvedValue(value);expect((await download()).status).toBe(404);
  }
  mocks.refresh.mockResolvedValue(order);mocks.rpc.mockImplementation(async(name:string)=>({error:null,data:name==="get_my_creator_order_file"?null:true}));
  expect((await download()).status).toBe(404);expect(mocks.download).not.toHaveBeenCalled();
});
it("rejects mismatched projections, same-size replacements and Storage failures without any file bytes",async()=>{
  for(const data of [{...file,orderId:file.id},{...file,versionId:file.id},{...file,state:"removing"},{...file,sha256:"b".repeat(64)},{...file,bytes:file.bytes+1}]) {
    mocks.rpc.mockImplementation(async(name:string)=>({error:null,data:name==="get_my_creator_order_file"?data:true}));expect((await download()).status).toBe(503);
  }
  mocks.rpc.mockImplementation(async(name:string)=>({error:null,data:name==="get_my_creator_order_file"?file:true}));
  const changed=Buffer.from(bytes);changed[15]^=1;mocks.download.mockResolvedValue({error:null,data:new Blob([changed])});
  const response=await download();expect(response.status).toBe(503);expect(await response.text()).toBe("");
  mocks.download.mockResolvedValue({error:new Error("offline"),data:null});expect((await download()).status).toBe(503);
});
