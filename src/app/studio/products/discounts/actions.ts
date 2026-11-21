"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/actions";
import { createDiscountInput } from "@/lib/creator-discounts";
import { requireAccount } from "@/lib/profiles-server";

export async function createCreatorDiscount(_:ActionState,form:FormData):Promise<ActionState> {
  const input=createDiscountInput.safeParse({profile:form.get("profile"),version:form.get("version"),code:form.get("code"),
    percent:form.get("percent"),uses:form.get("uses"),days:form.get("days")});
  if(!input.success) return {status:"error",message:"Enter a valid code, 1–90% off, 1–50 reservations and 1–30 days."};
  const {client}=await requireAccount();
  const d=input.data;
  const response=await client.rpc("create_my_creator_discount",{p_profile:d.profile,p_version:d.version,p_code:d.code,p_percent:d.percent,p_uses:d.uses,p_days:d.days});
  if(response.error||!z.uuid().safeParse(response.data).success) return {status:"error",message:response.error?.code==="23505"?"This code already exists for that version. Choose a new code.":response.error?.code==="P1224"?
    "Your account has reached its 50-code retained quota.":"The discount could not be created. Check ownership, limits and the £0.50 minimum final price."};
  revalidatePath("/studio/products/discounts");
  return {status:"success",message:"Sandbox discount created. It cannot activate an offer or change an existing order."};
}

export async function disableCreatorDiscount(_:ActionState,form:FormData):Promise<ActionState> {
  const input=z.object({profile:z.uuid(),id:z.uuid()}).safeParse({profile:form.get("profile"),id:form.get("id")});
  if(!input.success) return {status:"error",message:"Invalid discount."};
  const {client}=await requireAccount();
  const response=await client.rpc("disable_my_creator_discount",{p_profile:input.data.profile,p_id:input.data.id});
  if(response.error||response.data!==true) return {status:"error",message:"Could not disable this code."};
  revalidatePath("/studio/products/discounts");
  return {status:"success",message:"Disabled for new reservations. Existing order prices are unchanged."};
}
