import {z} from "zod";
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
