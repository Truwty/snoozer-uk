import {createHash} from "node:crypto";
import {beforeEach,expect,it,vi} from "vitest";
const mocks=vi.hoisted(()=>({getUser:vi.fn(),rpc:vi.fn(),download:vi.fn(),refresh:vi.fn()}));
vi.mock("@/lib/supabase",()=>({
 sessionClient:async()=>({auth:{getUser:mocks.getUser},rpc:mocks.rpc}),
 storageAdmin:()=>({storage:{from:()=>({download:mocks.download})}}),
}));
vi.mock("@/lib/creator-purchases-server",()=>({refreshCreatorPurchase:mocks.refresh}));
import {GET} from "../src/app/studio/purchases/file/[id]/route";
const orderId="00000000-0000-4000-8000-000000000001";
const productId="00000000-0000-4000-8000-000000000002";
const versionId="00000000-0000-4000-8000-000000000003";
const fileId="00000000-0000-4000-8000-000000000004";
const owner="00000000-0000-4000-8000-000000000005";
const buyer="00000000-0000-4000-8000-000000000006";
function file(bytes:Uint8Array) {
 const hash=createHash("sha256").update(bytes).digest("hex");
 mocks.refresh.mockResolvedValue({state:"paid",holds:[],accessUntil:"2099-12-21T00:00:00Z",
  versionId,sha256:hash,bytes:bytes.length});
 mocks.rpc.mockImplementation(async(name:string)=>name==="get_my_creator_order_file"?
  {data:{productId,id:fileId,scope:owner,bytes:bytes.length,state:"ready",orderId,versionId,sha256:hash},error:null}:
  {data:true,error:null});
 mocks.download.mockResolvedValue({data:new Blob([Buffer.from(bytes)],{type:"application/pdf"}),error:null});
}
const open=(id=orderId)=>GET(new Request("https://example.com/studio/purchases/file/"+id),{params:Promise.resolve({id})});
beforeEach(()=>{
 vi.resetAllMocks();
 mocks.getUser.mockResolvedValue({data:{user:{id:buyer,email_confirmed_at:"confirmed"}},error:null});
});
it("streams only a paid buyer-owned, hash-matched and statically allowed PDF",async()=>{
 const bytes=Buffer.from("%PDF-1.7\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n%%EOF\n");
 file(bytes);
 const res=await open();
 expect(res.status).toBe(200);expect(res.headers.get("cache-control")).toBe("private, no-store");
 expect(Buffer.from(await res.arrayBuffer()).equals(bytes)).toBe(true);
 expect(mocks.refresh).toHaveBeenCalledWith(orderId,buyer);
});
it("denies active PDF payloads despite matching the original stored SHA-256",async()=>{
 for(const fragment of ["/OpenAction","/J#61vaScript","/EmbeddedFile","/Encrypt","/ObjStm"]){
  const bytes=Buffer.from("%PDF-1.7\n1 0 obj << "+fragment+" >> endobj\n%%EOF\n");
  file(bytes);
  expect((await open()).status).toBe(503);
 }
});
it("never downloads for foreign buyers, malformed IDs or denied payment proof",async()=>{
 file(Buffer.from("%PDF-1.7\nbenign PDF\n%%EOF\n"));
 expect((await open("invalid")).status).toBe(404);
 mocks.rpc.mockResolvedValueOnce({data:false,error:null});
 expect((await open()).status).toBe(404);
 mocks.refresh.mockResolvedValueOnce({state:"paid",holds:["fraud"],accessUntil:"2099-12-21T00:00:00Z"});
 expect((await open()).status).toBe(404);
});
