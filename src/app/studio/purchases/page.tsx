import Link from "next/link";
import { Brand } from "@/components/shell";
import { PurchaseRefresh } from "@/components/purchase-refresh";
import { creatorPurchases,purchaseHoldLabels } from "@/lib/creator-purchases";
import { purchaseSupportGuidance, purchaseSupportHref } from "@/lib/creator-purchase-support";
import { requireAccount } from "@/lib/profiles-server";

export const metadata={title:"Sandbox purchases",robots:{index:false,follow:false}};
export default async function Page() {
  const {client}=await requireAccount();
  const response=await client.rpc("list_my_creator_sandbox_orders");const purchases=creatorPurchases.safeParse(response.data);
  return <main className="shell stack"><header className="nav"><Brand/><Link className="button small" href="/studio">Back to Studio</Link></header>
    <section className="panel stack"><p className="eyebrow">STUDIO / SANDBOX</p><h1>Your purchases</h1>
      <p>Test purchases only. This is not a tax invoice. A return from Checkout does not confirm payment. Downloads require current Stripe verification on every request.</p>
      <p>Confirmed payments allow downloads for 30 days from first verification. Refunds, disputes or fraud review pause delivery. Order references are retained for at least 90 days; pending attempts need reconciliation before removal.</p>
      {response.error||!purchases.success?<p role="alert">Your purchase history is unavailable. Reload to try again.</p>:purchases.data.length===0?<p>No sandbox purchases yet.</p>:purchases.data.map(order=><article className="panel stack" key={order.id} style={{overflowWrap:"anywhere"}}>
        <h2>{order.title}</h2><p>£{(order.amount/100).toFixed(2)} GBP · {order.held?"Delivery paused for review":order.state==="paid"?"Payment confirmed":order.state==="expired"?"Checkout expired or failed":"Awaiting payment verification"}</p>
        {order.originalAmount!==undefined&&order.originalAmount>order.amount&&<p>Original price £{(order.originalAmount/100).toFixed(2)} · Discount £{((order.originalAmount-order.amount)/100).toFixed(2)}</p>}
        {order.paidAt&&<p>First payment verification: <time dateTime={order.paidAt}>{new Date(order.paidAt).toUTCString()}</time></p>}
        {order.held&&purchaseHoldLabels(order.holds).length>0&&<p>Recorded delivery restrictions: {purchaseHoldLabels(order.holds).join("; ")}. These are stored safeguards, not a refund settlement or accusation.</p>}
        <p>Purchase reference: <code>{order.id}</code></p>
        {order.state==="paid"&&<a className="text-link" href={`/studio/purchases/receipt/${order.id}`} download>Download sandbox receipt (not a tax invoice)</a>}
        {order.accessUntil&&<p>Download expiry: <time dateTime={order.accessUntil}>{new Date(order.accessUntil).toUTCString()}</time></p>}
        {order.accessActive&&!order.held&&<a className="text-link" href={`/studio/purchases/file/${order.id}`} download>Verify payment and download PDF</a>}
        <section aria-label="Purchase assistance" className="stack">
          <h3>{purchaseSupportGuidance(order).heading}</h3>
          <p>{purchaseSupportGuidance(order).guidance}</p>
          <PurchaseRefresh id={order.id}/>
          <a href={purchaseSupportHref}>Email Snoozer support</a>
        </section>
      </article>)}
    </section></main>;
}
