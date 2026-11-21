import {membershipConfig} from "@/lib/creator-membership-provider";
import {processMembershipEvent,receiveMembershipWebhook} from "@/lib/creator-membership-webhook";
import Stripe from "stripe";
export const runtime="nodejs";
export function POST(request:Request) {
 const config=membershipConfig();
 if(!config) return new Response(null,{status:503});
 return receiveMembershipWebhook(request,config.secret,event=>processMembershipEvent(new Stripe(config.key,{timeout:5000,maxNetworkRetries:0}),config.platformId,event));
}
