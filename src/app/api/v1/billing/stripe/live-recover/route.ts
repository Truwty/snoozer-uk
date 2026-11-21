import Stripe from "stripe";
import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { boundedBody } from "@/lib/bounded-request";
import { premiumLiveReadConfig } from "@/lib/premium-live-config";
import { processPremiumLiveEvent } from "@/lib/premium-live-webhook";
import { reconcilePremiumLiveSubscription } from "@/lib/premium-live-reconciliation";
import { storageAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const input = z.union([
  z.object({ eventId: z.string().regex(/^evt_[A-Za-z0-9]{1,128}$/) }),
  z.object({ limit: z.number().int().min(1).max(5) }),
]);

function authorized(request: Request) {
  const expected = process.env.STRIPE_PREMIUM_LIVE_RECOVERY_TOKEN;
  const value = request.headers.get("authorization");
  if (!expected || expected.length < 32 || !value?.startsWith("Bearer ")) return false;
  const supplied = value.slice(7);
  // Compare fixed-length digests, not variable-length input buffers.
  return timingSafeEqual(createHash("sha256").update(supplied).digest(), createHash("sha256").update(expected).digest());
}

export async function POST(request: Request) {
  if (!authorized(request)) return new Response(null, { status: 403 });
  const config = premiumLiveReadConfig();
  if (!config) return new Response(null, { status: 503 });
  let params: z.infer<typeof input>;
  try {
    const body = await boundedBody(request, 4096);
    if (!body) return new Response(null, { status: 413 });
    params = input.parse(JSON.parse(body.toString("utf8")));
  } catch {
    return new Response(null, { status: 400 });
  }
  try {
    const stripe = new Stripe(config.key, { timeout: 8000, maxNetworkRetries: 0 });
    const account = await stripe.accounts.retrieve(config.accountId);
    if (account.id !== config.accountId) throw new Error("Unexpected provider account.");
    if ("eventId" in params) {
      const event = await stripe.events.retrieve(params.eventId);
      if (!event.livemode || event.account) throw new Error("Unexpected event type or account.");
      await processPremiumLiveEvent(stripe, event);
      return new Response(null, { status: 204 });
    }
    const response = await storageAdmin().rpc("list_premium_live_reconcile_candidates", { p_limit: params.limit });
    if (response.error || !Array.isArray(response.data)) throw new Error("Reconcile list unavailable.");
    let checked = 0;
    for (const entry of response.data) {
      if (typeof entry.subscription_id !== "string") throw new Error("Invalid subscription candidate.");
      await reconcilePremiumLiveSubscription(stripe, entry.subscription_id);
      checked++;
    }
    return Response.json({ checked }, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch {
    return new Response(null, { status: 503 });
  }
}
