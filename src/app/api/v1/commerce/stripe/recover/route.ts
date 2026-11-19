import Stripe from "stripe";
import { recoverCreatorReceipts } from "@/lib/creator-recovery";
import { processCreatorReceipt } from "@/lib/creator-reconciliation";
import { creatorSandboxConfig } from "@/lib/creator-stripe";
import { storageAdmin } from "@/lib/supabase";

export const runtime="nodejs";

export function POST(request:Request) {
  const config=creatorSandboxConfig();if(!config) return new Response(null,{status:503});
  return recoverCreatorReceipts(request,process.env.STRIPE_CREATOR_SANDBOX_RECOVERY_TOKEN,async selection=>{
    const result=await storageAdmin().rpc("list_creator_sandbox_receipt_retries",{p_platform:config.platformId,p_limit:selection.id?1:selection.limit,p_id:selection.id??null});
    if(result.error) throw new Error("Receipt retry lookup failed.");return result.data;
  },async id=>{
    const result=await storageAdmin().rpc("claim_creator_sandbox_receipt_retry",{p_id:id,p_platform:config.platformId});
    if(result.error||typeof result.data!=="boolean") throw new Error("Receipt retry claim failed.");return result.data;
  },receipt=>processCreatorReceipt(new Stripe(config.key,{timeout:5000,maxNetworkRetries:0}),config.platformId,receipt));
}
