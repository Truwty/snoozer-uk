"use server";
import {redirect} from "next/navigation";
import {z} from "zod";
import {requireOwner} from "@/lib/owner/auth";
import {storageAdmin} from "@/lib/supabase";
import {providerBanConfigured} from "@/lib/owner/provider-ban-config";

const uuid=z.uuid();
function providerPreflightError(error:{code?:string;message?:string}|null){
 if(!error)return "denied";
 if(error.code==="42501")return "mfa-required";
 if(error.message?.includes("Internal ban must be active"))return "internal-ban-required";
 if(error.message?.includes("Case reference required"))return "case-required";
 if(error.message?.includes("Lift internal restriction first"))return "internal-restriction-active";
 if(error.message?.includes("Existing provider action pending"))return "pending-operation";
 return "denied";
}
export async function changeProviderBan(form:FormData){
 const user=uuid.safeParse(form.get("user"));
 const operation=z.enum(["ban","unban"]).safeParse(form.get("operation"));
 const caseId=uuid.safeParse(form.get("case"));
 const reason=z.string().trim().min(8).max(500).safeParse(form.get("reason"));
 const hours=z.coerce.number().int().min(1).max(876000).safeParse(form.get("hours"));
 if(!user.success)redirect("/owner/users");
 const destination="/owner/users/"+user.data+"?admin=";
 if(!operation.success||!reason.success||
 (operation.data==="ban"&&(!caseId.success||!hours.success)))
  redirect(destination+"invalid");
 if(!providerBanConfigured())redirect(destination+"provider-disabled");
 const {client}=await requireOwner();
 const assurance=await client.auth.mfa.getAuthenticatorAssuranceLevel();
 if(assurance.error||assurance.data?.currentLevel!=="aal2")
  redirect(destination+"mfa-required");
 const prepared=await client.rpc("owner_prepare_auth_ban",{
  p_user:user.data,p_case:caseId.success?caseId.data:null,p_operation:operation.data,
  p_hours:operation.data==="ban"?hours.data:null,p_reason:reason.data,
 });
 if(prepared.error||!uuid.safeParse(prepared.data).success)
  redirect(destination+providerPreflightError(prepared.error));
 const admin=storageAdmin();
 let ok=false,code="provider_unavailable";
 try {
  const result=await admin.auth.admin.updateUserById(user.data,{
   ban_duration:operation.data==="ban"?String(hours.data)+"h":"none"
  });
  ok=!result.error;
  code=result.error?.name??"provider_error";
 } catch {code="provider_exception";}
 const audited=await admin.rpc("service_finish_auth_ban",{
  p_operation:prepared.data,p_success:ok,p_code:ok?null:code,
 });
 if(audited.error||audited.data!==true)
  redirect(destination+"reconciliation-required");
 if(ok&&operation.data==="ban"){
  // Existing DB checks independently enforce the Snoozer ban.
  const sessions=await client.rpc("owner_revoke_sessions",{p_user:user.data,p_reason:reason.data});
  if(sessions.error)redirect(destination+"reconciliation-required");
 }
 redirect(destination+(ok?"provider-updated":"provider-failed"));
}
