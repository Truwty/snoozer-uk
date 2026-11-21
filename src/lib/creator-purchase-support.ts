import type { z } from "zod";
import { creatorPurchases } from "./creator-purchases";

export const purchaseSupportHref = "mailto:SnoozerSupport@Snoozer.uk";

type Order = z.infer<typeof creatorPurchases>[number];

/**
 * Buyer-facing assistance only. These strings never confer access, change order
 * state or substitute for the existing server-side Stripe verification.
 */
export function purchaseSupportGuidance(order: Pick<Order, "state" | "held" | "accessActive">) {
  if (order.held) return {
    heading: "Delivery on hold",
    guidance: "A refund, dispute or fraud review may prevent this file being delivered. Checking status will not remove an active hold. Contact support with your purchase reference; do not share card or login details.",
  };
  if (order.state === "pending") return {
    heading: "Payment verification pending",
    guidance: "Returning from Stripe is not proof of payment. Use Check payment status. If your payment has been taken but this remains pending, contact support with the purchase reference. Do not pay again until the first attempt is resolved.",
  };
  if (order.state === "expired") return {
    heading: "Checkout not completed",
    guidance: "This Checkout expired or failed and does not grant a download. If you see a charge, contact support with the purchase reference so the attempt can be reconciled before trying again.",
  };
  if (order.accessActive) return {
    heading: "Download available",
    guidance: "Use Verify payment and download PDF. Each download still checks the current payment and risk state. If it fails, check payment status, then contact support with the purchase reference.",
  };
  return {
    heading: "Download not currently available",
    guidance: "Payment was previously confirmed, but this page does not currently report active download access. Check payment status. The 30-day download window cannot be extended automatically; contact support with the purchase reference if you believe this is incorrect.",
  };
}
