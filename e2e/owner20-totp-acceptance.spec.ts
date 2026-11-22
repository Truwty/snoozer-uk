import {createHmac,randomUUID} from "node:crypto";
import {execFileSync} from "node:child_process";
import {createClient} from "@supabase/supabase-js";
import {expect,test} from "@playwright/test";

const project=process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const adminKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
test.skip(process.env.SNOOZER_TEST_LOCAL_SUPABASE!=="1","Only disposable local Supabase is allowed");

function decodeBase32(value:string){
 const alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
 let accumulator=0,bits=0;
 const output:number[]=[];
 for(const character of value.toUpperCase().replace(/=+$/,"").replace(/\s+/g,"")){
  const digit=alphabet.indexOf(character);
  if(digit<0)throw new Error("Invalid TOTP secret format");
  accumulator=(accumulator<<5)|digit;
  bits+=5;
  if(bits>=8){
   bits-=8;
   output.push((accumulator>>>bits)&255);
  }
 }
 return Buffer.from(output);
}
function totp(secret:string,offset=0){
 const counter=BigInt(Math.floor(Date.now()/30000)+offset);
 const block=Buffer.alloc(8);
 block.writeBigUInt64BE(counter);
 const digest=createHmac("sha1",decodeBase32(secret)).update(block).digest();
 const position=digest[digest.length-1]&15;
 const value=(digest.readUInt32BE(position)&0x7fffffff)%1000000;
 return String(value).padStart(6,"0");
}

test("real disposable Owner TOTP upgrades AAL1 to AAL2 before privileged writes",async()=>{
 test.setTimeout(90000);
 if(!project||!project.startsWith("http://127.0.0.1:54321")||!key||!adminKey)
  throw new Error("Disposable Supabase credentials required");
 const admin=createClient(project,adminKey,{auth:{persistSession:false}});
 const password="P!"+randomUUID()+"Q9";
 const emails=["totp-owner-","totp-member-"].map(s=>s+randomUUID().slice(0,8)+"@example.com");
 const ownerUser=await admin.auth.admin.createUser({email:emails[0],password,email_confirm:true});
 const memberUser=await admin.auth.admin.createUser({email:emails[1],password,email_confirm:true});
 expect(ownerUser.error).toBeNull();
 expect(memberUser.error).toBeNull();
 const ownerId=ownerUser.data.user!.id,memberId=memberUser.data.user!.id;
 const sql=(statement:string)=>execFileSync("docker",[
  "exec","supabase_db_snoozer-uk","psql","-U","postgres","-d","postgres",
  "-v","ON_ERROR_STOP=1","-c",statement
 ],{encoding:"utf8"});
 sql("insert into snoozer.platform_owners(owner_id) values ('"+ownerId+"')");
 const owner=createClient(project,key,{auth:{persistSession:false}});
 try{
  expect((await owner.auth.signInWithPassword({email:emails[0],password})).error).toBeNull();
  const before=await owner.auth.mfa.getAuthenticatorAssuranceLevel();
  expect(before.error).toBeNull();
  expect(before.data?.currentLevel).toBe("aal1");
  const denied=await owner.rpc("owner_add_note",{p_user:memberId,p_note:"Disposable MFA denial check"});
  expect(denied.error?.code).toBe("42501");
  const enrolled=await owner.auth.mfa.enroll({factorType:"totp",friendlyName:"Snoozer CI fixture"});
  expect(enrolled.error).toBeNull();
  expect(enrolled.data?.totp?.secret).toBeTruthy();
  const factorId=enrolled.data!.id,secret=enrolled.data!.totp!.secret;
  let verified=false;
  for(const shift of [0,-1,1]){
   const challenge=await owner.auth.mfa.challenge({factorId});
   expect(challenge.error).toBeNull();
   const result=await owner.auth.mfa.verify({factorId,challengeId:challenge.data!.id,code:totp(secret,shift)});
   if(!result.error){verified=true;break;}
  }
  expect(verified).toBe(true);
  const assurance=await owner.auth.mfa.getAuthenticatorAssuranceLevel();
  expect(assurance.error).toBeNull();
  expect(assurance.data?.currentLevel).toBe("aal2");
  const accepted=await owner.rpc("owner_add_note",{p_user:memberId,p_note:"Disposable verified AAL2 write"});
  expect(accepted.error).toBeNull();
  expect(accepted.data).toMatch(/^[0-9a-f-]{36}$/);
 }finally{
  sql("delete from snoozer.admin_audit_events where actor_id='"+ownerId+"';"+
   " delete from snoozer.admin_notes where actor_id='"+ownerId+"';"+
   " delete from snoozer.platform_owners where owner_id='"+ownerId+"';");
  await admin.auth.admin.deleteUser(memberId);
  await admin.auth.admin.deleteUser(ownerId);
 }
});
