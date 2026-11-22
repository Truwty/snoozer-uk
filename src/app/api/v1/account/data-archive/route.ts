import {sessionClient} from "@/lib/supabase";
import {z} from "zod";

export const runtime="nodejs";
export const dynamic="force-dynamic";

const archive=z.object({
 schema_version:z.literal(1),
 scope:z.literal("first-party-app-records"),
 profiles:z.array(z.record(z.string(),z.unknown())),
 profile_links:z.array(z.record(z.string(),z.unknown())),
 gallery_metadata:z.array(z.record(z.string(),z.unknown())),
 media_folders:z.array(z.record(z.string(),z.unknown())),
 entitlement_grants:z.array(z.record(z.string(),z.unknown())),
 account_restrictions:z.array(z.record(z.string(),z.unknown())),
 moderation_appeals:z.array(z.record(z.string(),z.unknown())),
 privacy_requests:z.array(z.record(z.string(),z.unknown())),
 account_notifications:z.array(z.record(z.string(),z.unknown())),
});

function unavailable(status:number){
 return Response.json({error:"Archive unavailable. Sign in with a verified account or request a reviewed full export."},
  {status,headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
}

export async function GET(){
 try{
  const client=await sessionClient();
  const {data:identity,error:authError}=await client.auth.getUser();
  if(authError||!identity.user?.email_confirmed_at)return unavailable(401);

  // The database RPC independently checks auth.uid() and verifies the active
  // Supabase Auth session, including for otherwise restricted users.
  const {data,error}=await client.rpc("my_extended_account_archive");
  const result=archive.safeParse(data);
  if(error||!result.success)return unavailable(503);

  const payload={
   generated_at:new Date().toISOString(),
   account:{id:identity.user.id,email:identity.user.email??null,
    created_at:identity.user.created_at,
    email_confirmed_at:identity.user.email_confirmed_at},
   ...result.data,
   limitations:[
    "This is a first-party app record archive, not a complete statutory data export.",
    "Private Storage file bytes, historical analytics, billing processor records, and third-party processor data are not included.",
    "Request a reviewed complete export through /account/data for these remaining categories."
   ]
  };
  return new Response(JSON.stringify(payload,null,2),{status:200,headers:{
   "Content-Type":"application/json; charset=utf-8",
   "Content-Disposition":'attachment; filename="snoozer-app-data-archive.json"',
   "Cache-Control":"private, no-store, max-age=0",
   "X-Content-Type-Options":"nosniff",
   "Referrer-Policy":"no-referrer",
  }});
 }catch{return unavailable(503);}
}
