import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { supabaseKey, supabaseUrl } from "@/lib/env";
import { requireAccount } from "@/lib/profiles-server";

export const metadata = { title: "Billing diagnostics", robots: { index: false, follow: false } };

const count = z.number().int().nonnegative();
const diagnostics = z.object({
  stripeSandbox: z.object({
    linkedSubscriptions: count, staleUnboundAttempts: count, unboundCompletionReceipts: count,
    heldInvoices: count, endedSubscriptions: count, giftsAwaitingFulfillment: count,
  }),
  kofi: z.object({ unclaimedReceipts: count, pendingReviews: count }),
  gifts: z.object({ redeemableCodes: count, activeGrants: count }),
});

const sections = {
  stripeSandbox: ["Stripe sandbox", {
    linkedSubscriptions: "Linked subscriptions", staleUnboundAttempts: "Stale Checkout attempts without a session",
    unboundCompletionReceipts: "Checkout receipts without a subscription or gift link",
    giftsAwaitingFulfillment: "Gift orders with a Checkout receipt awaiting fulfillment",
    heldInvoices: "Held invoices", endedSubscriptions: "Ended subscriptions",
  }],
  kofi: ["Ko-fi", { unclaimedReceipts: "Unclaimed receipts", pendingReviews: "Pending reviews" }],
  gifts: ["Gifts", { redeemableCodes: "Redeemable codes", activeGrants: "Active grants" }],
} as const;

export default async function BillingDiagnosticsPage() {
  if (!supabaseUrl || !supabaseKey) redirect("/sign-in");
  const { client } = await requireAccount();
  const { data, error } = await client.rpc("read_staff_billing_diagnostics");
  if (error?.code === "42501") notFound();
  const parsed = diagnostics.safeParse(data);
  return <main className="shell">
    <header className="nav studio-subnav"><Link className="button small" href="/studio/plan">Back to plan and usage</Link></header>
    <section className="panel stack">
      <h1>Billing diagnostics</h1>
      {error || !parsed.success ? <p role="alert">Billing diagnostics are temporarily unavailable.</p>
        : Object.entries(sections).map(([key, [title, labels]]) => {
          const metrics: Record<string, number> = parsed.data[key as keyof typeof sections];
          return <section key={key} className="stack">
            <h2>{title}</h2>
            <dl>{Object.entries(labels).map(([metric, label]) => <div key={metric}>
              <dt>{label}</dt><dd>{metrics[metric].toLocaleString("en-GB")}</dd>
            </div>)}</dl>
          </section>;
        })}
    </section>
  </main>;
}
