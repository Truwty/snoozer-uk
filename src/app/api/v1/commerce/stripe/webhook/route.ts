import Stripe from "stripe";
import { creatorSandboxConfig } from "@/lib/creator-stripe";
import { processCreatorReceipt } from "@/lib/creator-reconciliation";
import { receiveCreatorWebhook } from "@/lib/creator-webhook";

export const runtime="nodejs";

export function POST(request:Request) {
  const config=creatorSandboxConfig();
  if(!config) return new Response(null,{status:503});
  // Turning off new Checkout must not stop refund/dispute processing for retained orders.
  return receiveCreatorWebhook(request,process.env.STRIPE_CREATOR_SANDBOX_WEBHOOK_SECRET,receipt=>
    processCreatorReceipt(new Stripe(config.key,{timeout:5000,maxNetworkRetries:0}),config.platformId,receipt));
}
