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
