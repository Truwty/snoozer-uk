"use server";
import {redirect} from "next/navigation";
import {z} from "zod";
import {requireOwner} from "@/lib/owner/auth";

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
