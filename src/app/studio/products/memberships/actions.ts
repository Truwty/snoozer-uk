"use server";
import {revalidatePath} from "next/cache";
import {z} from "zod";
import {productTitle} from "@/lib/products";
import {membershipBenefits,membershipPrice} from "@/lib/creator-membership";
import {requireAccount} from "@/lib/profiles-server";
import type {ActionState} from "@/lib/actions";

export async function saveMembership(_:ActionState,form:FormData):Promise<ActionState> {
  const remove=form.get("intent")==="delete";
  const common=z.object({profile:z.uuid(),id:z.union([z.literal("").transform(()=>null),z.uuid()]),revision:z.string().regex(/^(0|[1-9]\d*)$/).transform(Number).pipe(z.number().int().max(2147483646))}).safeParse({profile:form.get("profile"),id:form.get("id"),revision:form.get("revision")});
  const fields=z.object({title:productTitle,benefits:membershipBenefits,monthly:membershipPrice,visible:z.boolean()}).refine(v=>!v.visible||v.benefits.trim().length>0).safeParse({title:form.get("title"),benefits:form.get("benefits"),monthly:form.get("monthly"),visible:form.get("visible")==="on"});
  if(!common.success||(!remove&&!fields.success)||(remove&&!common.data.id)) return {status:"error",message:"Enter a title, proposed monthly price of £1–£100 and benefits for a visible offer."};
  const {client}=await requireAccount();
  const v=common.data,f=fields.success?fields.data:null;
  const result=await client.rpc("save_my_creator_membership_offer",{p_profile:v.profile,p_id:v.id,p_revision:v.revision,p_title:f?.title??"",p_benefits:f?.benefits??"",p_monthly:f?.monthly??100,p_visible:f?.visible??false,p_remove:remove});
  if(result.error) return {status:"error",message:result.error.code==="40001"?"Offer changed in another window. Reload first.":result.error.code==="P1226"?"Five proposals per profile are allowed.":"Could not save this membership proposal."};
  if(!z.uuid().safeParse(result.data).success) return {status:"error",message:"The update could not be confirmed."};
  revalidatePath("/studio/products/memberships");
  return {status:"success",message:remove?"Proposal removed.":"Proposal saved. No subscription or payment is enabled."};
}
