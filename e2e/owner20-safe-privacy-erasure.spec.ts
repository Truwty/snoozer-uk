import {createHmac,randomUUID} from "node:crypto";
import {execFileSync} from "node:child_process";
import {createClient} from "@supabase/supabase-js";
import {expect,test} from "@playwright/test";

const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secret=process.env.SUPABASE_SERVICE_ROLE_KEY;
test.skip(process.env.SNOOZER_TEST_LOCAL_SUPABASE!=="1","Erasure tests must use disposable Supabase");

function totp(secret32:string,offset=0){
 const alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
 let buffer=0,bits=0;const bytes:number[]=[];
 for(const ch of secret32.toUpperCase().replace(/=+$/,"")){
  buffer=(buffer<<5)|alphabet.indexOf(ch);bits+=5;
  if(bits>=8){bits-=8;bytes.push((buffer>>>bits)&255);}
 }
 const step=Buffer.alloc(8);step.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)+offset));
 const mac=createHmac("sha1",Buffer.from(bytes)).update(step).digest();
 return String((mac.readUInt32BE(mac[19]&15)&0x7fffffff)%1000000).padStart(6,"0");
}

test("only Owner AAL2 may erase dependency-free disposable Auth users, preserving request/audit",async()=>{
 test.setTimeout(100000);
 if(!url?.startsWith("http://127.0.0.1:54321")||!key||!secret)
  throw new Error("Disposable Supabase is required; production is forbidden");
 const admin=createClient(url,secret,{auth:{persistSession:false}});
 const ownerEmail="erasure-owner-"+randomUUID().slice(0,8)+"@example.com";
 const memberEmail="erasure-member-"+randomUUID().slice(0,8)+"@example.com";
 const blockedEmail="erasure-blocked-"+randomUUID().slice(0,8)+"@example.com";
 const password="P!"+randomUUID()+"S6";
 const ownerUser=await admin.auth.admin.createUser({email:ownerEmail,password,email_confirm:true});
 const memberUser=await admin.auth.admin.createUser({email:memberEmail,password,email_confirm:true});
 const blockedUser=await admin.auth.admin.createUser({email:blockedEmail,password,email_confirm:true});
 expect(ownerUser.error).toBeNull();
 expect(memberUser.error).toBeNull();
 expect(blockedUser.error).toBeNull();
 const ownerId=ownerUser.data.user!.id;
 const memberId=memberUser.data.user!.id;
 const blockedId=blockedUser.data.user!.id;
 const sql=(query:string)=>execFileSync("docker",[
  "exec","supabase_db_snoozer-uk","psql","-U","postgres","-d","postgres",
  "-v","ON_ERROR_STOP=1","-c",query
 ],{encoding:"utf8"});
 sql("insert into snoozer.platform_owners(owner_id) values('"+ownerId+"')");
 const owner=createClient(url,key,{auth:{persistSession:false}});
 const member=createClient(url,key,{auth:{persistSession:false}});
 const blocked=createClient(url,key,{auth:{persistSession:false}});
 let memberErased=false;
 try{
  expect((await owner.auth.signInWithPassword({email:ownerEmail,password})).error).toBeNull();
  expect((await member.auth.signInWithPassword({email:memberEmail,password})).error).toBeNull();
  expect((await blocked.auth.signInWithPassword({email:blockedEmail,password})).error).toBeNull();
  const ticket=await member.rpc("request_my_privacy_action",{p_kind:"deletion"});
  const blockedTicket=await blocked.rpc("request_my_privacy_action",{p_kind:"deletion"});
  expect(ticket.error).toBeNull();
  expect(blockedTicket.error).toBeNull();
  expect((await member.rpc("owner_prepare_privacy_erasure",{p_request:ticket.data})).error).not.toBeNull();
  expect((await owner.rpc("owner_prepare_privacy_erasure",{p_request:ticket.data})).error?.code).toBe("42501");

  const enrolled=await owner.auth.mfa.enroll({factorType:"totp",friendlyName:"Disposable erasure acceptance"});
  expect(enrolled.error).toBeNull();
  const factorId=enrolled.data!.id,totpSecret=enrolled.data!.totp!.secret;
  let verified=false;
  for(const shift of [0,-1,1]){
   const challenge=await owner.auth.mfa.challenge({factorId});
   expect(challenge.error).toBeNull();
   const verifiedChallenge=await owner.auth.mfa.verify({
    factorId,challengeId:challenge.data!.id,code:totp(totpSecret,shift)});
   if(!verifiedChallenge.error){verified=true;break;}
  }
  expect(verified).toBe(true);
  const candidate=await owner.rpc("owner_privacy_preflight",{p_request:ticket.data});
  expect(candidate.error).toBeNull();
  expect(candidate.data).toMatchObject({
   request_id:ticket.data,user_id:memberId,kind:"deletion",
   status:"open",verified_email:true,
   has_stripe_customer:false,live_checkout_records:0,
   has_subscription_references:false,has_avatar_media:false,
   gallery_metadata_count:0
  });
  // Every signup has an automatically-created profile: that alone must
  // never block an otherwise clean, verified disposable Auth user.
  expect(candidate.data.profile_count).toBeGreaterThanOrEqual(1);
  const dependencies=await owner.rpc("owner_privacy_dependency_inventory",{
   p_request:ticket.data
  });
  expect(dependencies.error).toBeNull();
  expect(dependencies.data.dependencies.filter(
   (d:{on_delete:string;rows:number})=>d.rows>0&&
    (d.on_delete==="no_action"||d.on_delete==="restrict")
  )).toEqual([]);
  const incomplete=await owner.rpc("owner_prepare_privacy_erasure",{p_request:ticket.data});
  expect(incomplete.error?.code).toBe("23514");
  const evidence=(request:string)=>({
   p_request:request,p_identity:true,p_app:false,p_media:false,p_billing:true,
   p_processors:true,p_retention:true,p_subscriptions:true,p_erasure:false,
   p_notice:false,p_reference:"Disposable local privacy processor and retention review verified."
  });
  expect((await owner.rpc("owner_record_privacy_evidence",evidence(ticket.data))).error).toBeNull();
  expect((await owner.rpc("owner_record_privacy_evidence",evidence(blockedTicket.data))).error).toBeNull();
  sql("insert into snoozer.account_restrictions(user_id,kind,reason,created_by) "+
   "values('"+blockedId+"','ban','Deliberate deletion blocker for acceptance','"+ownerId+"')");
  const denied=await owner.rpc("owner_prepare_privacy_erasure",{p_request:blockedTicket.data});
  expect(denied.error?.code).toBe("23514");
  const prepared=await owner.rpc("owner_prepare_privacy_erasure",{p_request:ticket.data});
  expect(prepared.error).toBeNull();
  expect(prepared.data.operation_id).toMatch(/^[0-9a-f-]{36}$/);
  expect(prepared.data.user_id).toBe(memberId);
  expect((await member.rpc("service_finish_privacy_erasure",{
   p_operation:prepared.data.operation_id,p_success:true
  })).error).not.toBeNull();
  const early=await admin.rpc("service_finish_privacy_erasure",{
   p_operation:prepared.data.operation_id,p_success:true
  });
  expect(early.error?.code).toBe("23514");
  const deleted=await admin.auth.admin.deleteUser(memberId);
  expect(deleted.error).toBeNull();
  memberErased=true;
  const auditAfter=await owner.rpc("owner_audit_page",{p_before:null,p_limit:100});
  expect(auditAfter.error).toBeNull();
  expect(auditAfter.data).toEqual(expect.arrayContaining([
   expect.objectContaining({actor_id:null,target_id:memberId,action:"privacy.request"})
  ]));
  const final=await admin.rpc("service_finish_privacy_erasure",{
   p_operation:prepared.data.operation_id,p_success:true
  });
  expect(final.error).toBeNull();expect(final.data).toBe(true);
  const missingNotice=await owner.rpc("owner_review_privacy_request",{
   p_request:ticket.data,p_status:"completed",
   p_response:"Do not close request before real notification"
  });
  expect(missingNotice.error?.code).toBe("23514");
  expect((await admin.rpc("service_mark_privacy_erasure_notice",{
   p_operation:prepared.data.operation_id
  })).data).toBe(true);
  const observed=await owner.rpc("owner_privacy_evidence",{p_request:ticket.data});
  expect(observed.error).toBeNull();
  expect(observed.data).toMatchObject({
   app_data_processed:true,private_media_processed:true,
   account_erasure_verified:true,secure_notice_sent:true
  });
  const queue=await owner.rpc("owner_privacy_requests",{p_limit:100});
  expect(queue.error).toBeNull();
  expect(queue.data).toEqual(expect.arrayContaining([
   expect.objectContaining({id:ticket.data,user_id:memberId,email:null})
  ]));
  const finished=await owner.rpc("owner_review_privacy_request",{
   p_request:ticket.data,p_status:"completed",
   p_response:"Disposable erasure verified in local Supabase"
  });
  expect(finished.error).toBeNull();expect(finished.data).toBe(true);
 }finally{
  sql("delete from snoozer.admin_audit_events where actor_id='"+ownerId+"';"+
   "delete from snoozer.privacy_erasure_jobs where actor_id='"+ownerId+"';"+
   "delete from snoozer.privacy_fulfilment_evidence where checked_by='"+ownerId+"';"+
   "delete from snoozer.privacy_requests where user_id in ('"+memberId+"','"+blockedId+"');"+
   "delete from snoozer.account_restrictions where user_id='"+blockedId+"';"+
   "delete from snoozer.platform_owners where owner_id='"+ownerId+"';");
  if(!memberErased)await admin.auth.admin.deleteUser(memberId);
  await admin.auth.admin.deleteUser(blockedId);
  await admin.auth.admin.deleteUser(ownerId);
 }
});
