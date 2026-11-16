import { receiveKofiWebhook } from "@/lib/kofi-webhook";
import { storageAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

export function POST(request: Request) {
  return receiveKofiWebhook(request, process.env.KOFI_WEBHOOK_TOKEN, async (receipt) => {
    const { error } = await storageAdmin().rpc("record_kofi_donation", {
      p_message: receipt.id, p_transaction: receipt.transactionId,
      p_occurred_at: receipt.occurredAt, p_amount: receipt.amount,
    });
    if (error) throw new Error("Ko-fi receipt could not be saved.");
  });
}
