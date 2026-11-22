"use server";
import {redirect} from "next/navigation";
import {z} from "zod";
import {requireOwner} from "@/lib/owner/auth";
import {storageAdmin} from "@/lib/supabase";
import {zohoMailReady,sendOwnerMail} from "@/lib/owner/mail-readiness";

export async function reviewPrivacyRequest(form:FormData) {
 const id=z.uuid().safeParse(form.get("id"));
 const status=z.enum(["review","completed","rejected"]).safeParse(form.get("status"));
 const response=z.string().trim().min(12).max(1000).safeParse(form.get("response"));
 const completed=form.get("confirmed")==="yes";
 if(!id.success||!status.success||!response.success||(status.data==="completed"&&!completed))
  redirect("/owner/privacy?admin=invalid");
 const {client}=await requireOwner();
 const {data,error}=await client.rpc("owner_review_privacy_request",{
  p_request:id.data,p_status:status.data,p_response:response.data
 });
 redirect("/owner/privacy?admin="+(!error&&data===true?"updated":"denied"));
}


/**
 * Records documentary proof, not an erasure operation. Only the database's
 * Owner AAL2 checker can accept evidence or close the associated request.
 */
export async function recordPrivacyEvidence(form:FormData) {
 const id=z.uuid().safeParse(form.get("id"));
 const reference=z.string().trim().min(32).max(1000).safeParse(form.get("reference"));
 if(!id.success||!reference.success)redirect("/owner/privacy?admin=invalid");
 const yes=(field:string)=>form.get(field)==="yes";
 const {client}=await requireOwner();
 const {data,error}=await client.rpc("owner_record_privacy_evidence",{
  p_request:id.data,p_identity:yes("identity"),p_app:yes("app"),
  p_media:yes("media"),p_billing:yes("billing"),
  p_processors:yes("processors"),p_retention:yes("retention"),
  p_subscriptions:yes("subscriptions"),p_erasure:yes("erasure"),
  p_notice:yes("notice"),p_reference:reference.data
 });
 redirect("/owner/privacy?preflight="+id.data+"&admin="+(!error&&data===true?"evidence-recorded":"denied"));
}


/**
 * Executes only the restricted, dependency-free, non-commercial deletion path.
 * A different, reviewed process is mandatory for accounts with private Storage,
 * subscription data, legal holds or cross-user foreign-key dependencies.
 */
export async function executeSafePrivacyErasure(form:FormData){
 const id=z.uuid().safeParse(form.get("id"));
 const confirmation=z.string().safeParse(form.get("confirmation"));
 if(!id.success||!confirmation.success||
    confirmation.data!=="ERASE "+id.data)
  redirect("/owner/privacy?admin=erasure-confirmation-required");
 if(process.env.SNOOZER_ENABLE_SAFE_PRIVACY_ERASURE!=="true")
  redirect("/owner/privacy?preflight="+id.data+"&admin=erasure-disabled");
 const {client}=await requireOwner();
 const assurance=await client.auth.mfa.getAuthenticatorAssuranceLevel();
 if(assurance.error||assurance.data?.currentLevel!=="aal2")
  redirect("/owner/privacy?preflight="+id.data+"&admin=mfa-required");
 if(!zohoMailReady())
  redirect("/owner/privacy?preflight="+id.data+"&admin=erasure-mail-unavailable");
 const ready=await client.rpc("owner_prepare_privacy_erasure",{p_request:id.data});
 const operation=z.object({operation_id:z.uuid(),user_id:z.uuid()}).safeParse(ready.data);
 if(ready.error||!operation.success)
  redirect("/owner/privacy?preflight="+id.data+"&admin=erasure-blocked");
 const {operation_id:job,user_id:subject}=operation.data;
 const admin=storageAdmin();
 const existing=await admin.auth.admin.getUserById(subject);
 if(existing.error||!existing.data.user?.email||!existing.data.user.email_confirmed_at)
  redirect("/owner/privacy?preflight="+id.data+"&admin=erasure-reconciliation-required");
 const recipient=existing.data.user.email;
 let erased=false;
 let code="auth_erasure_failed";
 try{
  const outcome=await admin.auth.admin.deleteUser(subject);
  erased=!outcome.error;
  code=outcome.error?.name??"auth_erasure_failed";
 }catch{code="auth_erasure_exception";}
 const final=await admin.rpc("service_finish_privacy_erasure",{
  p_operation:job,p_success:erased,p_code:erased?null:code
 });
 if(final.error||final.data!==true)
  redirect("/owner/privacy?preflight="+id.data+"&admin=erasure-reconciliation-required");
 if(!erased)
  redirect("/owner/privacy?preflight="+id.data+"&admin=erasure-blocked");
 const mail=await sendOwnerMail(recipient,
  "Snoozer account deletion completed",
  "The Snoozer account deletion requested by this verified address has been processed. "+
  "Where legally required, minimal billing or abuse-prevention records may be retained under the published privacy policy. "+
  "Please contact snoozersupport@snoozer.uk if you need an independent review.");
 if(!mail)
  redirect("/owner/privacy?preflight="+id.data+"&admin=erased-notice-pending");
 const notice=await admin.rpc("service_mark_privacy_erasure_notice",{p_operation:job});
 redirect("/owner/privacy?preflight="+id.data+"&admin="+
  (!notice.error&&notice.data===true?"erased-notice-sent":"erased-notice-reconciliation-required"));
}
