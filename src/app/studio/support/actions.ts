"use server";
import {revalidatePath} from "next/cache";
import {z} from "zod";
import type {ActionState} from "@/lib/actions";
import {supportInput,supportReply} from "@/lib/creator-support";
import {requireAccount} from "@/lib/profiles-server";

export async function openCreatorSupportCase(_:ActionState,form:FormData):Promise<ActionState> {
 const parsed=supportInput.safeParse({kind:form.get("kind"),reference:form.get("reference"),
  issue:form.get("issue"),message:form.get("message")});
 if(!parsed.success) return {status:"error",message:"Select a valid owned purchase or membership and enter 20–1,500 characters. Never include payment card or login details."};
 const {client}=await requireAccount();
 const {data,error}=await client.rpc("open_my_creator_support_case",{
  p_kind:parsed.data.kind,p_reference:parsed.data.reference,p_issue:parsed.data.issue,p_message:parsed.data.message,
 });
 if(error||!z.uuid().safeParse(data).success) return {status:"error",message:error?.code==="P1317"?"Support intake limit reached. Email SnoozerSupport@Snoozer.uk if your case is urgent.":"Case could not be created. Check that the reference belongs to your account and try again."};
 revalidatePath("/studio/support");
 return {status:"success",message:"Support case received. Check Your support cases for a staff reply. No payment status or access permissions were changed."};
}
export async function closeCreatorSupportCase(_:ActionState,form:FormData):Promise<ActionState> {
 const id=z.uuid().safeParse(form.get("id"));
 if(!id.success) return {status:"error",message:"Invalid case reference."};
 const {client}=await requireAccount();
 const {data,error}=await client.rpc("close_my_creator_support_case",{p_id:id.data});
 if(error||data!==true) return {status:"error",message:"Unable to close this case. Reload before trying again."};
 revalidatePath("/studio/support");
 return {status:"success",message:"Case closed. This does not affect your payment or download access."};
}
export async function answerCreatorSupportCase(_:ActionState,form:FormData):Promise<ActionState> {
 const id=z.uuid().safeParse(form.get("id"));
 const response=supportReply.safeParse(form.get("response"));
 if(!id.success||!response.success) return {status:"error",message:"Provide a valid case and a 20–1,500-character reply."};
 const {client}=await requireAccount();
 const permission=await client.rpc("can_read_creator_support_cases");
 if(permission.error||permission.data!==true) return {status:"error",message:"Support staff permission required."};
 const {data,error}=await client.rpc("reply_staff_creator_support_case",{p_id:id.data,p_response:response.data});
 if(error||data!==true) return {status:"error",message:"Case not open or reply could not be stored; reload the queue."};
 revalidatePath("/studio/support/staff");
 return {status:"success",message:"Reply saved in the buyer's private case. No email was sent."};
}
