import { z } from "zod";
import { creatorPurchases,purchaseHoldLabels } from "@/lib/creator-purchases";
import { sessionClient } from "@/lib/supabase";

const headers={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Content-Security-Policy":"sandbox; default-src 'none'","X-Robots-Tag":"noindex, nofollow"};
const unavailable=(status:number)=>new Response(null,{status,headers});

export async function GET(_:Request,{params}:{params:Promise<{id:string}>}) {
  const {id}=await params;
  if(!z.uuid().safeParse(id).success) return unavailable(404);
  try {
    const client=await sessionClient();
    const user=await client.auth.getUser();
    if(user.error&&(user.error.status===0||(user.error.status??0)>=500)) return unavailable(503);
    if(user.error||!user.data.user?.email_confirmed_at) return unavailable(404);
    // Existing verified-buyer-only SQL projection; no service role or provider calls.
    const response=await client.rpc("list_my_creator_sandbox_orders");
    if(response.error) return unavailable(503);
    const purchases=creatorPurchases.safeParse(response.data);
    if(!purchases.success) return unavailable(503);
    const order=purchases.data.find(item=>item.id===id);
    if(!order||order.state!=="paid") return unavailable(404);
    const body=[
      "SNOOZER — SANDBOX PURCHASE RECORD",
      "TEST MODE ONLY — NOT A TAX INVOICE OR PROOF OF LIVE PAYMENT",
      "",
      "Purchase reference: "+order.id,
      "Product: "+order.title,
      "Original confirmed test charge: GBP "+(order.amount/100).toFixed(2),
      ...(order.originalAmount!==undefined?["Original frozen list price: GBP "+(order.originalAmount/100).toFixed(2),"Discount: GBP "+((order.originalAmount-order.amount)/100).toFixed(2)]:[]),
      "Order created (UTC): "+new Date(order.createdAt).toISOString(),
      ...(order.paidAt?["First payment verification (UTC): "+new Date(order.paidAt).toISOString()]:[]),
      ...(order.held&&purchaseHoldLabels(order.holds).length?["Recorded delivery restrictions: "+purchaseHoldLabels(order.holds).join("; ")]:[]),
      "Recorded status: "+(order.held?"Payment previously confirmed; delivery paused for risk review":"Payment previously confirmed"),
      "Download window ends (UTC): "+(order.accessUntil?new Date(order.accessUntil).toISOString():"Unavailable"),
      "Record generated (UTC): "+new Date().toISOString(),
      "",
      "This is a snapshot of Snoozer's retained sandbox order, not a fresh Stripe verification.",
      "It does not establish a net refund amount, tax amount, seller payout or current download permission.",
      "Check Purchases for updated status. Product downloads require separate payment verification.",
      "Support: SnoozerSupport@Snoozer.uk",
    ].join("\n")+"\n";
    return new Response(body,{headers:{...headers,"Content-Type":"text/plain; charset=utf-8","Content-Disposition":'attachment; filename="snoozer-sandbox-receipt.txt"'}});
  } catch {return unavailable(503);}
}
