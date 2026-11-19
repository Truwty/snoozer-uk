import { z } from "zod";
import { boundedBody } from "./bounded-request";
import { stripeAccountId } from "./creator-merchant";
import { stripeOperatorStatus } from "./stripe-sandbox-recovery";
import type { CreatorReceipt } from "./creator-webhook";

const eventId=z.string().regex(/^evt_[A-Za-z0-9]{1,128}$/);
const input=z.strictObject({id:eventId.optional(),limit:z.number().int().min(1).max(10).default(1)});
const receipt=z.object({id:eventId,accountId:stripeAccountId,type:z.string().min(1).max(100),objectId:z.string().min(1).max(263),occurredAt:z.iso.datetime({offset:true})});
type Batch={id?:string;limit:number};

export async function recoverCreatorReceipts(request:Request,token:string|undefined,load:(input:Batch)=>Promise<unknown>,claim:(id:string)=>Promise<boolean>,process:(receipt:CreatorReceipt)=>Promise<void>) {
  const status=stripeOperatorStatus(request,token);
  if(status!==200) return new Response(null,{status});
  let selection:Batch;
  try {
    const body=await boundedBody(request,1024);if(!body) return new Response(null,{status:413});
    selection=input.parse(JSON.parse(body.toString("utf8")));
  } catch {return new Response(null,{status:400});}
  try {
    const items=z.array(receipt).max(selection.id?1:selection.limit).parse(await load(selection));
    if(selection.id&&(!items.length||items[0].id!==selection.id)) return new Response(null,{status:404});
    if(new Set(items.map(r=>r.id)).size!==items.length) throw new Error("Duplicate retry projection.");
    let attempted=0,processed=0,failed=0;
    for(const item of items) {
      if(!await claim(item.id)) continue;
      attempted++;
      try {await process(item);processed++;} catch {failed++;}
    }
    return Response.json({attempted,processed,failed},{status:failed?503:200,headers:{"Cache-Control":"private, no-store"}});
  } catch {return new Response(null,{status:503});}
}
