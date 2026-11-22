import {randomUUID} from "node:crypto";
import {createClient} from "@supabase/supabase-js";
import {expect,test} from "@playwright/test";

test.skip(process.env.SNOOZER_TEST_LOCAL_SUPABASE!=="1","Disposable local Supabase only");

test("billing export is account-scoped, private, and safe with no live Stripe customer",async({page,request})=>{
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 const service=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url?.startsWith("http://127.0.0.1:54321")||!key||!service)
  throw new Error("Disposable local Supabase required");
 const admin=createClient(url,service,{auth:{persistSession:false}});
 const visitor=createClient(url,key,{auth:{persistSession:false}});
 const email="billing-export-"+randomUUID().slice(0,8)+"@example.com";
 const password="P!"+randomUUID()+"S4";
 const account=await admin.auth.admin.createUser({email,password,email_confirm:true});
 expect(account.error).toBeNull();
 try{
  expect((await visitor.rpc("my_premium_live_export_customer")).error).not.toBeNull();
  expect((await request.get("/api/v1/account/billing-export")).status()).toBe(401);
  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password",{exact:true}).fill(password);
  await page.getByRole("button",{name:"Sign in",exact:true}).click();
  await expect(page).toHaveURL("http://localhost:3000/studio");
  const response=await page.request.get("/api/v1/account/billing-export");
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toContain("no-store");
  expect(response.headers()["content-disposition"]).toContain("attachment");
  const body=await response.json();
  expect(body.scope).toBe("live-premium-billing-summary");
  expect(body.customer).toBeNull();
  expect(body.invoices).toEqual([]);
  expect(body.subscriptions).toEqual([]);
  expect(body.partial).toBe(false);
  expect(body.limitations).toContain("processor");
 }finally{
  if(account.data.user)await admin.auth.admin.deleteUser(account.data.user.id);
 }
});
