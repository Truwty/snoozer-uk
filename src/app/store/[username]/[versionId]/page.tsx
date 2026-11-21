import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Brand } from "@/components/shell";
import { CreatorBuyForm } from "@/components/creator-buy-form";
import { creatorCheckoutConfig } from "@/lib/creator-checkout";
import { creatorStore } from "@/lib/creator-store";
import { publicStock } from "@/lib/creator-stock";
import { purchaseSupportHref } from "@/lib/creator-purchase-support";
import { refreshCreatorStore } from "@/lib/creator-store-server";
import { canonicalUsername, username } from "@/lib/profile";
import { anonymousClient } from "@/lib/supabase";

// Only sandbox offers reviewed for a short period can appear here. This
// detail page is not an independent offer or payment-authorisation path.
export const metadata = {
  title: "Sandbox product details",
  description: "Operator-reviewed Snoozer PDF test product. No live selling.",
  robots: { index: false, follow: false },
};

export default async function Page({
  params,
}: {
  params: Promise<{ username: string; versionId: string }>;
}) {
  if (!creatorCheckoutConfig()) notFound();
  const { username: input, versionId } = await params;
  const name = canonicalUsername(input);
  if (!username.safeParse(name).success || !z.uuid().safeParse(versionId).success) notFound();

  // Reuse the existing connected-seller readiness lease. A failure cannot
  // manufacture product data or override the database's reviewed-offer gate.
  await refreshCreatorStore(name, null);
  const response = await anonymousClient().rpc("get_creator_sandbox_store", { p_name: name });
  if (response.error) throw new Error("The sandbox store is temporarily unavailable.");
  if (!response.data) notFound();

  const store = creatorStore.parse(response.data);
  if (store.username !== name) notFound();
  const item = store.items.find(product => product.versionId === versionId);
  if (!item) notFound();
  const stockResponse=await anonymousClient().rpc("get_creator_sandbox_stock",{p_name:name});
  if(stockResponse.error) throw new Error("Limited inventory status is temporarily unavailable.");
  const stock=publicStock.parse(stockResponse.data);
  const limited=stock.find(row=>row.versionId===item.versionId);


  return <main className="shell stack">
    <header className="nav">
      <Brand />
      <Link className="button small" href={`/store/${store.username}`}>Back to sandbox store</Link>
      <Link className="button small" href="/studio/purchases">Your purchases</Link>
    </header>
    <article className="panel stack" style={{ overflowWrap: "anywhere" }}>
      <p className="eyebrow">SANDBOX / PRODUCT DETAILS</p>
      <h1>{item.title}</h1>
      <p>By {store.displayName} · £{(item.amount / 100).toFixed(2)} GBP</p>
      <p>PDF · {Math.ceil(item.bytes / 1024)} KB</p>
      <p style={{ whiteSpace: "pre-wrap" }}>{item.description || "No description provided."}</p>
      <p>Operator-reviewed test file only. Not a live product. Sign in with a verified account to open Stripe test Checkout; creators cannot purchase their own file.</p>
      <p>Download access lasts 30 days after payment verification. Refunds, disputes and fraud review pause access. Checkout returns do not prove payment. Test receipts are not tax invoices.</p>
      {limited&&<p>{limited.remaining} limited test slots unreserved. An unpaid Checkout reservation also consumes a slot.</p>}
      <CreatorBuyForm versionId={item.versionId} soldOut={limited?.remaining===0} />
      <div className="actions">
        <Link href={`/${store.username}`}>Creator profile</Link>
        <Link href={`/studio/product-reports?version=${item.versionId}`}>Report this product</Link>
        <a href={purchaseSupportHref}>Purchase support</a>
      </div>
    </article>
  </main>;
}
