import {randomUUID} from "node:crypto";
import {createClient} from "@supabase/supabase-js";
import {expect,test} from "@playwright/test";

const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const adminKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
test.skip(process.env.SNOOZER_TEST_LOCAL_SUPABASE!=="1","Disposable local Supabase only");

test("app archive is verified, private, owner-scoped and never cached",async({page,request,browser})=>{
 test.setTimeout(60000);
 if(!url||!key||!adminKey||!url.startsWith("http://127.0.0.1:54321"))
  throw new Error("Disposable local Supabase required");
 const admin=createClient(url,adminKey,{auth:{persistSession:false}});
 const name="archive-"+randomUUID().slice(0,8);
 const email=name+"@example.com";
 const password="P!"+randomUUID()+"Q9";
 const account=await admin.auth.admin.createUser({email,password,email_confirm:true});
 expect(account.error).toBeNull();
 try{
  const visitor=await request.get("/api/v1/account/data-archive");
  expect(visitor.status()).toBe(401);
  const owner=createClient(url,key,{auth:{persistSession:false}});
  expect((await owner.auth.signInWithPassword({email,password})).error).toBeNull();
  expect((await owner.rpc("claim_profile",{p_name:name})).error).toBeNull();
  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password",{exact:true}).fill(password);
  await page.getByRole("button",{name:"Sign in",exact:true}).click();
  await expect(page).toHaveURL(/\\/studio(?:\\?|$)/);
  await page.goto("/account/data");
  await expect(page.getByRole("link",{name:"Download my app data archive"})).toBeVisible();
  const response=await page.request.get("/api/v1/account/data-archive");
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toContain("no-store");
  expect(response.headers()["content-disposition"]).toContain("attachment");
  const archive=await response.json();
  expect(archive.scope).toBe("first-party-app-records");
  expect(archive.account.id).toBe(account.data.user!.id);
  expect(archive.profiles).toEqual(expect.arrayContaining([expect.objectContaining({username:name})]));
  expect(archive.profiles.every((profile:{username:string})=>profile.username===name)).toBe(true);
  expect(archive.limitations.join(" ")).toContain("Stripe");
  // A separate unauthenticated browser must not inherit the signed-in cookie.
  const other=await browser.newContext();
  try{
   expect((await other.request.get("/api/v1/account/data-archive")).status()).toBe(401);
  }finally{await other.close();}
 }finally{if(account.data.user)await admin.auth.admin.deleteUser(account.data.user.id);}
});

test("provider Auth ban rejects new login and unban restores disposable user",async()=>{
 if(!url||!key||!adminKey||!url.startsWith("http://127.0.0.1:54321"))
  throw new Error("Disposable local Supabase required");
 const admin=createClient(url,adminKey,{auth:{persistSession:false}});
 const email="auth-ban-"+randomUUID().slice(0,8)+"@example.com";
 const password="P!"+randomUUID()+"Q9";
 const created=await admin.auth.admin.createUser({email,password,email_confirm:true});
 expect(created.error).toBeNull();
 const userId=created.data.user!.id;
 const user=createClient(url,key,{auth:{persistSession:false}});
 try{
  expect((await user.auth.signInWithPassword({email,password})).error).toBeNull();
  await user.auth.signOut();
  const banned=await admin.auth.admin.updateUserById(userId,{ban_duration:"24h"});
  expect(banned.error).toBeNull();
  expect((await user.auth.signInWithPassword({email,password})).error).not.toBeNull();
  const unbanned=await admin.auth.admin.updateUserById(userId,{ban_duration:"none"});
  expect(unbanned.error).toBeNull();
  expect((await user.auth.signInWithPassword({email,password})).error).toBeNull();
 }finally{
  // Disposable provider only: never run this against a production identity.
  await admin.auth.admin.updateUserById(userId,{ban_duration:"none"});
  await admin.auth.admin.deleteUser(userId);
 }
});
