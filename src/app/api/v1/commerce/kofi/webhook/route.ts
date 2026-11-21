import {receiveCreatorKofiNotification} from "@/lib/creator-kofi-webhook";
import {storageAdmin} from "@/lib/supabase";
export const runtime="nodejs";
export function POST(request:Request) {
 return receiveCreatorKofiNotification(request,async notification=>{
  const result=await storageAdmin().rpc("record_creator_kofi_notification",{
   p_digest:notification.tokenSha256,p_message:notification.messageId,
   p_transaction:notification.transactionId,p_occurred:notification.occurredAt,
   p_amount:notification.amountMinor,p_currency:notification.currency,
  });
  if(result.error||typeof result.data!=="boolean") throw new Error("Creator Ko-fi notification record unavailable.");
  return result.data;
 });
}
