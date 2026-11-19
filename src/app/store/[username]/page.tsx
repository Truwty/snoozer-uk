import Link from "next/link";
import { notFound } from "next/navigation";
import { Brand } from "@/components/shell";
import { CreatorBuyForm } from "@/components/creator-buy-form";
import { creatorCheckoutConfig } from "@/lib/creator-checkout";
import { creatorStore } from "@/lib/creator-store";
import { refreshCreatorStore } from "@/lib/creator-store-server";
import { canonicalUsername,username } from "@/lib/profile";
import { anonymousClient } from "@/lib/supabase";

export const metadata={title:"Sandbox creator store",robots:{index:false,follow:false}};
export default async function Page({params}:{params:Promise<{username:string}>}) {
  if(!creatorCheckoutConfig()) notFound();
  const name=canonicalUsername((await params).username);if(!username.safeParse(name).success) notFound();
  await refreshCreatorStore(name,null);
  const response=await anonymousClient().rpc("get_creator_sandbox_store",{p_name:name});
  if(response.error) throw new Error("The sandbox store is temporarily unavailable.");
  if(!response.data) notFound();
  const store=creatorStore.parse(response.data);
  if(store.username!==name) notFound();
  return <main className="shell stack"><header className="nav"><Brand/><Link className="button small" href="/studio/purchases">Your purchases</Link></header>
    <section className="panel stack"><p className="eyebrow">SANDBOX / CREATOR STORE</p><h1>{store.displayName}’s test store</h1>
      <p>Operator-reviewed test PDFs only. No live selling. Sign in with a verified account to test Checkout; you cannot buy your own product.</p>
      <p>Downloads expire 30 days after first payment verification. Refunds, disputes and fraud review pause delivery. Order references remain for at least 90 days; pending attempts require reconciliation. Test receipts are not tax invoices.</p>
      <div className="actions"><Link href={`/${store.username}`}>Creator profile</Link><Link href="/#contact">Purchase support</Link></div>
      {store.items.length===0?<p>No test products are currently available.</p>:store.items.map(item=><article className="panel stack" key={item.versionId}>
        <h2>{item.title}</h2><p style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{item.description||"No description."}</p>
        <p>£{(item.amount/100).toFixed(2)} GBP · PDF · {Math.ceil(item.bytes/1024)} KB</p><CreatorBuyForm versionId={item.versionId}/>
      </article>)}
    </section></main>;
}
