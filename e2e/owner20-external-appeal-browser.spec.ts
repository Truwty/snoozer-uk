import {createHash,randomBytes,randomUUID} from "node:crypto";
import {execFileSync} from "node:child_process";
import {createClient} from "@supabase/supabase-js";
import {expect,test} from "@playwright/test";

const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const service=process.env.SUPABASE_SERVICE_ROLE_KEY;
test.skip(process.env.SNOOZER_TEST_LOCAL_SUPABASE!=="1","Disposable local Supabase only");

function sql(statement:string){
 return execFileSync("docker",[
  "exec","supabase_db_snoozer-uk","psql","-U","postgres","-d","postgres",
  "-v","ON_ERROR_STOP=1","-At","-c",statement,
 ],{encoding:"utf8"});
}
function hash(value:string){return createHash("sha256").update(value).digest("hex");}

test("banned user can submit and cannot replay a signed-out external appeal",async({page,browser})=>{
 test.setTimeout(90000);
 if(!url?.startsWith("http://127.0.0.1:54321")||!key||!service)
  throw new Error("A disposable local Supabase instance is required");
 const admin=createClient(url,service,{auth:{persistSession:false}});
 const publicClient=createClient(url,key,{auth:{persistSession:false}});
 const suffix=randomUUID().slice(0,8);
 const email="appeal-locked-"+suffix+"@example.com";
 const password="P!"+randomUUID()+"Z9";
 const created=await admin.auth.admin.createUser({email,password,email_confirm:true});
 expect(created.error).toBeNull();
 const target=created.data.user!.id;
 const caseId=randomUUID();
 const token=randomBytes(32).toString("hex");
 try{
  // A synthetic actioned case in the disposable stack; never an actual Owner.
  sql("insert into snoozer.moderation_cases(id,target_id,category,status,reason,opened_by) "+
    "values('"+caseId+"','"+target+"','other','actioned','Disposable external appeal acceptance case','"+target+"')");
  const ban=await admin.auth.admin.updateUserById(target,{ban_duration:"24h"});
  expect(ban.error).toBeNull();
  expect((await publicClient.auth.signInWithPassword({email,password})).error).not.toBeNull();

  // This exercise seeds the mail verification challenge without sending real
  // mail to example.com. A real Zoho recipient-controlled test is separate.
  const challenge=await admin.rpc("service_start_external_appeal",{
   p_case:caseId,p_email:email,p_hash:hash(token)
  });
  expect(challenge.error).toBeNull();expect(challenge.data).toBe(true);
  const noSession=await browser.newContext();
  const guest=await noSession.newPage();
  try{
   await guest.goto("/appeal/external?token="+token);
   await expect(guest.getByRole("heading",{name:"Submit verified appeal"})).toBeVisible();
   await guest.getByRole("textbox",{name:"Reasons for review"}).fill(
    "Please review this synthetic account restriction. I request reinstatement."
   );
   await guest.getByRole("button",{name:"Submit appeal"}).click();
   await expect(guest.getByRole("status")).toContainText("submitted for review");
   const count=sql("select count(*) from snoozer.moderation_appeals where case_id='"+caseId+"'");
   expect(count.trim()).toBe("1");

   await guest.goto("/appeal/external?token="+token);
   await guest.getByRole("textbox",{name:"Reasons for review"}).fill(
    "Attempting a second use of the same synthetic verification link."
   );
   await guest.getByRole("button",{name:"Submit appeal"}).click();
   await expect(guest.getByRole("alert")).toContainText("used already");
   expect(sql("select count(*) from snoozer.moderation_appeals where case_id='"+caseId+"'").trim()).toBe("1");
   expect(sql("select count(*) from snoozer.external_appeal_challenges where case_id='"+caseId+"' and consumed_at is not null").trim()).toBe("1");
  }finally{await noSession.close();}
  const unban=await admin.auth.admin.updateUserById(target,{ban_duration:"none"});
  expect(unban.error).toBeNull();
  expect((await publicClient.auth.signInWithPassword({email,password})).error).toBeNull();
 }finally{
  await admin.auth.admin.updateUserById(target,{ban_duration:"none"});
  // Clean up dependent rows before Auth identity deletion.
  sql("delete from snoozer.admin_audit_events where target_id='"+target+"';"+
   "delete from snoozer.moderation_appeals where user_id='"+target+"';"+
   "delete from snoozer.external_appeal_challenges where user_id='"+target+"';"+
   "delete from snoozer.moderation_cases where id='"+caseId+"';");
  await admin.auth.admin.deleteUser(target);
 }
});
