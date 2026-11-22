import { z } from "zod";

const schema = z.object({status:z.object({indicator:z.enum(["none","minor","major","critical","maintenance"]),description:z.string().max(200)})});
export type ProviderStatus = {provider:"Render"|"Supabase"|"Stripe"; url:string; indicator:string; description:string; checked_at:string|null};
const providers = [
 {provider:"Render",url:"https://status.render.com",endpoint:"https://status.render.com/api/v2/status.json"},
 {provider:"Supabase",url:"https://status.supabase.com",endpoint:"https://status.supabase.com/api/v2/status.json"},
 {provider:"Stripe",url:"https://www.stripestatus.com",endpoint:"https://www.stripestatus.com/api/v2/status.json"},
] as const;

export function parseProviderStatus(data:unknown):{indicator:string;description:string}|null {
 const parsed=schema.safeParse(data);
 return parsed.success?parsed.data.status:null;
}
export async function providerStatuses():Promise<ProviderStatus[]> {
 return Promise.all(providers.map(async p=>{
  try {
   const res=await fetch(p.endpoint,{cache:"no-store",redirect:"error",headers:{Accept:"application/json"},signal:AbortSignal.timeout(4000)});
   if(!res.ok()||Number(res.headers.get("content-length")??0)>32768)throw Error("Provider unavailable");
   const parsed=parseProviderStatus(await res.json());
   if(!parsed)throw Error("Invalid provider status");
   return {provider:p.provider,url:p.url,indicator:parsed.indicator,description:parsed.description,checked_at:new Date().toISOString()};
  } catch {
   return {provider:p.provider,url:p.url,indicator:"unknown",description:"Status unavailable; check provider directly.",checked_at:null};
  }
 }));
}
