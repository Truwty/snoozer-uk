import Stripe from "stripe";
import { recoverStripeSandboxEvent } from "@/lib/stripe-sandbox-recovery";
import { processStripeSandboxReceipt } from "@/lib/stripe-sandbox-receipt";

export const runtime = "nodejs";

export function POST(request: Request) {
  const key = process.env.STRIPE_SANDBOX_API_KEY;
  if (!key || !/^(rk|sk)_test_/.test(key)) return new Response(null, { status: 503 });
  const stripe = new Stripe(key, { timeout: 5000, maxNetworkRetries: 0 });
  return recoverStripeSandboxEvent(
    request, process.env.STRIPE_SANDBOX_RECOVERY_TOKEN,
    async (id) => stripe.events.retrieve(id),
    (receipt) => processStripeSandboxReceipt(receipt, stripe),
  );
}
