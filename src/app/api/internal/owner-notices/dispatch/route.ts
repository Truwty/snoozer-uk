import {timingSafeEqual} from "node:crypto";
import {dispatchOwnerNoticeEmails} from "@/lib/owner/notification-delivery";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(request:Request){
 const expected=process.env.OWNER_EMAIL_DISPATCH_TOKEN;
 const supplied=request.headers.get("authorization")?.replace(/^Bearer /,"")??"";
 // Do not expose whether the email sender is configured before authenticating.
 if(!expected||expected.length<32||supplied.length!==expected.length||
   !timingSafeEqual(Buffer.from(supplied),Buffer.from(expected))){
  return new Response(null,{status:404,headers:{"Cache-Control":"no-store"}});
 }
 const result=await dispatchOwnerNoticeEmails();
 return Response.json(result,{status:result.status==="unavailable"?503:200,headers:{"Cache-Control":"no-store"}});
}
