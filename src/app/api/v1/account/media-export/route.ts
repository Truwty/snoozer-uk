import {z} from "zod";
import {sessionClient} from "@/lib/supabase";

export const runtime="nodejs";
export const dynamic="force-dynamic";

const item=z.object({
 bucket:z.enum(["avatar-incoming","avatar-images","gallery-incoming","gallery-images"]),
 name:z.string().regex(/^[a-f0-9-]{36}\/[a-f0-9-]{36}\.(webp|upload)$/),
 created_at:z.string().nullable(),
});
const noStore={"Cache-Control":"private, no-store, max-age=0","X-Content-Type-Options":"nosniff"};

export async function GET(){
 try{
  const client=await sessionClient();
  const {data:{user},error:authError}=await client.auth.getUser();
  if(authError||!user?.email_confirmed_at)
   return Response.json({error:"Authentication required"},{status:401,headers:noStore});
  const {data,error}=await client.rpc("my_private_media_export_manifest");
  const result=z.array(item).max(500).safeParse(data);
  if(error||!result.success)
   return Response.json({error:"Media manifest unavailable"},{status:503,headers:noStore});
  return Response.json({
   generated_at:new Date().toISOString(),
   description:"Current private Storage objects belonging to your verified account.",
   files:result.data.map(x=>({
    ...x,
    download_path:"/api/v1/account/media-export/file?bucket="+encodeURIComponent(x.bucket)+"&name="+encodeURIComponent(x.name)
   })),
   limitations:"A maximum of 500 files are listed. Historic/orphaned objects and external processor data require a reviewed export request.",
  },{headers:noStore});
 }catch{
  return Response.json({error:"Media manifest unavailable"},{status:503,headers:noStore});
 }
}
