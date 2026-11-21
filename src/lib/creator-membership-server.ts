import "server-only";
import Stripe from "stripe";
import type {SupabaseClient} from "@supabase/supabase-js";
import {z} from "zod";
import {creatorMerchant} from "./creator-merchant";
import {creatorCheckoutConfig} from "./creator-checkout";
import {memberRecord,membershipAccess,type MemberRecord,type MemberHold} from "./creator-membership-subscription";
import {inspectMembershipCheckout,membershipCheckoutConfig,membershipConfig,openMembershipCheckout,readMembershipProof} from "./creator-membership-provider";
import {assertCreatorPlatform,assertCreatorReturnSite} from "./creator-stripe";
import {refreshCreatorStore} from "./creator-store-server";
import {storageAdmin} from "./supabase";

export function membershipStripe() {
 const config=membershipConfig();
 if(!config) throw new Error("Membership verification unavailable.");
 return {config,stripe:new Stripe(config.key,{timeout:5000,maxNetworkRetries:0})};
}
export async function getMembership(id:string) {
 const response=await storageAdmin().rpc("get_creator_membership_subscription",{p_id:id});
 if(response.error) throw new Error("Membership lookup failed.");
 return response.data===null?null:memberRecord.parse(response.data);
}
export async function findMembership(account:string,subscription:string) {
 const response=await storageAdmin().rpc("find_creator_membership_subscription",{p_account:account,p_subscription:subscription});
 if(response.error) throw new Error("Membership lookup failed.");
 return response.data===null?null:memberRecord.parse(response.data);
}
export async function checkedMembership(client:SupabaseClient,buyer:string,id:string) {
 const valid=z.uuid().parse(id);
 const own=await client.rpc("owns_my_creator_membership",{p_id:valid});
 if(own.error||own.data!==true) throw new Error("Membership unavailable.");
 const claim=await client.rpc("claim_my_creator_membership_check",{p_id:valid});
 if(claim.error||claim.data!==true) throw new Error("Wait ten seconds between membership checks.");
 const m=await getMembership(valid);
 if(!m||m.buyerId!==buyer) throw new Error("Membership unavailable.");
 return m;
}
export async function bindMembership(m:MemberRecord,session:ReturnType<typeof inspectMembershipCheckout>) {
 const bound=await storageAdmin().rpc("bind_creator_membership_checkout",{p_id:m.id,p_account:m.accountId,p_checkout:session.id,
 p_subscription:session.status==="complete"?session.subscriptionId:null,p_customer:session.status==="complete"?session.customerId:null});
 if(bound.error||bound.data!==true) throw new Error("Membership Checkout binding failed.");
 const next=await getMembership(m.id);
 if(!next||next.checkoutId!==session.id||next.accountId!==m.accountId) throw new Error("Membership Checkout binding unavailable.");
 return next;
}
export async function applyMembershipProof(stripe:Stripe,m:MemberRecord,event:string|null=null) {
 if(!m.subscriptionId) throw new Error("Membership not bound.");
 const proof=await readMembershipProof(stripe,m);
 const response=await storageAdmin().rpc("apply_creator_membership_proof",{p_id:m.id,p_account:m.accountId,p_subscription:m.subscriptionId,
 p_checked:proof.checkedAt,p_state:proof.state,p_end:proof.periodEnd,p_cancel:proof.cancelAtEnd,p_holds:proof.holds,p_event:event});
 if(response.error) throw new Error("Membership proof could not be stored.");
 return memberRecord.parse(response.data);
}
export async function expireMembership(m:MemberRecord) {
 const response=await storageAdmin().rpc("expire_creator_membership_checkout",{p_id:m.id,p_account:m.accountId,p_checkout:m.checkoutId});
 if(response.error||response.data!==true) throw new Error("Membership expiry not confirmed.");
 const next=await getMembership(m.id);
 if(!next) throw new Error("Membership unavailable.");
 return next;
}
export async function refreshMembership(stripe:Stripe,m:MemberRecord) {
 if(m.subscriptionId) return applyMembershipProof(stripe,m);
 if(!m.checkoutId||m.state==="cancelled") return m;
 const session=inspectMembershipCheckout(await stripe.checkout.sessions.retrieve(m.checkoutId,{}, {stripeAccount:m.accountId}),m);
 const bound=await bindMembership(m,session);
 return bound.subscriptionId?applyMembershipProof(stripe,bound):session.status==="expired"?expireMembership(bound):bound;
}
export async function startMembership(client:SupabaseClient,buyer:string,offer:string,name:string,site:URL) {
 z.uuid().parse(buyer);z.uuid().parse(offer);assertCreatorReturnSite(site);
 const config=membershipCheckoutConfig();if(!config||!creatorCheckoutConfig()) throw new Error("Membership Checkout disabled.");
 await refreshCreatorStore(name,null);
 const admin=storageAdmin();
 const reserved=await admin.rpc("reserve_creator_membership",{p_buyer:buyer,p_offer:offer});
 if(reserved.error) throw new Error("Membership reservation unavailable.");
 const m=memberRecord.parse(reserved.data);
 if(m.buyerId!==buyer||m.offerId!==offer||m.platformId!==config.platformId) throw new Error("Membership reservation mismatch.");
 const redirect=new URL("/studio/memberships",site).href;
 if(m.subscriptionId||m.state!=="pending") return redirect;
 await checkedMembership(client,buyer,m.id);
 const merchantResponse=await admin.rpc("get_creator_sandbox_merchant",{p_owner:m.sellerId});
 if(merchantResponse.error) throw new Error("Seller unavailable.");
 const merchant=creatorMerchant.parse(merchantResponse.data);
 const stripe=new Stripe(config.key,{timeout:5000,maxNetworkRetries:0});
 const session=await openMembershipCheckout(stripe,m,merchant,site);
 const bound=await bindMembership(m,session);
 if(bound.subscriptionId) {await applyMembershipProof(stripe,bound);return redirect;}
 if(session.status==="expired") {await expireMembership(bound);return redirect;}
 return session.url??redirect;
}
export async function verifyMyMembership(client:SupabaseClient,buyer:string,id:string,cancel=false) {
 const m=await checkedMembership(client,buyer,id);
 const {config,stripe}=membershipStripe();
 if(m.platformId!==config.platformId) throw new Error("Platform mismatch.");
 await assertCreatorPlatform(stripe,config.platformId);
 let current=await refreshMembership(stripe,m);
 if(cancel) {
  if(!current.subscriptionId) throw new Error("No bound subscription to cancel.");
  // Cancellation remains possible even when new Checkout is disabled or a risk hold exists.
  if(current.state!=="cancelled"&&!current.cancelAtEnd) {
   await stripe.subscriptions.update(current.subscriptionId,{cancel_at_period_end:true},
    {stripeAccount:current.accountId,idempotencyKey:"snoozer-membership-cancel-"+current.id});
   current=await refreshMembership(stripe,current);
   if(!current.cancelAtEnd&&current.state!=="cancelled") throw new Error("Cancellation could not be confirmed.");
  }
 }
 return {record:current,active:membershipAccess(current)};
}
export async function stageMembershipEvent(m:MemberRecord,event:string,type:string,hold:MemberHold|null) {
 const response=await storageAdmin().rpc("stage_creator_membership_receipt",{p_id:m.id,p_account:m.accountId,p_event:event,p_type:type,p_hold:hold});
 if(response.error||typeof response.data!=="boolean") throw new Error("Membership receipt unavailable.");
 return response.data;
}
export async function finishMembershipCheckoutEvent(m:MemberRecord,event:string) {
 const response=await storageAdmin().rpc("finish_creator_membership_checkout_receipt",{p_id:m.id,p_event:event});
 if(response.error||response.data!==true) throw new Error("Membership receipt not confirmed.");
}
