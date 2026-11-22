"use server";
import {createHash,randomBytes} from "node:crypto";
import {redirect} from "next/navigation";
import {z} from "zod";
import {siteUrl} from "@/lib/env";
import {storageAdmin} from "@/lib/supabase";
import {sendZohoNotice,zohoSmtpConfigured} from "@/lib/owner/zoho-transport";

const uuid=z.uuid();
const email=z.email().max(254);
const tokenSchema=z.string().regex(/^[a-f0-9]{64}$/);
const hash=(token:string)=>createHash("sha256").update(token).digest("hex");
const emailReady=zohoSmtpConfigured;

export async function requestExternalAppeal(form:FormData){
 const caseId=uuid.safeParse(form.get("case"));
 const address=email.safeParse(form.get("email"));
 if(!caseId.success||!address.success)redirect("/appeal/external?status=invalid");
 if(!emailReady())redirect("/appeal/external?status=unavailable");
 const token=randomBytes(32).toString("hex");
 const client=storageAdmin();
 const started=await client.rpc("service_start_external_appeal",{
  p_case:caseId.data,p_email:address.data,p_hash:hash(token)
 });
 if(!started.error&&started.data===true){
  const link=new URL("/appeal/external",siteUrl());
  link.searchParams.set("token",token);
  const ok=await sendZohoNotice(address.data,
   "Snoozer moderation appeal verification",
   "A verification link was requested to appeal a Snoozer moderation decision. "+
   "If you requested it, open this link within 15 minutes: "+link.href+
   "\n\nIf you did not request this link, ignore it.");
  if(!ok)await client.rpc("service_cancel_external_appeal",{p_hash:hash(token)});
 }
 // Identical response for nonexistent user, unknown case, rate limits and errors.
 redirect("/appeal/external?status=sent");
}

export async function submitExternalAppeal(form:FormData){
 const token=tokenSchema.safeParse(form.get("token"));
 const reason=z.string().trim().min(15).max(1000).safeParse(form.get("reason"));
 if(!token.success||!reason.success)redirect("/appeal/external?status=invalid");
 const client=storageAdmin();
 const result=await client.rpc("service_submit_external_appeal",{
  p_hash:hash(token.data),p_reason:reason.data
 });
 redirect("/appeal/external?status="+(!result.error&&result.data===true?"received":"expired"));
}
