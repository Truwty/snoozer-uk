import Link from "next/link";
import {notFound} from "next/navigation";
import {Brand} from "@/components/shell";
import {ModeratorDecisionForm} from "@/components/creator-product-report-forms";
import {staffProductReports,reasonLabels} from "@/lib/creator-product-moderation";
import {requireAccount} from "@/lib/profiles-server";
export const metadata={title:"Restricted product moderation",robots:{index:false,follow:false}};
export default async function Page() {
 const {client}=await requireAccount();
 const role=await client.rpc("can_moderate_creator_products");
 if(role.error||role.data!==true) notFound();
 const response=await client.rpc("read_creator_product_reports",{p_limit:50});
 const parsed=staffProductReports.safeParse(response.data);
 return <main className="shell stack">
  <header className="nav"><Brand/><Link className="button small" href="/studio/product-reports">Product reports</Link></header>
  <section className="panel stack">
   <p className="eyebrow">RESTRICTED / PRODUCT SAFETY</p><h1>Product moderation queue</h1>
   <p>Only separately assigned moderators may view or resolve reports. Reads and decisions are audited. Quarantine irreversibly blocks the exact version from public review and test buyer file downloads; previously confirmed purchases, receipts and Stripe states are preserved. Use independent content and malware checks before deciding.</p>
   {response.error||!parsed.success?<p role="alert">Moderation queue unavailable.</p>:parsed.data.length===0?<p>No open reports.</p>:parsed.data.map(item=><article className="panel stack" key={item.id} style={{overflowWrap:"anywhere"}}>
    <h2>{item.productTitle}</h2>
    <p>{reasonLabels[item.reason]} · Report <code>{item.id}</code></p>
    <p>Version <code>{item.versionId}</code> · Owner <code>{item.ownerId}</code> · Reporter <code>{item.reporterId}</code></p>
    <p>Reported <time dateTime={item.createdAt}>{new Date(item.createdAt).toUTCString()}</time></p>
    <p>{item.detail}</p>
    <ModeratorDecisionForm id={item.id}/>
   </article>)}
  </section>
 </main>;
}
