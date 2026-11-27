import {randomUUID} from "node:crypto";
import {createClient} from "@supabase/supabase-js";
import {expect,test} from "@playwright/test";

const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const service=process.env.SUPABASE_SERVICE_ROLE_KEY;
test.skip(process.env.SNOOZER_TEST_LOCAL_SUPABASE!=="1","Disposable local Supabase only");

test("private media export refuses anonymous and other-account files",async({page,request,browser})=>{
 test.setTimeout(90000);
 if(!url?.startsWith("http://127.0.0.1:54321")||!key||!service)
  throw new Error("Disposable local Supabase required");
 const admin=createClient(url,service,{auth:{persistSession:false}});
 const mk=async(prefix:string)=>{
  const name=prefix+randomUUID().slice(0,8);
  const email=name+"@example.com",password="P!"+randomUUID()+"Z9";
  const result=await admin.auth.admin.createUser({email,password,email_confirm:true});
  expect(result.error).toBeNull();
  const client=createClient(url,key,{auth:{persistSession:false}});
  expect((await client.auth.signInWithPassword({email,password})).error).toBeNull();
  expect((await client.rpc("claim_profile",{p_name:name})).error).toBeNull();
  const {data,error}=await client.rpc("my_extended_account_archive");
  expect(error).toBeNull();
  return {name,email,password,client,id:result.data.user!.id,scope:data.profiles[0].media_scope as string};
 };
 const a=await mk("meda"),b=await mk("medb");
 const fileName=randomUUID()+".webp";
 const otherName=randomUUID()+".webp";
 const file=a.scope+"/"+fileName,other=b.scope+"/"+otherName;
 const bucket=admin.storage.from("gallery-images");
 try{
  expect((await bucket.upload(file,Buffer.from("test file content"),{contentType:"image/webp"})).error).toBeNull();
  expect((await bucket.upload(other,Buffer.from("other user private content"),{contentType:"image/webp"})).error).toBeNull();
  const anonymous=await request.get("/api/v1/account/media-export");
  expect(anonymous.status()).toBe(401);
  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill(a.email);
  await page.getByLabel("Password",{exact:true}).fill(a.password);
  await page.getByRole("button",{name:"Log in",exact:true}).click();
  await expect(page).toHaveURL("http://localhost:3000/studio");
  const list=await page.request.get("/api/v1/account/media-export");
  expect(list.status()).toBe(200);
  expect(list.headers()["cache-control"]).toContain("no-store");
  const manifest=await list.json();
  expect(manifest.files).toEqual(expect.arrayContaining([expect.objectContaining({bucket:"gallery-images",name:file})]));
  expect(manifest.files.some((f:{name:string})=>f.name===other)).toBe(false);
  const own=await page.request.get("/api/v1/account/media-export/file?bucket=gallery-images&name="+encodeURIComponent(file));
  expect(own.status()).toBe(200);
  expect(await own.body()).toEqual(Buffer.from("test file content"));
  const denied=await page.request.get("/api/v1/account/media-export/file?bucket=gallery-images&name="+encodeURIComponent(other));
  expect(denied.status()).toBe(404);
  const stranger=await browser.newContext();
  try{
   expect((await stranger.request.get("/api/v1/account/media-export/file?bucket=gallery-images&name="+encodeURIComponent(file))).status()).toBe(401);
  }finally{await stranger.close();}
 }finally{
  await bucket.remove([file,other]);
  await admin.auth.admin.deleteUser(a.id);
  await admin.auth.admin.deleteUser(b.id);
 }
});
