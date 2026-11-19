"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/actions";
import { requireAccount } from "@/lib/profiles-server";
import { refreshCreatorPurchase } from "@/lib/creator-purchases-server";

export async function refreshPurchase(_:ActionState,form:FormData):Promise<ActionState> {
  const id=z.uuid().safeParse(form.get("order"));
  if(!id.success) return {status:"error",message:"Choose a purchase to verify."};
  const {client,user}=await requireAccount();
  try {
    const own=await client.rpc("owns_my_creator_sandbox_order",{p_order:id.data});
    if(own.error||own.data!==true) return {status:"error",message:"This purchase is unavailable."};
    const claimed=await client.rpc("claim_my_creator_order_check",{p_order:id.data});
    if(claimed.error||claimed.data!==true) return {status:"error",message:"Wait ten seconds before checking this purchase again."};
    const order=await refreshCreatorPurchase(id.data,user.id);
    return {status:"success",message:order.holds.length?"Delivery is paused for payment review. Contact support with your purchase reference.":order.state==="paid"?"Stripe confirmed this sandbox payment. Check the download expiry below.":order.state==="expired"?"Stripe confirmed this Checkout expired or failed. No download access was granted.":"Stripe has not confirmed payment yet. No download access was granted."};
  } catch {return {status:"error",message:"Stripe or purchase verification is unavailable. No download was released. Retry later; an unbound attempt needs operator reconciliation."};}
  finally {revalidatePath("/studio/purchases");}
}
