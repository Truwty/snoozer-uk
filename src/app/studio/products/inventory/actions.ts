"use server";
import {revalidatePath} from "next/cache";
import {z} from "zod";
import type {ActionState} from "@/lib/actions";
import {requireAccount} from "@/lib/profiles-server";

export async function saveCreatorStock(_:ActionState,form:FormData):Promise<ActionState> {
  const raw=form.get("slots");
  const data=z.object({profile:z.uuid(),version:z.uuid(),
    slots:z.number().int().min(1).max(50).nullable()}).safeParse({
    profile:form.get("profile"),version:form.get("version"),
    slots:raw===""?null:typeof raw==="string"&&/^(?:[1-9]|[1-4][0-9]|50)$/.test(raw)?Number(raw):NaN,
  });
  if(!data.success) return {status:"error",message:"Choose Unlimited or a whole-number cap from 1 to 50."};
  const {client}=await requireAccount();
  const response=await client.rpc("set_my_creator_sandbox_stock",{
    p_profile:data.data.profile,p_version:data.data.version,p_limit:data.data.slots,
  });
  if(response.error) return {status:"error",message:response.error.code==="P1223"
    ?"A purchase attempt already exists. This frozen version's inventory cap cannot be changed."
    :response.error.code==="42501"?"This frozen version is not in your profile."
    :"Could not update the limit. Reload before trying again."};
  if(response.data!==true) return {status:"error",message:"The inventory update could not be confirmed."};
  revalidatePath("/studio/products/inventory");
  return {status:"success",message:data.data.slots===null
    ?"This version has no configured slot limit. Checkout review and seller gates still apply."
    :"Limited sandbox slots configured. Every new Checkout reservation permanently consumes one slot, even if unpaid."};
}
