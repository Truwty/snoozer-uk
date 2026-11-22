import "server-only";
import {zohoSmtpConfigured,sendZohoNotice} from "./zoho-transport";
import {zohoMailApiConfigured,sendZohoApiNotice} from "./zoho-mail-api";

// Render Free blocks ports 25/465/587; never attempt outbound SMTP unless
// the operator explicitly confirms a hosting plan that allows these ports.
export function zohoOutboundEnabled(){
 return process.env.ZOHO_SMTP_OUTBOUND_ENABLED==="true";
}
export function zohoMailReady(){
 return zohoMailApiConfigured() || (zohoSmtpConfigured() && zohoOutboundEnabled());
}
export function mailReadiness(){
 const apiConfigured=zohoMailApiConfigured();
 const credentialsConfigured=zohoSmtpConfigured();
 const outboundEnabled=zohoOutboundEnabled();
 return {
  apiConfigured,credentialsConfigured,outboundEnabled,
  transport:apiConfigured?"api":credentialsConfigured&&outboundEnabled?"smtp":"none",
  dispatchTokenConfigured:typeof process.env.OWNER_EMAIL_DISPATCH_TOKEN==="string" &&
    process.env.OWNER_EMAIL_DISPATCH_TOKEN.length>=32,
 };
}
export async function sendOwnerMail(to:string,subject:string,body:string){
 if(zohoMailApiConfigured())return sendZohoApiNotice(to,subject,body);
 if(zohoSmtpConfigured()&&zohoOutboundEnabled())return sendZohoNotice(to,subject,body);
 return false;
}
