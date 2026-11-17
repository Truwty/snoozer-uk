import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { boundedBody } from "./bounded-request";

const payment = z.object({
  message_id: z.uuid(),
  kofi_transaction_id: z.string().trim().min(1).max(128),
  timestamp: z.iso.datetime({ offset: true }),
  type: z.literal("Donation"),
  amount: z.string().regex(/^(?:0|[1-9][0-9]{0,5})\.[0-9]{2}$/),
  currency: z.enum(["GBP", "USD"]),
});
const digest = (value: string) => createHash("sha256").update(value).digest();

type Receipt = { id: string; transactionId: string; occurredAt: string; amount: number; currency: "GBP" | "USD" };

export async function receiveKofiWebhook(
  request: Request, token: string | undefined, record: (receipt: Receipt) => Promise<void>,
) {
  if (!token) return new Response(null, { status: 503 });
  const contentType = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (contentType !== "application/x-www-form-urlencoded") return new Response(null, { status: 415 });

  let data: unknown;
  try {
    const raw = await boundedBody(request, 32 * 1024);
    if (!raw) return new Response(null, { status: 413 });
    const fields = new URLSearchParams(new TextDecoder("utf-8", { fatal: true }).decode(raw)).getAll("data");
    if (fields.length !== 1) return new Response(null, { status: 400 });
    data = JSON.parse(fields[0]);
  } catch {
    return new Response(null, { status: 400 });
  }

  const envelope = z.object({ verification_token: z.string(), type: z.string() }).safeParse(data);
  if (!envelope.success || !timingSafeEqual(digest(envelope.data.verification_token), digest(token))) {
    return new Response(null, { status: 401 });
  }
  if (envelope.data.type !== "Donation") return new Response(null, { status: 200 });

  const result = payment.safeParse(data);
  if (!result.success) return new Response(null, { status: 400 });
  const amount = Number(result.data.amount.replace(".", ""));
  if (amount <= 0) return new Response(null, { status: 400 });
  try {
    await record({
      id: result.data.message_id, transactionId: result.data.kofi_transaction_id,
      occurredAt: result.data.timestamp, amount, currency: result.data.currency,
    });
  } catch {
    return new Response(null, { status: 503 });
  }
  return new Response(null, { status: 200 });
}
