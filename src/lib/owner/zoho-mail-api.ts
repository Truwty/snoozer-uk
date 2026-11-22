import {z} from "zod";

const email=z.email().max(254);
const subjectSchema=z.string().min(1).max(120).refine(s=>!/[\r\n]/.test(s));
const REGIONS={eu:{mail:"https://mail.zoho.eu",auth:"https://accounts.zoho.eu"},
 uk:{mail:"https://mail.zoho.uk",auth:"https://accounts.zoho.uk"},
 com:{mail:"https://mail.zoho.com",auth:"https://accounts.zoho.com"}} as const;
type ZohoRegion=keyof typeof REGIONS;
const region=(r:string):r is ZohoRegion=>Object.prototype.hasOwnProperty.call(REGIONS,r);
const accessToken=z.object({access_token:z.string().min(12).max(4096),expires_in:z.number().optional()});
const sendResponse=z.object({status:z.object({code:z.union([z.string(),z.number()])})});
let tokenCache:{key:string;value:string;expires:number}|null=null;

export function zohoMailApiConfigured(){
 return Boolean(region(process.env.ZOHO_MAIL_REGION??"") &&
   /^\d{5,30}$/.test(process.env.ZOHO_MAIL_ACCOUNT_ID??"") &&
   email.safeParse(process.env.SNOOZER_NOTIFICATION_FROM).success &&
   (process.env.ZOHO_OAUTH_CLIENT_ID?.length??0)>8 &&
   (process.env.ZOHO_OAUTH_CLIENT_SECRET?.length??0)>8 &&
   (process.env.ZOHO_OAUTH_REFRESH_TOKEN?.length??0)>8);
}

export async function sendZohoApiNotice(
 to:string,subject:string,body:string,send:typeof fetch=fetch
):Promise<boolean>{
 if(!zohoMailApiConfigured()||!email.safeParse(to).success||
  !subjectSchema.safeParse(subject).success||typeof body!=="string"||
  body.length>2500)return false;
 const r=process.env.ZOHO_MAIL_REGION!;
 if(!region(r))return false;
 const config=REGIONS[r];
 const id=process.env.ZOHO_MAIL_ACCOUNT_ID!;
 const clientId=process.env.ZOHO_OAUTH_CLIENT_ID!;
 const clientSecret=process.env.ZOHO_OAUTH_CLIENT_SECRET!;
 const refreshToken=process.env.ZOHO_OAUTH_REFRESH_TOKEN!;
 const cacheKey=[r,id,clientId,refreshToken].join("|");
 try{
  let token=tokenCache?.key===cacheKey&&tokenCache.expires>Date.now()?
   tokenCache.value:null;
  if(!token){
   const form=new URLSearchParams({grant_type:"refresh_token",
    refresh_token:refreshToken,client_id:clientId,client_secret:clientSecret});
   const result=await send(config.auth+"/oauth/v2/token",{
    method:"POST",redirect:"error",cache:"no-store",
    headers:{"Content-Type":"application/x-www-form-urlencoded","Accept":"application/json"},
    body:form,signal:AbortSignal.timeout(10000)});
   if(!result.ok)return false;
   const parsed=accessToken.safeParse(await result.json());
   if(!parsed.success)return false;
   token=parsed.data.access_token;
   tokenCache={key:cacheKey,value:token,expires:Date.now()+Math.min(
    Math.max((parsed.data.expires_in??3600)-180,30),3000)*1000};
  }
  const result=await send(config.mail+"/api/accounts/"+id+"/messages",{
   method:"POST",redirect:"error",cache:"no-store",
   headers:{"Authorization":"Zoho-oauthtoken "+token,
    "Content-Type":"application/json","Accept":"application/json"},
   body:JSON.stringify({fromAddress:process.env.SNOOZER_NOTIFICATION_FROM,
    toAddress:to,subject,content:body+
     "\n\nIf you need help, contact Snoozer support through the official website.",
    mailFormat:"plaintext",encoding:"UTF-8"}),
   signal:AbortSignal.timeout(10000)
  });
  if(result.status===401){tokenCache=null;return false;}
  if(!result.ok)return false;
  const parsed=sendResponse.safeParse(await result.json());
  return parsed.success && Number(parsed.data.status.code)===200;
 }catch{return false;}
}
