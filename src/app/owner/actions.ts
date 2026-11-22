"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireOwner } from "@/lib/owner/auth";

const uuid = z.uuid();
const reason = z.string().trim().min(8).max(500);
const url = (path: string, status: string) => redirect(path + (path.includes("?") ? "&" : "?") + "admin=" + status);
const get = (form: FormData, key: string) => form.get(key);
async function invoke(name: string, args: Record<string, unknown>) {
  const { client } = await requireOwner();
  const { data, error } = await client.rpc(name, args);
  return !error && data !== null && data !== false;
}
export async function restrictAccount(form: FormData) {
  const user = uuid.safeParse(get(form,"user"));
  const kind = z.enum(["ban","suspension"]).safeParse(get(form,"kind"));
  const why = reason.safeParse(get(form,"reason"));
  const days = z.coerce.number().int().min(1).max(365).safeParse(get(form,"days"));
  if (!user.success) redirect("/owner/users");
  if (!kind.success || !why.success || (kind.data==="suspension" && !days.success)) url("/owner/users/"+user.data,"invalid");
  const ok=await invoke("owner_restrict_account",{p_user:user.data,p_kind:kind.data,p_reason:why.data,p_days:kind.data==="suspension"?days.data:null});
  url("/owner/users/"+user.data,ok?"restricted":"denied");
}
export async function liftRestriction(form: FormData) {
  const user=uuid.safeParse(get(form,"user")),id=uuid.safeParse(get(form,"id")),why=reason.safeParse(get(form,"reason"));
  if (!user.success) redirect("/owner/users");
  if (!id.success||!why.success) url("/owner/users/"+user.data,"invalid");
  const ok=await invoke("owner_lift_restriction",{p_id:id.data,p_reason:why.data});
  url("/owner/users/"+user.data,ok?"reinstated":"denied");
}
export async function addOwnerNote(form: FormData) {
  const user=uuid.safeParse(get(form,"user")),note=z.string().trim().min(5).max(2000).safeParse(get(form,"note"));
  if (!user.success) redirect("/owner/users");
  if (!note.success) url("/owner/users/"+user.data,"invalid");
  const ok=await invoke("owner_add_note",{p_user:user.data,p_note:note.data});
  url("/owner/users/"+user.data,ok?"noted":"denied");
}
export async function grantPremium(form: FormData) {
  const user=uuid.safeParse(get(form,"user")),plan=z.enum(["plus","pro","studio"]).safeParse(get(form,"plan"));
  const days=z.coerce.number().int().min(1).max(3650).safeParse(get(form,"days")),why=reason.safeParse(get(form,"reason"));
  if (!user.success) redirect("/owner/users");
  if (!plan.success||!days.success||!why.success) url("/owner/users/"+user.data,"invalid");
  const ok=await invoke("owner_grant_premium",{p_user:user.data,p_plan:plan.data,p_days:days.data,p_reason:why.data});
  url("/owner/users/"+user.data,ok?"granted":"denied");
}
export async function revokePremium(form: FormData) {
  const user=uuid.safeParse(get(form,"user")),id=uuid.safeParse(get(form,"id")),why=reason.safeParse(get(form,"reason"));
  if (!user.success) redirect("/owner/users");
  if (!id.success||!why.success) url("/owner/users/"+user.data,"invalid");
  const ok=await invoke("owner_revoke_grant",{p_id:id.data,p_reason:why.data});
  url("/owner/users/"+user.data,ok?"revoked":"denied");
}
export async function openModerationCase(form: FormData) {
  const user=uuid.safeParse(get(form,"user")),category=z.enum(["spam","phishing","impersonation","harassment","malware","copyright","other"]).safeParse(get(form,"category"));
  const why=z.string().trim().min(8).max(1000).safeParse(get(form,"reason"));
  if (!user.success) redirect("/owner/users");
  if (!category.success||!why.success) url("/owner/users/"+user.data,"invalid");
  const ok=await invoke("owner_create_case",{p_user:user.data,p_category:category.data,p_reason:why.data});
  url("/owner/users/"+user.data,ok?"case-opened":"denied");
}
export async function changeCaseStatus(form: FormData) {
  const id=uuid.safeParse(get(form,"id")),status=z.enum(["open","review","actioned","closed","appealed"]).safeParse(get(form,"status")),why=reason.safeParse(get(form,"reason"));
  if (!id.success||!status.success||!why.success) url("/owner/moderation","invalid");
  const ok=await invoke("owner_update_case",{p_id:id.data,p_status:status.data,p_reason:why.data});
  url("/owner/moderation",ok?"updated":"denied");
}
export async function changeRegistration(form: FormData) {
  const revision=z.coerce.number().int().positive().safeParse(get(form,"revision")),why=reason.safeParse(get(form,"reason"));
  if (!revision.success||!why.success) url("/owner/settings","invalid");
  const ok=await invoke("owner_set_setting",{p_name:"registrations_enabled",p_value:get(form,"enabled")==="true",p_revision:revision.data,p_reason:why.data});
  url("/owner/settings",ok?"updated":"denied");
}

