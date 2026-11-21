import {beforeEach,expect,it,vi} from "vitest";
import {GET} from "../src/app/studio/purchases/receipt/[id]/route";

const mocks=vi.hoisted(()=>({getUser:vi.fn(),rpc:vi.fn()}));
vi.mock("@/lib/supabase",()=>({sessionClient:async()=>({auth:{getUser:mocks.getUser},rpc:mocks.rpc})}));
const id="96d1a429-7773-4170-982c-c7d93004ee79";
const other="4e791fc7-3603-41ef-8e56-d8c4f1fb9877";
const order={id,versionId:other,title:"Test guide",amount:375,currency:"gbp",state:"paid",held:false,accessActive:true,
  accessUntil:"2026-12-21T00:00:00Z",createdAt:"2026-11-21T00:00:00Z",buyerId:"secret-buyer",paymentId:"secret-payment"};
const receipt=(value=id)=>GET(new Request("https://example.com/studio/purchases/receipt/"+value),{params:Promise.resolve({id:value})});
beforeEach(()=>{
  vi.resetAllMocks();
  mocks.getUser.mockResolvedValue({data:{user:{email_confirmed_at:"verified"}},error:null});
  mocks.rpc.mockResolvedValue({data:[order],error:null});
});
it("downloads only a private paid sandbox record at its reserved price",async()=>{
  const response=await receipt();expect(response.status).toBe(200);
  const body=await response.text();expect(body).toContain("GBP 3.75");expect(body).toContain(id);
  expect(body).toContain("NOT A TAX INVOICE");expect(body).not.toContain("secret-buyer");expect(body).not.toContain("secret-payment");
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("content-disposition")).toContain("attachment");
  expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("list_my_creator_sandbox_orders");
});
it("denies invalid IDs, foreign orders, anonymous and unverified sessions",async()=>{
  expect((await receipt("invalid")).status).toBe(404);expect(mocks.getUser).not.toHaveBeenCalled();
  expect((await receipt(other)).status).toBe(404);mocks.rpc.mockClear();
  for(const user of [null,{}]) {
    mocks.getUser.mockResolvedValue({data:{user},error:null});expect((await receipt()).status).toBe(404);
  }
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("denies unpaid attempts and reports risk holds without claiming current access",async()=>{
  for(const state of ["pending","expired"]) {
    mocks.rpc.mockResolvedValue({data:[{...order,state}],error:null});expect((await receipt()).status).toBe(404);
  }
  mocks.rpc.mockResolvedValue({data:[{...order,held:true,accessActive:false}],error:null});
  const response=await receipt();expect(response.status).toBe(200);expect(await response.text()).toContain("delivery paused for risk review");
});
it("fails closed on malformed data, unavailable RPC or authentication service",async()=>{
  mocks.rpc.mockResolvedValue({data:[{...order,amount:-1}],error:null});expect((await receipt()).status).toBe(503);
  mocks.rpc.mockResolvedValue({data:null,error:{message:"offline"}});expect((await receipt()).status).toBe(503);
  mocks.getUser.mockResolvedValue({data:{user:null},error:{status:500}});expect((await receipt()).status).toBe(503);
});

it("shows original price, savings, first verification and recorded hold categories without refund settlement claims",async()=>{
  mocks.rpc.mockResolvedValue({data:[{...order,originalAmount:500,paidAt:"2026-11-21T00:01:00Z",held:true,holds:["refund","fraud"],accessActive:false}],error:null});
  const response=await receipt();expect(response.status).toBe(200);
  const body=await response.text();expect(body).toContain("Original frozen list price: GBP 5.00");expect(body).toContain("Discount: GBP 1.25");
  expect(body).toContain("2026-11-21T00:01:00.000Z");expect(body).toContain("Refund-related hold; Payment risk review hold");
  expect(body).toContain("does not establish a net refund amount");
  for(const extra of [{originalAmount:100},{held:false,holds:["refund"]},{held:true,holds:["refund","refund"]}]) {
    mocks.rpc.mockResolvedValue({data:[{...order,...extra}],error:null});expect((await receipt()).status).toBe(503);
  }
});
