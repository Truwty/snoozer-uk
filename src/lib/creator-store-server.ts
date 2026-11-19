import "server-only";
import Stripe from "stripe";
import { z } from "zod";
import { creatorCheckoutConfig } from "./creator-checkout";
import { creatorMerchant } from "./creator-merchant";
import { username } from "./profile";
import { readCreatorSandboxAccount } from "./creator-stripe";
import { storageAdmin } from "./supabase";

export async function refreshCreatorStore(name:string|null,version:string|null) {
  if((name===null)===(version===null)) return false;
  if(name!==null&&!username.safeParse(name).success||version!==null&&!z.uuid().safeParse(version).success) return false;
  const config=creatorCheckoutConfig();if(!config) return false;
  const admin=storageAdmin();
  const found=await admin.rpc("get_creator_store_check_target",{p_name:name,p_version:version});
  if(found.error) throw new Error("Store readiness lookup failed.");
  if(!found.data) return false;
  const {ownerId,merchant}=z.object({ownerId:z.uuid(),merchant:creatorMerchant}).parse(found.data);
  if(!merchant.accountId||merchant.platformId!==config.platformId) return false;
  const age=merchant.checkedAt?Date.now()-Date.parse(merchant.checkedAt):Infinity;
  // Refresh before the database's five-minute validity boundary, under the existing per-seller lease.
  if(age>=0&&age<240000) return merchant.ready;
  const claim=await admin.rpc("claim_creator_sandbox_check",{p_owner:ownerId});
  if(claim.error||!z.uuid().safeParse(claim.data).success) return false;
  let ready=false;
  try {ready=(await readCreatorSandboxAccount(new Stripe(config.key,{timeout:5000,maxNetworkRetries:0}),merchant)).ready;}
  catch {ready=false;}
  const saved=await admin.rpc("complete_creator_sandbox_check",{p_owner:ownerId,p_account:merchant.accountId,p_lease:claim.data,p_ready:ready});
  return !saved.error&&saved.data===true&&ready;
}
