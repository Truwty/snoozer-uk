import "server-only";
import {z} from "zod";
import {storageAdmin} from "@/lib/supabase";
const jobSchema=z.array(z.object({
 id:z.uuid(),email:z.email().max(254),title:z.string().min(3).max(120),body:z.string().min(3).max(500)
})).max(10);
export type NoticeSendResult={sent:number;failed:number;status:"ok"|"unconfigured"|"unavailable"};
export function noticeDeliveryConfigured() {
 return Boolean(process.env.BREVO_API_KEY && process.env.SNOOZER_NOTIFICATION_FROM &&
  process.env.OWNER_EMAIL_DISPATCH_TOKEN);
}
export async function sendBrevoNotice(
 email:string,subject:string,body:string,apiKey:string,from:string,
 send:typeof fetch=fetch
):Promise<boolean> {
 const sender=z.email().max(254).safeParse(from);
 const recipient=z.email().max(254).safeParse(email);
 if(!sender.success||!recipient.success||!apiKey||apiKey.length>4096)return false;
 const request={
  sender:{name:"Snoozer",email:sender.data},
  to:[{email:recipient.data}],
  subject,
  textContent:body+"\n\nIf you need help, contact Snoozer support through the official website."
 };
 try {
  const response=await send("https://api.brevo.com/v3/smtp/email",{
   method:"POST",redirect:"error",cache:"no-store",
   headers:{"api-key":apiKey,"Content-Type":"application/json","Accept":"application/json"},
   body:JSON.stringify(request),
   signal:AbortSignal.timeout(8000),
  });
  return response.status>=200&&response.status<300;
 }catch{return false;}
}
export async function dispatchOwnerNoticeEmails():Promise<NoticeSendResult> {
 if(!noticeDeliveryConfigured())return {sent:0,failed:0,status:"unconfigured"};
 const client=storageAdmin();
 const result=await client.rpc("service_claim_account_notices",{p_limit:5});
 const jobs=jobSchema.safeParse(result.data);
 if(result.error||!jobs.success)return {sent:0,failed:0,status:"unavailable"};
 let sent=0,failed=0;
 for(const job of jobs.data){
  const ok=await sendBrevoNotice(job.email,job.title,job.body,
   process.env.BREVO_API_KEY!,process.env.SNOOZER_NOTIFICATION_FROM!);
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
