import {createClient} from "@supabase/supabase-js";
import {expect,test} from "@playwright/test";

const project=process.env.NEXT_PUBLIC_SUPABASE_URL;
const publicKey=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const adminKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
test.skip(process.env.SNOOZER_TEST_LOCAL_SUPABASE!=="1","Disposable local Supabase only");

test("queue-health summaries are private and contain no message or recipient data",async({request})=>{
 if(!project||!project.startsWith("http://127.0.0.1:54321")||!publicKey||!adminKey)
  throw new Error("Disposable local Supabase required");
 const visitor=createClient(project,publicKey,{auth:{persistSession:false}});
 const admin=createClient(project,adminKey,{auth:{persistSession:false}});
 expect((await visitor.rpc("service_owner_notice_queue_health")).error).not.toBeNull();
 const result=await admin.rpc("service_owner_notice_queue_health");
 expect(result.error).toBeNull();
 expect(result.data).toMatchObject({
  total:expect.any(Number),undelivered:expect.any(Number),
  exhausted:expect.any(Number),overdue:expect.any(Number),leased:expect.any(Number),
 });
 expect(JSON.stringify(result.data)).not.toContain("@");
 expect(Object.keys(result.data).sort()).toEqual(["exhausted","leased","overdue","total","undelivered"]);
 expect((await request.get("/api/internal/owner-notices/health")).status()).toBe(404);
});
