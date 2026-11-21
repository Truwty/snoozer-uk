import {createHash} from "node:crypto";
import {z} from "zod";
import {boundedBody} from "./bounded-request";

const envelope=z.object({verification_token:z.string().min(16).max(128),type:z.string().min(1).max(80)});
const reportedDonation=envelope.extend({
 message_id:z.uuid(),kofi_transaction_id:z.string().min(1).max(128),
 timestamp:z.iso.datetime({offset:true}),type:z.literal("Donation"),
 amount:z.string().regex(/^(?:0|[1-9][0-9]{0,5})\.[0-9]{2}$/),
 currency:z.enum(["GBP","USD"]),
});
export type CreatorKofiNotification={
 tokenSha256:string;messageId:string;transactionId:string;occurredAt:string;
 amountMinor:number;currency:"GBP"|"USD";
};
export async function receiveCreatorKofiNotification(
 request:Request,record:(value:CreatorKofiNotification)=>Promise<boolean>,
) {
 const contentType=request.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
 if(contentType!=="application/x-www-form-urlencoded") return new Response(null,{status:415});
 let data:unknown;
 try {
  const raw=await boundedBody(request,32*1024);
  if(!raw) return new Response(null,{status:413});
  const text=new TextDecoder("utf-8",{fatal:true}).decode(raw);
  const params=new URLSearchParams(text);
  const values=params.getAll("data");
  if(values.length!==1) return new Response(null,{status:400});
  data=JSON.parse(values[0]);
 } catch {return new Response(null,{status:400});}
 const preliminary=envelope.safeParse(data);
 if(!preliminary.success) return new Response(null,{status:400});
 // Ko-fi currently sends only payment notifications. Membership and shop
 // event types are deliberately not treated as creator donation accounting.
 if(preliminary.data.type!=="Donation") return new Response(null,{status:200});
 const payment=reportedDonation.safeParse(data);
 if(!payment.success) return new Response(null,{status:400});
 const amountMinor=Number(payment.data.amount.replace(".",""));
 if(amountMinor<1||amountMinor>99999999) return new Response(null,{status:400});
 const notification:CreatorKofiNotification={
  tokenSha256:createHash("sha256").update(payment.data.verification_token).digest("hex"),
  messageId:payment.data.message_id,transactionId:payment.data.kofi_transaction_id,
  occurredAt:payment.data.timestamp,amountMinor,currency:payment.data.currency,
 };
 try {return new Response(null,{status:await record(notification)?200:401});}
 catch {return new Response(null,{status:503});}
}
