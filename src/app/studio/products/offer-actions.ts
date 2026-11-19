"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/actions";
import { creatorCheckoutConfig } from "@/lib/creator-checkout";
import { requireAccount } from "@/lib/profiles-server";

export async function manageCreatorOffer(_:ActionState,form:FormData):Promise<ActionState> {
  const input=z.object({version:z.uuid(),operation:z.enum(["publish","withdraw"])}).safeParse({version:form.get("version"),operation:form.get("operation")});
  if(!input.success) return {status:"error",message:"Choose a reviewed test version."};
  const {client}=await requireAccount();
  if(input.data.operation==="publish"&&!creatorCheckoutConfig()) return {status:"error",message:"Sandbox Checkout is disabled. Offers can still be withdrawn."};
  try {
    const result=await client.rpc("publish_my_creator_sandbox_offer",{p_version:input.data.version,p_enabled:input.data.operation==="publish"});
    if(result.error||result.data!==true) return {status:"error",message:"Offer unchanged. Publication requires an unexpired operator fixture review, a public profile, current seller readiness and enabled sandbox policy."};
    return {status:"success",message:input.data.operation==="publish"?"Reviewed version enabled for sandbox testing. New purchases still require current Stripe readiness.":"Test offer withdrawn. Existing orders and purchased files remain retained."};
  } catch {return {status:"error",message:"The offer could not be updated. Reload to check its state."};}
  finally {revalidatePath("/studio/products");revalidatePath("/store","layout");}
}
