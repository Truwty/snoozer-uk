import {createHmac,randomUUID} from "node:crypto";
import {execFileSync} from "node:child_process";
import {createClient} from "@supabase/supabase-js";
import {expect,test} from "@playwright/test";

const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secret=process.env.SUPABASE_SERVICE_ROLE_KEY;
test.skip(process.env.SNOOZER_TEST_LOCAL_SUPABASE!=="1","Disposable local Supabase only");

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
test("privacy requests cannot close without AAL2 evidence, including erasure proof",async()=>{
 test.setTimeout(90000);
 if(!url?.startsWith("http://127.0.0.1:54321")||!key||!secret)
  throw new Error("Local Supabase credentials are mandatory");
 const admin=createClient(url,secret,{auth:{persistSession:false}});
 const email="privacy-evidence-"+randomUUID().slice(0,8)+"@example.com";
 const ownerEmail="privacy-owner-"+randomUUID().slice(0,8)+"@example.com";
 const password="P!"+randomUUID()+"Q7";
 const ownerUser=await admin.auth.admin.createUser({email:ownerEmail,password,email_confirm:true});
 const memberUser=await admin.auth.admin.createUser({email,password,email_confirm:true});
 expect(ownerUser.error).toBeNull();expect(memberUser.error).toBeNull();
 const ownerId=ownerUser.data.user!.id,memberId=memberUser.data.user!.id;
 const sql=(query:string)=>execFileSync("docker",[
  "exec","supabase_db_snoozer-uk","psql","-U","postgres","-d","postgres",
  "-v","ON_ERROR_STOP=1","-c",query
 ],{encoding:"utf8"});
 sql("insert into snoozer.platform_owners(owner_id) values ('"+ownerId+"')");
 const owner=createClient(url,key,{auth:{persistSession:false}});
 const member=createClient(url,key,{auth:{persistSession:false}});
 const evidence=(requestId:string,values:{full:boolean;erased:boolean})=>({
  p_request:requestId,p_identity:true,p_app:true,p_media:true,
  p_billing:values.full,p_processors:values.full,p_retention:true,
  p_subscriptions:true,p_erasure:values.erased,p_notice:true,
  p_reference:"Disposable acceptance: local test artefacts and verification evidence only."
 });
 try{
  expect((await member.auth.signInWithPassword({email,password})).error).toBeNull();
  expect((await owner.auth.signInWithPassword({email:ownerEmail,password})).error).toBeNull();
  const exportTicket=await member.rpc("request_my_privacy_action",{p_kind:"export"});
  expect(exportTicket.error).toBeNull();
  const deletionTicket=await member.rpc("request_my_privacy_action",{p_kind:"deletion"});
  expect(deletionTicket.error).toBeNull();
  expect((await member.rpc("owner_privacy_evidence",{p_request:exportTicket.data})).error).not.toBeNull();
  expect((await member.rpc("owner_record_privacy_evidence",evidence(exportTicket.data,{full:true,erased:true}))).error).not.toBeNull();
  expect((await owner.rpc("owner_record_privacy_evidence",evidence(exportTicket.data,{full:true,erased:true}))).error?.code).toBe("42501");
  expect((await owner.rpc("owner_review_privacy_request",{p_request:exportTicket.data,p_status:"completed",p_response:"Not actually completed"})).error?.code).toBe("42501");
  const enrolled=await owner.auth.mfa.enroll({factorType:"totp",friendlyName:"Snoozer privacy CI"});
  expect(enrolled.error).toBeNull();
  const factorId=enrolled.data!.id,totpSecret=enrolled.data!.totp!.secret;
  let verified=false;
  for(const shift of [0,-1,1]){
   const challenge=await owner.auth.mfa.challenge({factorId});
   expect(challenge.error).toBeNull();
   const result=await owner.auth.mfa.verify({factorId,challengeId:challenge.data!.id,code:totp(totpSecret,shift)});
   if(!result.error){verified=true;break;}
  }
  expect(verified).toBe(true);
  expect((await owner.auth.mfa.getAuthenticatorAssuranceLevel()).data?.currentLevel).toBe("aal2");
  const missing=await owner.rpc("owner_review_privacy_request",{
   p_request:exportTicket.data,p_status:"completed",p_response:"Should not pass without fulfilment proof"
  });
  expect(missing.error?.code).toBe("23514");
  expect((await owner.rpc("owner_record_privacy_evidence",evidence(exportTicket.data,{full:false,erased:false}))).error).toBeNull();
  expect((await owner.rpc("owner_review_privacy_request",{
   p_request:exportTicket.data,p_status:"completed",p_response:"Incomplete processor verification"
  })).error?.code).toBe("23514");
  expect((await owner.rpc("owner_record_privacy_evidence",evidence(exportTicket.data,{full:true,erased:false}))).error).toBeNull();
  const recorded=await owner.rpc("owner_privacy_evidence",{p_request:exportTicket.data});
  expect(recorded.error).toBeNull();
  expect(recorded.data).toMatchObject({processors_processed:true,account_erasure_verified:false});
  expect((await owner.rpc("owner_review_privacy_request",{
   p_request:exportTicket.data,p_status:"completed",p_response:"Test export proof accepted"
  })).data).toBe(true);
  const pendingDeletion={
   ...evidence(deletionTicket.data,{full:true,erased:false}),p_notice:false
  };
  expect((await owner.rpc("owner_record_privacy_evidence",pendingDeletion)).error).toBeNull();
  expect((await owner.rpc("owner_review_privacy_request",{
   p_request:deletionTicket.data,p_status:"completed",p_response:"Deletion cannot be asserted"
  })).error?.code).toBe("23514");
  expect((await owner.rpc("owner_record_privacy_evidence",{
   ...pendingDeletion,p_erasure:true
  })).error?.code).toBe("23514");
  expect((await owner.rpc("owner_record_privacy_evidence",{
   ...pendingDeletion,p_notice:true
  })).error?.code).toBe("23514");
  // Even an attempt to bypass the evidence form via a direct SQL update must
  // not allow the Owner review RPC to close an account that still exists.
  sql("update snoozer.privacy_fulfilment_evidence "+
   "set account_erasure_verified=true,secure_notice_sent=true "+
   "where request_id='"+deletionTicket.data+"'");
  expect((await owner.rpc("owner_review_privacy_request",{
   p_request:deletionTicket.data,p_status:"completed",p_response:"Attempt to mislabel existing Auth user"
  })).error?.code).toBe("23514");
 }finally{
  sql("delete from snoozer.admin_audit_events where actor_id in ('"+ownerId+"','"+memberId+"');"+
      "delete from snoozer.privacy_fulfilment_evidence where checked_by='"+ownerId+"';"+
      "delete from snoozer.privacy_requests where user_id='"+memberId+"';"+
      "delete from snoozer.platform_owners where owner_id='"+ownerId+"';");
  await admin.auth.admin.deleteUser(memberId);
  await admin.auth.admin.deleteUser(ownerId);
 }
});
