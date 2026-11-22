import {z} from "zod";
import {sessionClient,storageAdmin} from "@/lib/supabase";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const bucket=z.enum(["avatar-incoming","avatar-images","gallery-incoming","gallery-images"]);
const path=z.string().max(100).regex(/^[a-f0-9-]{36}\/[a-f0-9-]{36}\.(webp|upload)$/);
const headers={"Cache-Control":"private, no-store, max-age=0","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer"};

export async function GET(request:Request){
 const args=new URL(request.url).searchParams;
 const choice=bucket.safeParse(args.get("bucket")),key=path.safeParse(args.get("name"));
 if(!choice.success||!key.success)return new Response(null,{status:400,headers});
 try{
  const client=await sessionClient();
  const {data:{user},error:authError}=await client.auth.getUser();
  if(authError||!user?.email_confirmed_at)return new Response(null,{status:401,headers});
  // Database role-checks the currently verified Auth session and exact
  // object membership under the user's own private media scope.
  const {data:allowed,error}=await client.rpc("my_private_media_export_allowed",{
   p_bucket:choice.data,p_name:key.data
  });
  if(error)return new Response(null,{status:503,headers});
  if(allowed!==true)return new Response(null,{status:404,headers});
  const {data:blob,error:downloadError}=await storageAdmin().storage.from(choice.data).download(key.data);
  if(downloadError||!blob)return new Response(null,{status:503,headers});
  const filename=key.data.split("/")[1];
  return new Response(blob,{status:200,headers:{
   ...headers,
   "Content-Type":filename.endsWith(".webp")?"image/webp":"application/octet-stream",
   "Content-Disposition":'attachment; filename="'+filename+'"',
  }});
 }catch{return new Response(null,{status:503,headers});}
}
