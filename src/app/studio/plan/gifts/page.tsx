import { createHash, randomUUID } from "node:crypto";
import Link from "next/link";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Brand } from "@/components/shell";
import { supabaseKey, supabaseUrl } from "@/lib/env";
import { requireAccount } from "@/lib/profiles-server";
import { paidGiftCode, sandboxPaidGiftConfiguration } from "@/lib/stripe-sandbox-paid-gift";
import { startSandboxGiftCheckout } from "./checkout";

export const metadata = { title: "Sandbox plan gifts", robots: { index: false, follow: false } };
const plan = z.enum(["plus", "pro", "studio"]);
const offersShape = z.array(z.object({
  id: z.uuid(), plan, duration_days: z.number().int().positive(), amount_pence: z.number().int().positive(),
}));
const ordersShape = z.array(z.object({
  order_id: z.uuid(), plan, status: z.enum(["ready", "revoked", "redeemed", "expired"]), code_hash: z.string().nullable(),
}));
const labels = { plus: "Plus", pro: "Pro", studio: "Studio" };
const price = new Intl.NumberFormat("en-GB", { currency: "GBP", style: "currency" });

export default async function GiftsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  if (!supabaseUrl || !supabaseKey) redirect("/sign-in");
  const { client } = await requireAccount();
  const config = sandboxPaidGiftConfiguration();
  if (!config) redirect("/studio/plan");

  const [{ status }, offerResponse, orderResponse] = await Promise.all([
    searchParams, client.rpc("list_stripe_sandbox_gift_offers"), client.rpc("list_my_stripe_sandbox_gifts"),
  ]);
  const offers = offersShape.safeParse(offerResponse.data);
  const orders = ordersShape.safeParse(orderResponse.data);

  return <main className="shell">
    <header className="nav"><Brand /><Link className="button small" href="/studio/plan">Back to plan and usage</Link></header>
    <section className="panel stack">
      <h1>Sandbox plan gifts</h1>
      {status === "pending" && <p role="status">Check your gifts below. If your payment is still pending, refresh after confirmation.</p>}
      {status === "unavailable" && <p role="alert">Could not open test Checkout. Try again later.</p>}
      {offers.success ? offers.data.map((offer) => <form key={offer.id} action={startSandboxGiftCheckout}>
        <input name="offer" type="hidden" value={offer.id} />
        <input name="request" type="hidden" value={randomUUID()} />
        <button className="button small" type="submit">
          {labels[offer.plan]} · {offer.duration_days} days · {price.format(offer.amount_pence / 100)} · Test checkout
        </button>
      </form>) : <p role="alert">Gift offers are temporarily unavailable.</p>}
      {offers.success && offers.data.length === 0 && <p>No sandbox gift offers are available.</p>}
      <h2>Your gifts</h2>
      {orders.success ? orders.data.map((order) => {
        const candidate = order.status === "ready" ? paidGiftCode(order.order_id, config.giftSecret) : null;
        const code = candidate && createHash("sha256").update(candidate).digest("hex") === order.code_hash ? candidate : null;
        return <div key={order.order_id}>
          <strong>{labels[order.plan]}</strong>{" · "}{code ? <code>{code}</code> : order.status === "ready" ? "Code unavailable" : order.status}
        </div>;
      }) : <p role="alert">Purchased gifts are temporarily unavailable.</p>}
      {orders.success && orders.data.length === 0 && <p>No confirmed gift purchases yet.</p>}
    </section>
  </main>;
}
