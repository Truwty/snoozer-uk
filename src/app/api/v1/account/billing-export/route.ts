import Stripe from "stripe";
import {sessionClient} from "@/lib/supabase";
import {premiumLiveReadConfig} from "@/lib/premium-live-config";
import {premiumCustomerId} from "@/lib/premium-live-proof";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store, max-age=0","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer"};
function fail(code:number){
 return Response.json({error:"Live billing export unavailable. Request a reviewed processor export through /account/data."},{status:code,headers});
}

export async function GET(){
 try{
  const client=await sessionClient();
  const {data:{user},error:authError}=await client.auth.getUser();
  if(authError||!user?.email_confirmed_at)return fail(401);
  // Database function independently verifies this exact Auth session.
  const {data:reference,error}=await client.rpc("my_premium_live_export_customer");
  if(error)return fail(503);
  const output={
   generated_at:new Date().toISOString(),
   scope:"live-premium-billing-summary",
   customer:null as null | {id:string,email:string|null,name:string|null,address:unknown},
   subscriptions:[] as Array<{
    id:string,status:string,created:number,cancel_at:number|null,
    canceled_at:number|null,collection_method:string
   }>,
   invoices:[] as Array<{
    id:string,number:string|null,status:string|null,currency:string,
    created:number,amount_paid:number,amount_due:number,total:number,
    period_start:number,period_end:number
   }>,
   partial:false,
   limitations:"Up to 100 current customer invoices and subscriptions are included. More historical records, Stripe events/disputes/payment methods and legally retained processor evidence require a reviewed full export.",
  };
  if(reference!==null){
   const customerId=premiumCustomerId.safeParse(reference);
   if(!customerId.success)return fail(503);
   const config=premiumLiveReadConfig();
   if(!config)return fail(503);
   const stripe=new Stripe(config.key,{timeout:8000,maxNetworkRetries:0});
   const [account,customer,invoices,subscriptions]=await Promise.all([
    stripe.accounts.retrieve(config.accountId),
    stripe.customers.retrieve(customerId.data),
    stripe.invoices.list({customer:customerId.data,limit:100}),
    stripe.subscriptions.list({customer:customerId.data,status:"all",limit:100}),
   ]);
   if(account.id!==config.accountId||customer.deleted||customer.id!==customerId.data)
    return fail(503);
   if(!invoices.data.every(i=>i.livemode&&i.customer===customerId.data)||
      !subscriptions.data.every(s=>s.livemode&&s.customer===customerId.data))
    return fail(503);
   output.customer={
    id:customer.id,email:customer.email??null,name:customer.name??null,address:customer.address??null,
   };
   output.invoices=invoices.data.map(i=>({
    id:i.id,number:i.number??null,status:i.status??null,currency:i.currency,
    created:i.created,amount_paid:i.amount_paid,amount_due:i.amount_due,total:i.total,
    period_start:i.period_start,period_end:i.period_end,
   }));
   output.subscriptions=subscriptions.data.map(s=>({
    id:s.id,status:s.status,created:s.created,cancel_at:s.cancel_at??null,
    canceled_at:s.canceled_at??null,collection_method:s.collection_method,
   }));
   output.partial=invoices.has_more||subscriptions.has_more;
  }
  return new Response(JSON.stringify(output,null,2),{status:200,headers:{
   ...headers,"Content-Type":"application/json; charset=utf-8",
   "Content-Disposition":'attachment; filename="snoozer-live-billing-summary.json"',
  }});
 }catch{return fail(503);}
}
