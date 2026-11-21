import Link from "next/link";
import { notFound } from "next/navigation";
import { Brand } from "@/components/shell";
import {membershipCheckoutConfig} from "@/lib/creator-membership-provider";
import { z } from "zod";
import {CreatorMembershipPanel} from "@/components/creator-membership-panel";
import { CreatorTipPanel } from "@/components/creator-tip-panel";
import { creatorTipUrl } from "@/lib/creator-tips";
import { readPublished } from "@/lib/profiles-server";
import { CreatorBuyForm } from "@/components/creator-buy-form";
import { creatorCheckoutConfig } from "@/lib/creator-checkout";
import { creatorStore } from "@/lib/creator-store";
import { publicStock } from "@/lib/creator-stock";
import { publicCreatorCollections } from "@/lib/creator-collections";
import { purchaseSupportHref } from "@/lib/creator-purchase-support";
import { refreshCreatorStore } from "@/lib/creator-store-server";
import { canonicalUsername,username } from "@/lib/profile";
import { anonymousClient } from "@/lib/supabase";

export const metadata={title:"Sandbox creator store",description:"A private test store for checking Snoozer creator checkout flows.",robots:{index:false,follow:false}};
export default async function Page({params}:{params:Promise<{username:string}>}) {
  if(!creatorCheckoutConfig()) notFound();
  const name=canonicalUsername((await params).username);if(!username.safeParse(name).success) notFound();
  await refreshCreatorStore(name,null);
  const response=await anonymousClient().rpc("get_creator_sandbox_store",{p_name:name});
  if(response.error) throw new Error("The sandbox store is temporarily unavailable.");
  if(!response.data) notFound();
  const store=creatorStore.parse(response.data);
  if(store.username!==name) notFound();
  // Optional third-party link comes only from the independently published
  // profile, and never affects canonical test-store eligibility or Checkout.
  const publicProfile=await readPublished(name).catch(()=>null);
  const tips=publicProfile?.username===name?creatorTipUrl(publicProfile.links):null;

  const membershipResponse=await anonymousClient().rpc("get_creator_sandbox_membership_offers",{p_name:name});
  const memberships=membershipResponse.error?[]:membershipResponse.data;
  const eligibility=membershipCheckoutConfig()?await anonymousClient().rpc("get_creator_membership_checkout_offers",{p_name:name}):null;
  const approved=z.array(z.uuid()).max(5).safeParse(eligibility?.data);
  const checkoutOffers=eligibility&&!eligibility.error&&approved.success?approved.data:[];

  const stockResponse=await anonymousClient().rpc("get_creator_sandbox_stock",{p_name:name});
  if(stockResponse.error) throw new Error("Limited inventory status is temporarily unavailable.");
  const stock=publicStock.parse(stockResponse.data);
  const remaining=new Map(stock.map(row=>[row.versionId,row.remaining]));

  const disclosureResponse=await anonymousClient().rpc("get_creator_sandbox_affiliate_disclosure",{p_name:name});
  if(disclosureResponse.error) throw new Error("Sandbox disclosure is temporarily unavailable.");
  const disclosure=disclosureResponse.data===null?null:
    typeof disclosureResponse.data==="string"&&disclosureResponse.data.length<=500?disclosureResponse.data:null;

  const collectionsResponse=await anonymousClient().rpc("get_creator_sandbox_collections",{p_name:name});
  if(collectionsResponse.error) throw new Error("Sandbox collections are temporarily unavailable.");
  const collectionGroups=publicCreatorCollections.parse(collectionsResponse.data);
  const selected=collectionGroups.map(group=>({
    ...group,
    items:group.versionIds.flatMap(versionId=>store.items.filter(item=>item.versionId===versionId)),
  })).filter(group=>group.items.length>0);

  return <main className="shell stack"><header className="nav"><Brand/><Link className="button small" href="/studio/purchases">Your purchases</Link></header>
    <section className="panel stack"><p className="eyebrow">SANDBOX / CREATOR STORE</p><h1>{store.displayName}’s test store</h1>
      <p>Operator-reviewed test PDFs only. No live selling. Sign in with a verified account to test Checkout; you cannot buy your own product.</p>
      <p>Downloads expire 30 days after first payment verification. Refunds, disputes and fraud review pause delivery. Order references remain for at least 90 days; pending attempts require reconciliation. Test receipts are not tax invoices.</p>
      {disclosure&&<aside className="panel stack" aria-label="Affiliate disclosure">
        <strong>Affiliate / sponsorship disclosure</strong>
        <p style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{disclosure}</p>
      </aside>}
      <div className="actions"><Link href={`/${store.username}`}>Creator profile</Link><a href={purchaseSupportHref}>Purchase support</a></div>
      <CreatorTipPanel href={tips}/>
      {store.items.length>0&&<CreatorMembershipPanel offers={memberships} checkoutOffers={checkoutOffers} name={name}/> }
      {selected.length>0&&<section className="stack" aria-label="Reviewed product collections">
        <h2>Collections</h2>
        {selected.map(group=><section className="panel stack" key={group.id}>
          <h3>{group.title}</h3>
          {group.description&&<p style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{group.description}</p>}
          <ul>{group.items.map(item=><li key={item.versionId}>
            <Link href={`/store/${store.username}/${item.versionId}`}>{item.title}</Link>
            {" "}· £{(item.amount/100).toFixed(2)} GBP
          </li>)}</ul>
        </section>)}
        <p className="muted">Groups do not change product review, Checkout availability or buyer access.</p>
      </section>}
      {store.items.length===0?<p>No test products are currently available.</p>:store.items.map(item=><article className="panel stack" key={item.versionId}>
        <h2>{item.title}</h2><p style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{item.description||"No description."}</p>
        <Link href={`/store/${store.username}/${item.versionId}`}>View full test product details</Link>
        <p>£{(item.amount/100).toFixed(2)} GBP · PDF · {Math.ceil(item.bytes/1024)} KB</p>
        {remaining.has(item.versionId)&&<p>{remaining.get(item.versionId)} limited test slots unreserved</p>}
        <CreatorBuyForm versionId={item.versionId} soldOut={remaining.get(item.versionId)===0}/>
      </article>)}
    </section></main>;
}
