"use server";
import {revalidatePath} from "next/cache";
import {z} from "zod";
import type {ActionState} from "@/lib/actions";
import {createProductReport,moderationDecision} from "@/lib/creator-product-moderation";
import {requireAccount} from "@/lib/profiles-server";
export async function submitCreatorProductReport(_:ActionState,form:FormData):Promise<ActionState> {
 const input=createProductReport.safeParse({
  versionId:form.get("versionId"),reason:form.get("reason"),detail:form.get("detail"),
 });
 if(!input.success) return {status:"error",message:"Choose a public reviewed product and a reason; include 25–1,200 characters. Do not include credentials or payment card details."};
 const {client}=await requireAccount();
 const {data,error}=await client.rpc("open_my_creator_product_report",{
  p_version:input.data.versionId,p_reason:input.data.reason,p_detail:input.data.detail,
 });
 if(error||!z.uuid().safeParse(data).success) return {status:"error",
  message:error?.code==="P1316"?"Product report limit reached. Contact Snoozer support for an urgent unsafe file.":"Report unavailable. The product may be private, expired or no longer approved."};
 revalidatePath("/studio/product-reports");
 return {status:"success",message:"Report received for moderator review. Filing a report does not automatically quarantine, refund or suspend a purchase."};
}
export async function decideCreatorProductReport(_:ActionState,form:FormData):Promise<ActionState> {
 const id=z.uuid().safeParse(form.get("id"));
 const decision=moderationDecision.safeParse(form.get("decision"));
 if(!id.success||!decision.success||decision.data==="quarantine"&&form.get("confirm")!=="on")
  return {status:"error",message:"Choose a report and explicitly confirm any irreversible quarantine."};
 const {client}=await requireAccount();
 const staff=await client.rpc("can_moderate_creator_products");
 if(staff.error||staff.data!==true) return {status:"error",message:"Moderator permission required."};
 const {data,error}=await client.rpc("resolve_creator_product_report",{
  p_report:id.data,p_action:decision.data,
 });
 if(error||data!==true) return {status:"error",message:"Report is no longer open or the moderation decision failed. Reload before retrying."};
 revalidatePath("/studio/product-reports/staff");
 return {status:"success",message:decision.data==="quarantine"?
  "Version quarantined: future publication and new buyer downloads are blocked. Historical payment records remain unchanged.":
  "Report dismissed after review. No payment or entitlement state was changed."};
}
