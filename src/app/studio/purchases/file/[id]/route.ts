import { createHash } from "node:crypto";
import { z } from "zod";
import { refreshCreatorPurchase } from "@/lib/creator-purchases-server";
import { checkProductPdf,productFile,productFileBucket,productFilePath } from "@/lib/product-files";
import { sessionClient,storageAdmin } from "@/lib/supabase";

const purchaseFile=productFile.extend({orderId:z.uuid(),versionId:z.uuid(),sha256:z.string().regex(/^[0-9a-f]{64}$/)});
const unavailable=(status:number)=>new Response(null,{status,headers:{"Cache-Control":"private, no-store",...(status===429?{"Retry-After":"10"}:{})}});

export async function GET(_:Request,{params}:{params:Promise<{id:string}>}) {
  const {id}=await params;
  if(!z.uuid().safeParse(id).success) return unavailable(404);
  try {
    const client=await sessionClient();const user=await client.auth.getUser();
    if(user.error&&(user.error.status===0||(user.error.status??0)>=500)) return unavailable(503);
    if(!user.data.user?.email_confirmed_at) return unavailable(404);
    const own=await client.rpc("owns_my_creator_sandbox_order",{p_order:id});
    if(own.error||typeof own.data!=="boolean") return unavailable(503);
    if(!own.data) return unavailable(404);
    const claim=await client.rpc("claim_my_creator_order_check",{p_order:id});
    if(claim.error||typeof claim.data!=="boolean") return unavailable(503);
    if(!claim.data) return unavailable(429);
    const order=await refreshCreatorPurchase(id,user.data.user.id);
    if(order.state!=="paid"||order.holds.length||!order.accessUntil||Date.parse(order.accessUntil)<=Date.now()) return unavailable(404);
    const result=await client.rpc("get_my_creator_order_file",{p_order:id});
    if(result.error) return unavailable(503);
    if(!result.data) return unavailable(404);
    const file=purchaseFile.safeParse(result.data);
    if(!file.success||file.data.orderId!==id||file.data.versionId!==order.versionId||file.data.sha256!==order.sha256
      ||file.data.bytes!==order.bytes||file.data.state!=="ready") return unavailable(503);
    const stored=await storageAdmin().storage.from(productFileBucket).download(productFilePath(file.data));
    if(stored.error||!stored.data||stored.data.size!==file.data.bytes) return unavailable(503);
    const bytes=new Uint8Array(await stored.data.arrayBuffer());
    checkProductPdf(bytes);
    if(createHash("sha256").update(bytes).digest("hex")!==file.data.sha256) return unavailable(503);
    return new Response(bytes,{headers:{"Content-Type":"application/octet-stream","Content-Disposition":'attachment; filename="sandbox-purchase.pdf"',
      "Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Content-Security-Policy":"sandbox; default-src 'none'"}});
  } catch {return unavailable(503);}
}
