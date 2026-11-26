import { z } from "zod";
import { anonymousClient } from "@/lib/supabase";

export const dynamic="force-dynamic";
const idSchema=z.uuid();
const pasteSchema=z.object({title:z.string().max(80),body:z.string().max(16384),updated_at:z.string()});

export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}) {
 const {id}=await params;
 if(!idSchema.safeParse(id).success)return new Response("Not found.",{status:404,headers:headers()});
 try {
  const {data,error}=await anonymousClient().rpc("get_public_image_host_text_paste",{p_id:id});
  const paste=pasteSchema.safeParse(data);
  if(error||!paste.success)return new Response("Not found.",{status:404,headers:headers()});
  return new Response(paste.data.body,{status:200,headers:{...headers(),"Content-Type":"text/plain; charset=utf-8","Content-Disposition":'inline; filename="paste.txt"'}});
 } catch {
  return new Response("Paste unavailable.",{status:503,headers:headers()});
 }
}

function headers():Record<string,string> {
 return {"Cache-Control":"private, no-store, max-age=0","X-Content-Type-Options":"nosniff",
  "Referrer-Policy":"no-referrer","Content-Security-Policy":"default-src 'none'; frame-ancestors 'none'; sandbox"};
}
