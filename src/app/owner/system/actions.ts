"use server";
import {redirect} from "next/navigation";
import {requireOwner} from "@/lib/owner/auth";
import {dispatchOwnerNoticeEmails} from "@/lib/owner/notification-delivery";

import {zohoMailReady,sendOwnerMail} from "@/lib/owner/mail-readiness";
import {storageAdmin} from "@/lib/supabase";
import {revalidatePath} from "next/cache";
import {z} from "zod";

export async function runOwnerNoticeDelivery() {
 const {client}=await requireOwner();
 const assurance=await client.auth.mfa.getAuthenticatorAssuranceLevel();
 if(assurance.error||assurance.data?.currentLevel!=="aal2")
  redirect("/owner/system?mail=mfa-required");
 const delivery=await dispatchOwnerNoticeEmails();
 redirect("/owner/system?mail="+delivery.status+
   "&sent="+encodeURIComponent(String(delivery.sent))+
   "&failed="+encodeURIComponent(String(delivery.failed)));
}

/** Explicit Owner-initiated test to the Owner's own verified Auth email.
 * This does not create a moderation case or change Premium entitlements. */
export async function sendOwnerTestEmail(){
 const {client}=await requireOwner();
 const assurance=await client.auth.mfa.getAuthenticatorAssuranceLevel();
 if(assurance.error||assurance.data?.currentLevel!=="aal2"){
  redirect("/owner/system?test=mfa-required");
 }
 const auth=await client.auth.getUser();
 if(auth.error||!auth.data.user?.email_confirmed_at||!auth.data.user.email){
  redirect("/owner/system?test=verified-email-required");
 }
 if(!zohoMailReady())redirect("/owner/system?test=unavailable");
 const success=await sendOwnerMail(
  auth.data.user.email,
  "Snoozer Owner email delivery test",
  "This is a test of the Snoozer Owner notification email transport. No account setting or permission has been changed.\n\nIf you did not request this message, please review access to your Owner account."
 );
 // SMTP acceptance is not a delivery receipt; the user must confirm inbox arrival.
 redirect("/owner/system?test="+(success?"accepted":"failed"));
}


export async function updateStatusBugReport(formData: FormData) {
 const {client}=await requireOwner();
 const assurance=await client.auth.mfa.getAuthenticatorAssuranceLevel();
 if(assurance.error||assurance.data?.currentLevel!=="aal2")
  redirect("/owner/system?bugs=mfa-required");
 const id=z.uuid().safeParse(formData.get("id"));
 const status=z.enum(["new","reviewing","resolved","ignored"]).safeParse(formData.get("status"));
 if(!id.success||!status.success) redirect("/owner/system?bugs=failed");
 const {data,error}=await storageAdmin().from("status_bug_reports")
  .update({status:status.data,updated_at:new Date().toISOString()})
  .eq("id",id.data).select("id").maybeSingle();
 if(error||!data) redirect("/owner/system?bugs=failed");
 revalidatePath("/owner/system");
 redirect("/owner/system?bugs=updated");
}
