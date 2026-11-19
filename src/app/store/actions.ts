"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/lib/actions";
import { startCreatorPurchase } from "@/lib/creator-purchase-start";
import { siteUrl } from "@/lib/env";
import { requireAccount } from "@/lib/profiles-server";

export async function beginCreatorPurchase(_:ActionState,form:FormData):Promise<ActionState> {
  const version=z.uuid().safeParse(form.get("version"));
  if(!version.success||form.get("sandbox")!=="on") return {status:"error",message:"Choose a test product and acknowledge the sandbox notice."};
  const {client,user}=await requireAccount();
  let target:string;
  try {target=await startCreatorPurchase(client,user.id,version.data,siteUrl());}
  catch {return {status:"error",message:"Test Checkout could not be opened. Wait ten seconds, then retry this same product. Check Purchases for an existing attempt; older uncertain attempts need operator reconciliation."};}
  redirect(target);
}
