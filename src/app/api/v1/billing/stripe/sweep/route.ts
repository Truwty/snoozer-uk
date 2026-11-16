import Stripe from "stripe";
import { z } from "zod";
import { stripeOperatorStatus } from "@/lib/stripe-sandbox-recovery";
import { reconcileSandboxSubscription } from "@/lib/stripe-sandbox-reconciliation";
import { storageAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

const batch = z.array(z.object({ subscription_id: z.string().regex(/^sub_[A-Za-z0-9]{1,128}$/) })).max(5);

export async function POST(request: Request) {
  const status = stripeOperatorStatus(request, process.env.STRIPE_SANDBOX_RECOVERY_TOKEN);
  if (status !== 200) return new Response(null, { status });

  const key = process.env.STRIPE_SANDBOX_API_KEY;
  if (!key || !/^(rk|sk)_test_/.test(key) || process.env.STRIPE_SANDBOX_GRANTS_ENABLED !== "true") {
    return new Response(null, { status: 503 });
  }

  try {
    const { data, error } = await storageAdmin().rpc("claim_stripe_sandbox_sweep");
    if (error) return new Response(null, { status: 503 });
    const stripe = new Stripe(key, { timeout: 5000, maxNetworkRetries: 0 });
    const subscriptions = batch.parse(data);
    const results = await Promise.allSettled(subscriptions.map(({ subscription_id }) =>
      reconcileSandboxSubscription(stripe, { type: "sweep", objectId: subscription_id }, subscription_id, true),
    ));
    const changed = results.filter((result) => result.status === "fulfilled" && result.value === true).length;
    const failed = results.filter((result) => result.status === "rejected").length;
    return Response.json({ checked: results.length, changed, failed }, {
      status: failed > 0 ? 503 : 200, headers: { "cache-control": "no-store" },
    });
  } catch {
    return new Response(null, { status: 503 });
  }
}
