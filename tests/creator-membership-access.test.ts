import {beforeEach,expect,it,vi} from "vitest";
import {GET} from "../src/app/studio/memberships/access/[id]/route";
const mocks=vi.hoisted(()=>({getUser:vi.fn(),rpc:vi.fn(),verify:vi.fn()}));
vi.mock("@/lib/supabase",()=>({sessionClient:async()=>({auth:{getUser:mocks.getUser},rpc:mocks.rpc})}));
vi.mock("@/lib/creator-membership-server",()=>({verifyMyMembership:mocks.verify}));
const id="00000000-0000-4000-8000-000000000001",buyer="00000000-0000-4000-8000-000000000002";
const access=(value=id)=>GET(new Request("https://example.com/studio/memberships/access/"+value),{params:Promise.resolve({id:value})});
const record={id,buyerId:buyer,title:"Supporter",benefits:"Monthly updates",periodEnd:"2026-12-21T00:00:00Z",customerId:"private"};
beforeEach(()=>{vi.resetAllMocks();mocks.getUser.mockResolvedValue({data:{user:{id:buyer,email_confirmed_at:"verified"}},error:null});mocks.rpc.mockResolvedValue({data:true,error:null});mocks.verify.mockResolvedValue({record,active:true});});
it("returns a private sandbox membership record only after fresh buyer verification",async()=>{
 const response=await access();expect(response.status).toBe(200);expect(response.headers.get("cache-control")).toBe("private, no-store");
 const body=await response.json();expect(body).toMatchObject({type:"sandbox_membership",id,title:"Supporter"});expect(body.customerId).toBeUndefined();
});
it("rejects invalid, foreign, unverified and inactive access",async()=>{
 expect((await access("invalid")).status).toBe(404);expect(mocks.getUser).not.toHaveBeenCalled();
 mocks.rpc.mockResolvedValueOnce({data:false,error:null});expect((await access()).status).toBe(404);expect(mocks.verify).not.toHaveBeenCalled();
 mocks.getUser.mockResolvedValueOnce({data:{user:null},error:null});expect((await access()).status).toBe(404);
 mocks.verify.mockResolvedValueOnce({record,active:false});expect((await access()).status).toBe(404);
 mocks.verify.mockRejectedValueOnce(new Error("offline"));expect((await access()).status).toBe(503);
});
