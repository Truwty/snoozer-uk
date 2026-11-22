import "server-only";
import {sendZohoNotice} from "./zoho-transport";
import {zohoMailReady} from "./mail-readiness";
import {z} from "zod";
import {storageAdmin} from "@/lib/supabase";
const jobSchema=z.array(z.object({
 id:z.uuid(),email:z.email().max(254),title:z.string().min(3).max(120),body:z.string().min(3).max(500)
})).max(10);
export type NoticeSendResult={sent:number;failed:number;status:"ok"|"unconfigured"|"unavailable"};
export function noticeDeliveryConfigured() {
 return zohoMailReady() && Boolean(process.env.OWNER_EMAIL_DISPATCH_TOKEN && process.env.OWNER_EMAIL_DISPATCH_TOKEN.length>=32);
}
export async function dispatchOwnerNoticeEmails():Promise<NoticeSendResult> {
 if(!noticeDeliveryConfigured())return {sent:0,failed:0,status:"unconfigured"};
 const client=storageAdmin();
 const result=await client.rpc("service_claim_account_notices",{p_limit:5});
 const jobs=jobSchema.safeParse(result.data);
 if(result.error||!jobs.success)return {sent:0,failed:0,status:"unavailable"};
 let sent=0,failed=0;
 for(const job of jobs.data){
  const ok=await sendZohoNotice(job.email,job.title,job.body);
  // A failed acknowledgement leaves the lease to expire. The next worker
  // may resend: email delivery is at-least-once, not exactly once.
  const ack=await client.rpc("service_finish_account_notice",{
   p_id:job.id,p_success:ok,p_error:ok?null:"Delivery failed"
  });
  if(ack.error||ack.data!==true){failed++;continue;}
  if(ok)sent++;else failed++;
 }
 return {sent,failed,status:"ok"};
}
