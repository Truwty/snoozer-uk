"use server";
import {redirect} from "next/navigation";
import {revalidatePath} from "next/cache";
import {z} from "zod";
import {requireAccount} from "@/lib/profiles-server";
import {siteUrl} from "@/lib/env";
import {startMembership,verifyMyMembership} from "@/lib/creator-membership-server";
import {username,canonicalUsername} from "@/lib/profile";
import type {ActionState} from "@/lib/actions";

export async function beginMembership(_:ActionState,form:FormData):Promise<ActionState> {
 const offer=z.uuid().safeParse(form.get("offer"));
 const name=z.string().transform(canonicalUsername).pipe(username).safeParse(form.get("name"));
 if(!offer.success||!name.success||form.get("sandbox")!=="on") return {status:"error",message:"Acknowledge the recurring sandbox test and select a valid tier."};
 const {client,user}=await requireAccount();let target:string;
 try {target=await startMembership(client,user.id,offer.data,name.data,siteUrl());}
 catch {return {status:"error",message:"Test membership Checkout unavailable. Check Your memberships before retrying; do not create another payment for an uncertain attempt."};}
 redirect(target);
}
export async function refreshMembershipAction(_:ActionState,form:FormData):Promise<ActionState> {
 const id=z.uuid().safeParse(form.get("id"));
 const cancel=form.get("intent")==="cancel";
 if(!id.success||cancel&&form.get("confirm")!=="on") return {status:"error",message:"Select a membership and acknowledge cancellation if requested."};
 const {client,user}=await requireAccount();
 try {
  const {record,active}=await verifyMyMembership(client,user.id,id.data,cancel);
  revalidatePath("/studio/memberships");
  return {status:"success",message:cancel?(record.state==="cancelled"?"Membership ended.":"Cancellation at the end of the paid period is confirmed."):
   active?"Current sandbox membership access verified.":"No current verified membership access. Check the recorded status; do not pay again."};
 } catch {return {status:"error",message:"Membership could not be verified. Wait ten seconds before retrying. Contact support if this persists."};}
}
