import "server-only";
import Stripe from "stripe";
import { creatorOrder } from "./creator-orders";
import { reconcileCreatorOrder } from "./creator-reconciliation";
import { assertCreatorPlatform,creatorSandboxConfig } from "./creator-stripe";
import { storageAdmin } from "./supabase";

// Call only after the session-scoped ownership RPC succeeds.
export async function refreshCreatorPurchase(id:string,buyerId:string) {
  const config=creatorSandboxConfig();
  if(!config) throw new Error("Sandbox purchase verification is unavailable.");
  const stored=await storageAdmin().rpc("get_creator_sandbox_order",{p_order:id});
  if(stored.error) throw new Error("Purchase lookup failed.");
  const order=creatorOrder.parse(stored.data);
  if(order.id!==id||order.buyerId!==buyerId||order.platformId!==config.platformId) throw new Error("Purchase scope mismatch.");
  if(!order.checkoutId) throw new Error("An uncertain Checkout requires operator reconciliation.");
  const stripe=new Stripe(config.key,{timeout:5000,maxNetworkRetries:0});
  await assertCreatorPlatform(stripe,config.platformId);
  return reconcileCreatorOrder(stripe,order);
}
