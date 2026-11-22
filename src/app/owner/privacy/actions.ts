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
 // The previous two-form workflow required Owner evidence to exist before
 // pressing Execute, then responded with an unhelpful generic denial when
 // the evidence was absent. Record the Owner's *explicit* live attestation
 // and immediately run the protected database preflight in the same action.
 if(form.get("reviewed")!=="yes")
  redirect("/owner/privacy?preflight="+id.data+"&admin=erasure-review-required");
 const preflight=await client.rpc("owner_privacy_preflight",{p_request:id.data});
 const candidate=z.object({
  request_id:z.uuid(),user_id:z.uuid(),kind:z.literal("deletion"),
  status:z.enum(["open","review"]),verified_email:z.literal(true),
 }).safeParse(preflight.data);
 if(preflight.error||!candidate.success)
  redirect("/owner/privacy?preflight="+id.data+"&admin=erasure-request-ineligible");
 const attested=await client.rpc("owner_record_privacy_evidence",{
  p_request:id.data,
  p_identity:true,p_app:false,p_media:false,p_billing:true,
  p_processors:true,p_retention:true,p_subscriptions:true,
  p_erasure:false,p_notice:false,
  p_reference:"Restricted account erasure: Owner independently confirmed the verified recipient, billing, processors, legal retention and subscription review for "+id.data,
 });
 if(attested.error||attested.data!==true)
  redirect("/owner/privacy?preflight="+id.data+"&admin=erasure-evidence-failed");
 const ready=await client.rpc("owner_prepare_privacy_erasure",{p_request:id.data});
 const operation=z.object({operation_id:z.uuid(),user_id:z.uuid()}).safeParse(ready.data);
 if(ready.error||!operation.success){
  const msg=ready.error?.message??"";
  const cause=msg.includes("Paid or creator data")?"erasure-paid-blocker":
   msg.includes("Private media")?"erasure-storage-blocker":
   msg.includes("Unresolved account dependencies")?"erasure-linked-records":
   msg.includes("Owner erasure forbidden")?"erasure-owner-protected":
   "erasure-preflight-blocked";
  redirect("/owner/privacy?preflight="+id.data+"&admin="+cause);
 }
 if(operation.data.user_id!==candidate.data.user_id)
  redirect("/owner/privacy?preflight="+id.data+"&admin=erasure-reconciliation-required");
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
 let mail=false;
 try{
  mail=await sendOwnerMail(recipient,
   "Snoozer account deletion completed",
   "The Snoozer account deletion requested by this verified address has been processed. "+
   "Where legally required, minimal billing or abuse-prevention records may be retained under the published privacy policy. "+
   "Please contact snoozersupport@snoozer.uk if you need an independent review.");
 }catch{mail=false;}
 if(!mail)
  redirect("/owner/privacy?preflight="+id.data+"&admin=erased-notice-pending");
 const notice=await admin.rpc("service_mark_privacy_erasure_notice",{p_operation:job});
 if(notice.error||notice.data!==true)
  redirect("/owner/privacy?preflight="+id.data+"&admin=erased-notice-reconciliation-required");
 // Completing the *review* is separate from deleting the account, but it can
 // happen automatically once deletion and mail notice are verified.
 const completed=await client.rpc("owner_review_privacy_request",{
  p_request:id.data,p_status:"completed",
  p_response:"Account deletion verified using erasure operation "+job+". Supabase Auth identity removed, first-party records checked, and completion notice dispatched."
 });
 redirect("/owner/privacy?preflight="+id.data+"&admin="+
  (!completed.error&&completed.data===true?"erasure-complete":"erased-review-pending"));
}
