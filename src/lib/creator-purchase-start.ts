import "server-only";
import Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createCreatorSandboxCheckout,creatorCheckoutConfig } from "./creator-checkout";
import { creatorMerchant } from "./creator-merchant";
import { discountCode } from "./creator-discounts";
import { creatorOrder } from "./creator-orders";
import { readCreatorCheckout,reconcileCreatorOrder } from "./creator-reconciliation";
import { assertCreatorReturnSite,readCreatorSandboxAccount } from "./creator-stripe";
import { storageAdmin } from "./supabase";
import { refreshCreatorStore } from "./creator-store-server";

export async function startCreatorPurchase(client:SupabaseClient,buyerId:string,versionId:string,site:URL,code:string|null=null) {
  z.uuid().parse(buyerId);z.uuid().parse(versionId);assertCreatorReturnSite(site);
  const config=creatorCheckoutConfig();if(!config) throw new Error("Sandbox Checkout is disabled.");
  await refreshCreatorStore(null,versionId);
  const admin=storageAdmin();
  const reserved=code===null
    ?await admin.rpc("reserve_creator_sandbox_order",{p_buyer:buyerId,p_version:versionId})
    :await admin.rpc("reserve_creator_sandbox_discount_order",{p_buyer:buyerId,p_version:versionId,p_code:discountCode.parse(code)});
  if(reserved.error?.code==="P1225") throw new Error("Creator discount unavailable.");
  if(reserved.error) throw new Error("Purchase reservation failed.");
  const order=creatorOrder.parse(reserved.data);
  if(order.buyerId!==buyerId||order.versionId!==versionId||order.platformId!==config.platformId) throw new Error("Purchase reservation mismatch.");
  const receiptUrl=new URL("/studio/purchases?order="+order.id,site).href;
  if(order.state==="paid"||order.holds.length) return receiptUrl;
  if(order.state!=="pending") throw new Error("Checkout is not pending.");
  const claimed=await client.rpc("claim_my_creator_order_check",{p_order:order.id});
  if(claimed.error||claimed.data!==true) throw new Error("Wait ten seconds before retrying this purchase.");
  const seller=await admin.rpc("get_creator_sandbox_merchant",{p_owner:order.sellerId});
  if(seller.error) throw new Error("Seller lookup failed.");
  const merchant=creatorMerchant.parse(seller.data);
  if(merchant.accountId!==order.accountId||merchant.platformId!==order.platformId) throw new Error("Seller binding mismatch.");
  const stripe=new Stripe(config.key,{timeout:8000,maxNetworkRetries:1});
  if(order.checkoutId) {
    if(!(await readCreatorSandboxAccount(stripe,merchant)).ready) throw new Error("Seller is not ready.");
    const current=await readCreatorCheckout(stripe,order);
    if(current.state!=="pending"||current.holds.length||!current.checkoutUrl) {
      await reconcileCreatorOrder(stripe,order);return receiptUrl;
    }
    return current.checkoutUrl;
  }
  const checkout=await createCreatorSandboxCheckout(stripe,order,merchant,site);
  const bound=await admin.rpc("bind_creator_sandbox_checkout",{p_order:order.id,p_buyer:buyerId,p_account:order.accountId,p_checkout:checkout.id,p_expires:checkout.expiresAt});
  if(bound.error||bound.data!==true) throw new Error("Checkout binding failed; retry the original purchase.");
  return checkout.url;
}
