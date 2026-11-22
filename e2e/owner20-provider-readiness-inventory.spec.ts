import {randomUUID} from "node:crypto";
import {execFileSync} from "node:child_process";
import {createClient} from "@supabase/supabase-js";
import {expect,test} from "@playwright/test";

const project=process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const adminKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
test.skip(process.env.SNOOZER_TEST_LOCAL_SUPABASE!=="1","Requires disposable local Supabase");

test("Owner sees the exact provider-ban prerequisites and a safe deletion FK inventory",async()=>{
 test.setTimeout(90000);
 if(!project?.startsWith("http://127.0.0.1:54321")||!key||!adminKey)
  throw new Error("Tests must not target production Supabase");
 const admin=createClient(project,adminKey,{auth:{persistSession:false}});
 const password="Safe1!"+randomUUID();
 const email=(name:string)=>"owner20-"+name+"-"+randomUUID().slice(0,8)+"@example.com";
 const ownerCreated=await admin.auth.admin.createUser({email:email("owner"),password,email_confirm:true});
 const memberCreated=await admin.auth.admin.createUser({email:email("member"),password,email_confirm:true});
 expect(ownerCreated.error).toBeNull();
 expect(memberCreated.error).toBeNull();
 const ownerId=ownerCreated.data.user!.id;
 const memberId=memberCreated.data.user!.id;
 const owner=createClient(project,key,{auth:{persistSession:false}});
 const member=createClient(project,key,{auth:{persistSession:false}});
 const anonymous=createClient(project,key,{auth:{persistSession:false}});
 const sql=(query:string)=>execFileSync("docker",[
  "exec","supabase_db_snoozer-uk","psql","-U","postgres","-d","postgres",
  "-v","ON_ERROR_STOP=1","-c",query
 ],{encoding:"utf8"});
 const caseId=randomUUID();
 sql("insert into snoozer.platform_owners(owner_id) values('"+ownerId+"')");
 try{
  expect((await owner.auth.signInWithPassword({email:ownerCreated.data.user!.email!,password})).error).toBeNull();
  expect((await member.auth.signInWithPassword({email:memberCreated.data.user!.email!,password})).error).toBeNull();
  expect((await anonymous.rpc("owner_provider_ban_preflight",{p_user:memberId})).error).not.toBeNull();
  expect((await member.rpc("owner_provider_ban_preflight",{p_user:memberId})).error).not.toBeNull();
  const first=await owner.rpc("owner_provider_ban_preflight",{p_user:memberId});
  expect(first.error).toBeNull();
  expect(first.data).toMatchObject({
   user_exists:true,is_owner:false,internal_ban:false,active_restriction:false,
   auth_banned:false,eligible_cases:[]
  });
  sql("insert into snoozer.moderation_cases(id,target_id,category,status,reason,opened_by) "+
   "values('"+caseId+"','"+memberId+"','other','actioned','Controlled readiness test fixture','"+ownerId+"');"+
   "insert into snoozer.account_restrictions(user_id,kind,reason,created_by) "+
   "values('"+memberId+"','ban','Controlled synthetic ban only','"+ownerId+"');");
  const ready=await owner.rpc("owner_provider_ban_preflight",{p_user:memberId});
  expect(ready.error).toBeNull();
  expect(ready.data.internal_ban).toBe(true);
  expect(ready.data.active_restriction).toBe(true);
  expect(ready.data.eligible_cases).toContainEqual({id:caseId,status:"actioned"});
  expect((await admin.auth.admin.updateUserById(memberId,{ban_duration:"1h"})).error).toBeNull();
  const blocked=await owner.rpc("owner_provider_ban_preflight",{p_user:memberId});
  expect(blocked.error).toBeNull();
  expect(blocked.data.auth_banned).toBe(true);
  expect((await admin.auth.admin.updateUserById(memberId,{ban_duration:"none"})).error).toBeNull();
  const request=await member.rpc("request_my_privacy_action",{p_kind:"export"});
  expect(request.error).toBeNull();
  expect(request.data).toMatch(/^[0-9a-f-]{36}$/);
  expect((await anonymous.rpc("owner_privacy_dependency_inventory",{p_request:request.data})).error).not.toBeNull();
  expect((await member.rpc("owner_privacy_dependency_inventory",{p_request:request.data})).error).not.toBeNull();
  const inventory=await owner.rpc("owner_privacy_dependency_inventory",{p_request:request.data});
  expect(inventory.error).toBeNull();
  expect(inventory.data.direct_fk_matches).toBeGreaterThanOrEqual(2);
  expect(inventory.data.dependencies).toEqual(expect.arrayContaining([
   expect.objectContaining({table:"snoozer.account_restrictions",column:"user_id",rows:1,on_delete:"no_action"}),
   expect.objectContaining({table:"snoozer.moderation_cases",column:"target_id",rows:1,on_delete:"no_action"})
  ]));
  expect(inventory.data.scope).toContain("Read-only");
 }finally{
  await admin.auth.admin.updateUserById(memberId,{ban_duration:"none"});
  sql("delete from snoozer.admin_audit_events where actor_id='"+ownerId+"';"+
   "delete from snoozer.privacy_requests where user_id='"+memberId+"';"+
   "delete from snoozer.account_restrictions where user_id='"+memberId+"';"+
   "delete from snoozer.moderation_cases where target_id='"+memberId+"';"+
   "delete from snoozer.platform_owners where owner_id='"+ownerId+"';");
  await admin.auth.admin.deleteUser(memberId);
  await admin.auth.admin.deleteUser(ownerId);
 }
});
