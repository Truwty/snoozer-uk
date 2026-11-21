import { z } from "zod";

// The database RPC returns only aggregates from the signed-in seller's
// retained sandbox orders. No buyer, charge, payment or receipt identifiers.
const count = z.number().int().nonnegative().max(500);
const pence = z.number().int().nonnegative().max(50000000);
export const creatorStorefrontAnalytics = z.object({
  retainedOrders: count,
  pendingOrders: count,
  expiredOrders: count,
  paidOrders: count,
  heldPaidOrders: count,
  downloadableOrders: count,
  grossTestPence: pence,
  days: z.array(z.object({
    day: z.iso.date(),
    orders: count,
    paid: count,
    grossTestPence: pence,
  })).length(14),
}).superRefine((report, context) => {
  if (report.pendingOrders + report.expiredOrders + report.paidOrders !== report.retainedOrders ||
    report.heldPaidOrders > report.paidOrders ||
    report.downloadableOrders > report.paidOrders ||
    report.heldPaidOrders + report.downloadableOrders > report.paidOrders) {
    context.addIssue({code:"custom",message:"Inconsistent creator order totals."});
  }
});

export type CreatorStorefrontAnalytics = z.infer<typeof creatorStorefrontAnalytics>;
export function formatTestPence(value: number) {
  return new Intl.NumberFormat("en-GB",{style:"currency",currency:"GBP"}).format(value / 100);
}
