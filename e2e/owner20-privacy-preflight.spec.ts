import {execFileSync} from "node:child_process";
import {randomUUID} from "node:crypto";
import {createClient} from "@supabase/supabase-js";
import {expect,test} from "@playwright/test";

const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const pub=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const adminKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
test.skip(process.env.SNOOZER_TEST_LOCAL_SUPABASE!=="1","Disposable local Supabase only");

test("privacy preflight is Owner-only and identifies owned first-party data",async()=>{
 if(!url||!url.startsWith("http://127.0.0.1:54321")||!pub||!adminKey)
  throw new Error("Local disposable credentials required");
 const admin=createClient(url,adminKey,{auth:{persistSession:false}});
 const password="P!"+randomUUID()+"Q9";
 const prefix="preflight-"+randomUUID().slice(0,8);
 const ownerUser=await admin.auth.admin.createUser({email:prefix+"-owner@example.com",password,email_confirm:true});
 const targetUser=await admin.auth.admin.createUser({email:prefix+"-target@example.com",password,email_confirm:true});
 expect(ownerUser.error).toBeNull();expect(targetUser.error).toBeNull();
 const ownerId=ownerUser.data.user!.id,targetId=targetUser.data.user!.id;
 const sql=(statement:string)=>execFileSync("docker",[
  "exec","supabase_db_snoozer-uk","psql","-U","postgres","-d","postgres",
  "-v","ON_ERROR_STOP=1","-c",statement
 ],{encoding:"utf8"});
 sql("insert into snoozer.platform_owners(owner_id) values ('"+ownerId+"')");
 const owner=createClient(url,pub,{auth:{persistSession:false}});
 const target=createClient(url,pub,{auth:{persistSession:false}});
 const anon=createClient(url,pub,{auth:{persistSession:false}});
 try{
  expect((await owner.auth.signInWithPassword({email:prefix+"-owner@example.com",password})).error).toBeNull();
  expect((await target.auth.signInWithPassword({email:prefix+"-target@example.com",password})).error).toBeNull();
  const ticket=await target.rpc("request_my_privacy_action",{p_kind:"export"});
  expect(ticket.error).toBeNull();
  expect(ticket.data).toMatch(/^[0-9a-f-]{36}$/);
  expect((await anon.rpc("owner_privacy_preflight",{p_request:ticket.data})).error).not.toBeNull();
  expect((await target.rpc("owner_privacy_preflight",{p_request:ticket.data})).error).not.toBeNull();
  const first=await owner.rpc("owner_privacy_preflight",{p_request:ticket.data});
  expect(first.error).toBeNull();
  expect(first.data).toMatchObject({user_id:targetId,kind:"export",verified_email:true,
   profile_count:0,has_stripe_customer:false,live_checkout_records:0});
  expect((await target.rpc("claim_profile",{p_name:prefix})).error).toBeNull();
  const populated=await owner.rpc("owner_privacy_preflight",{p_request:ticket.data});
  expect(populated.error).toBeNull();
  expect(populated.data.profile_count).toBe(1);
  expect((await owner.rpc("owner_privacy_preflight",{p_request:randomUUID()})).data).toBeNull();
 }finally{
  sql("delete from snoozer.privacy_requests where user_id='"+targetId+"';"+
   " delete from snoozer.admin_audit_events where actor_id='"+targetId+"';"+
   " delete from snoozer.platform_owners where owner_id='"+ownerId+"';");
  await admin.auth.admin.deleteUser(targetId);
  await admin.auth.admin.deleteUser(ownerId);
 }
});
