import {sessionClient} from "@/lib/supabase";
import {z} from "zod";

export const dynamic="force-dynamic";
const privateRequests=z.array(z.object({
 id:z.uuid(),kind:z.enum(["export","deletion"]),status:z.string(),
 requested_at:z.string(),reviewed_at:z.string().nullable(),owner_response:z.string().nullable()
}));
const notices=z.array(z.object({
 id:z.uuid(),kind:z.string(),title:z.string(),body:z.string(),
 created_at:z.string(),read_at:z.string().nullable()
}));

function error(status:number) {
 return Response.json({error:"Export unavailable. Sign in or request a full data export."},
  {status,headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
}
export async function GET() {
 try {
  const client=await sessionClient();
  const auth=await client.auth.getUser();
  const user=auth.data.user;
  if(auth.error||!user?.email_confirmed_at)return error(401);
  const [privacyResult,noticesResult]=await Promise.all([
   client.rpc("my_privacy_requests"),
   client.rpc("my_account_notifications")
  ]);
  const requests=privateRequests.safeParse(privacyResult.data);
  const notifications=notices.safeParse(noticesResult.data);
  if(privacyResult.error||noticesResult.error||!requests.success||!notifications.success)return error(503);
  // Only fields from the authenticated person's own identity and self-scoped RPCs.
  // This download is deliberately not the statutory full export (which may
  // require manually gathered billing, storage and processor records).
  const payload={
   scope:"basic-account-snapshot",
   version:1,
   generated_at:new Date().toISOString(),
   account:{id:user.id,email:user.email??null,created_at:user.created_at,
    email_confirmed_at:user.email_confirmed_at,phone:user.phone??null,
    last_sign_in_at:user.last_sign_in_at??null},
   privacy_requests:requests.data,
   account_notifications:notifications.data,
   notice:"This is a limited self-service account snapshot. For all personal data, request a full export at /account/data."
  };
  return new Response(JSON.stringify(payload,null,2),{
   status:200,
   headers:{
    "Content-Type":"application/json; charset=utf-8",
    "Content-Disposition":'attachment; filename="snoozer-account-snapshot.json"',
    "Cache-Control":"private, no-store, max-age=0",
    "X-Content-Type-Options":"nosniff",
    "Referrer-Policy":"no-referrer",
   }
  });
 } catch {
  return error(503);
 }
}
