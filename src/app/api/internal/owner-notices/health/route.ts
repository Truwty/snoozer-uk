import {timingSafeEqual} from "node:crypto";
import {z} from "zod";
import {storageAdmin} from "@/lib/supabase";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const summary=z.object({
 total:z.number().int().nonnegative(),
 undelivered:z.number().int().nonnegative(),
 exhausted:z.number().int().nonnegative(),
 overdue:z.number().int().nonnegative(),
 leased:z.number().int().nonnegative(),
});

export async function GET(request:Request){
 const expected=process.env.OWNER_EMAIL_DISPATCH_TOKEN;
 const supplied=request.headers.get("authorization")?.replace(/^Bearer /,"")??"";
 if(!expected||expected.length<32||expected.length!==supplied.length||
   !timingSafeEqual(Buffer.from(supplied),Buffer.from(expected))){
  return new Response(null,{status:404,headers:{"Cache-Control":"no-store"}});
 }
 try{
  const {data,error}=await storageAdmin().rpc("service_owner_notice_queue_health");
  const parsed=summary.safeParse(data);
  if(error||!parsed.success)return Response.json({status:"unavailable"},{
   status:503,headers:{"Cache-Control":"no-store"}
  });
  return Response.json({status:"ok",...parsed.data},{headers:{"Cache-Control":"no-store"}});
 }catch{
  return Response.json({status:"unavailable"},{status:503,headers:{"Cache-Control":"no-store"}});
 }
}