export async function triageReport(form: FormData) {
  const report=uuid.safeParse(get(form,"report")),why=reason.safeParse(get(form,"reason"));
  if(!report.success||!why.success)url("/owner/moderation","invalid");
  const ok=await invoke("owner_triage_report",{p_report:report.data,p_reason:why.data});
  url("/owner/moderation",ok?"triaged":"denied");
}
export async function reviewModerationAppeal(form:FormData) {
  const appeal=uuid.safeParse(get(form,"appeal"));
  const status=z.enum(["review","accepted","rejected"]).safeParse(get(form,"status"));
  const response=z.string().trim().min(8).max(1000).safeParse(get(form,"response"));
  if(!appeal.success||!status.success||!response.success)url("/owner/moderation","invalid");
  const ok=await invoke("owner_review_appeal",{p_appeal:appeal.data,p_status:status.data,p_response:response.data});
  url("/owner/moderation",ok?"appeal-reviewed":"denied");
}
export async function blockModeratedProfile(form:FormData) {
  const caseId=uuid.safeParse(get(form,"case")),why=reason.safeParse(get(form,"reason"));
  if(!caseId.success||!why.success)url("/owner/moderation","invalid");
  const ok=await invoke("owner_block_profile",{p_case:caseId.data,p_reason:why.data});
  url("/owner/moderation",ok?"profile-blocked":"denied");
}
export async function unblockModeratedProfile(form:FormData) {
  const caseId=uuid.safeParse(get(form,"case")),why=reason.safeParse(get(form,"reason"));
  if(!caseId.success||!why.success)url("/owner/moderation","invalid");
  const ok=await invoke("owner_unblock_profile",{p_case:caseId.data,p_reason:why.data});
  url("/owner/moderation",ok?"profile-unblocked":"denied");
}
export async function takeDownModeratedGalleryImage(form:FormData) {
  const caseId=uuid.safeParse(get(form,"case")),image=uuid.safeParse(get(form,"image")),why=reason.safeParse(get(form,"reason"));
  if(!caseId.success||!image.success||!why.success)url("/owner/moderation","invalid");
  const {client}=await requireOwner();
  const {data,error}=await client.rpc("owner_takedown_gallery",{p_case:caseId.data,p_image:image.data,p_reason:why.data});
  const ok=!error&&(data==="blocked"||data==="already_blocked");
  url("/owner/moderation",ok?"media-blocked":"denied");
}

export async function revokeAccountSessions(form:FormData) {
 const user=uuid.safeParse(get(form,"user")),why=reason.safeParse(get(form,"reason"));
 if(!user.success)redirect("/owner/users");
 if(!why.success)url("/owner/users/"+user.data,"invalid");
 const {client}=await requireOwner();
 const {error}=await client.rpc("owner_revoke_sessions",{p_user:user.data,p_reason:why.data});
 url("/owner/users/"+user.data,error?"denied":"sessions-revoked");
}
export async function changeEffectsSetting(form:FormData) {
 const revision=z.coerce.number().int().positive().safeParse(get(form,"revision")),why=reason.safeParse(get(form,"reason"));
 if(!revision.success||!why.success)url("/owner/settings","invalid");
 const ok=await invoke("owner_set_setting",{p_name:"effects_enabled",p_value:get(form,"enabled")==="true",p_revision:revision.data,p_reason:why.data});
 url("/owner/settings",ok?"updated":"denied");
}

export async function changeMaintenanceSetting(form: FormData) {
 const revision=z.coerce.number().int().positive().safeParse(get(form,"revision"));
 const why=reason.safeParse(get(form,"reason"));
 const enabled=z.enum(["true","false"]).safeParse(get(form,"enabled"));
 if(!revision.success||!why.success||!enabled.success) url("/owner/settings","invalid");
 const ok=await invoke("owner_set_setting",{p_name:"maintenance_enabled",p_value:enabled.data==="true",p_revision:revision.data,p_reason:why.data});
 url("/owner/settings",ok?"updated":"denied");
}
