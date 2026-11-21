import Stripe from "stripe";
import {recoverCreatorReceipts} from "@/lib/creator-recovery";
import {membershipConfig} from "@/lib/creator-membership-provider";
import {processMembershipEvent} from "@/lib/creator-membership-webhook";
import {storageAdmin} from "@/lib/supabase";
export const runtime="nodejs";
export function POST(request:Request) {
 const config=membershipConfig();if(!config) return new Response(null,{status:503});
 return recoverCreatorReceipts(request,process.env.STRIPE_CREATOR_MEMBERSHIP_RECOVERY_TOKEN,async selection=>{
  const result=await storageAdmin().rpc("list_creator_membership_retries",{p_platform:config.platformId,p_limit:selection.id?1:selection.limit,p_id:selection.id??null});
  if(result.error) throw new Error("Membership retry lookup failed.");return result.data;
 },async id=>{
  const result=await storageAdmin().rpc("claim_creator_membership_retry",{p_platform:config.platformId,p_id:id});
  if(result.error||typeof result.data!=="boolean") throw new Error("Membership retry claim failed.");return result.data;
 },receipt=>processMembershipEvent(new Stripe(config.key,{timeout:5000,maxNetworkRetries:0}),config.platformId,
 {id:receipt.id,account:receipt.accountId,type:receipt.type,objectId:receipt.objectId,occurredAt:receipt.occurredAt}));
}
