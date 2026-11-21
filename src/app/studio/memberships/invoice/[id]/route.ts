import {z} from "zod";
import {sessionClient} from "@/lib/supabase";
import {membershipStripe,verifyMyMembership} from "@/lib/creator-membership-server";
import {inspectMembershipSubscription} from "@/lib/creator-membership-provider";
import {verifiedStripeTestInvoicePdf} from "@/lib/creator-membership-invoice";
export const runtime="nodejs";
const headers={"Cache-Control":"private, no-store","X-Robots-Tag":"noindex, nofollow",
 "Referrer-Policy":"no-referrer","X-Content-Type-Options":"nosniff"};
const deny=(status:number)=>new Response(null,{status,headers});
export async function GET(_:Request,{params}:{params:Promise<{id:string}>}) {
 const id=z.uuid().safeParse((await params).id);
 if(!id.success) return deny(404);
 try {
  const client=await sessionClient();
  const {data,error}=await client.auth.getUser();
  if(error&&(error.status===0||(error.status??0)>=500)) return deny(503);
  if(error||!data.user?.email_confirmed_at) return deny(404);
  // Buyer-scoped before any provider read; sellers and staff cannot impersonate.
  const own=await client.rpc("owns_my_creator_membership",{p_id:id.data});
  if(own.error||typeof own.data!=="boolean") return deny(503);
  if(!own.data) return deny(404);
  const {record,active}=await verifyMyMembership(client,data.user.id,id.data);
  if(!active||record.id!==id.data||record.buyerId!==data.user.id||record.holds.length) return deny(404);
  const {stripe,config}=membershipStripe();
  if(!record.subscriptionId||record.platformId!==config.platformId) return deny(503);
  const scope={stripeAccount:record.accountId};
  const subscription=await stripe.subscriptions.retrieve(record.subscriptionId,{},scope);
  const period=inspectMembershipSubscription(subscription,record);
  if(period.state!=="active"||!period.invoiceId) return deny(404);
  const invoice=await stripe.invoices.retrieve(period.invoiceId,{},scope);
  const pdf=verifiedStripeTestInvoicePdf(invoice,record,period);
  return new Response(null,{status:303,headers:{...headers,Location:pdf}});
 } catch {return deny(503);}
}
