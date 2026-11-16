import Stripe from "stripe";
import { processStripeSandboxReceipt } from "@/lib/stripe-sandbox-receipt";
import { receiveStripeWebhook } from "@/lib/stripe-webhook";

export const runtime = "nodejs";

export function POST(request: Request) {
  return receiveStripeWebhook(request, process.env.STRIPE_SANDBOX_WEBHOOK_SECRET, (receipt) => {
    const key = process.env.STRIPE_SANDBOX_API_KEY;
    const stripe = key && /^(rk|sk)_test_/.test(key)
      ? new Stripe(key, { timeout: 5000, maxNetworkRetries: 0 }) : undefined;
    return processStripeSandboxReceipt(receipt, stripe);
  });
}
