import { createHash, timingSafeEqual } from "node:crypto";
import { boundedBody } from "./bounded-request";
import { stripeSandboxReceipt, type StripeReceipt } from "./stripe-webhook";

const digest = (value: string) => createHash("sha256").update(value).digest();

export async function recoverStripeSandboxEvent(
  request: Request,
  token: string | undefined,
  retrieve: (id: string) => Promise<unknown>,
  process: (receipt: StripeReceipt) => Promise<void>,
) {
  if (!token || token.length < 32) return new Response(null, { status: 503 });
  const authorization = request.headers.get("authorization") ?? "";
  if (!timingSafeEqual(digest(authorization), digest("Bearer " + token))) return new Response(null, { status: 401 });
  let eventId: string;
  try {
    const body = await boundedBody(request, 1024);
    if (!body) return new Response(null, { status: 413 });
    const input = JSON.parse(body.toString("utf8"));
    if (typeof input?.id !== "string" || !/^evt_[A-Za-z0-9]{1,128}$/.test(input.id)) {
      return new Response(null, { status: 400 });
    }
    eventId = input.id;
  } catch {
    return new Response(null, { status: 400 });
  }
  try {
    const receipt = stripeSandboxReceipt(await retrieve(eventId));
    if (!receipt || receipt.id !== eventId) return new Response(null, { status: 422 });
    await process(receipt);
    return new Response(null, { status: 204 });
  } catch {
    return new Response(null, { status: 503 });
  }
}
