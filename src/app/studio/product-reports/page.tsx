import Link from "next/link";
import {z} from "zod";
import {Brand} from "@/components/shell";
import {ProductReportForm} from "@/components/creator-product-report-forms";
import {ownProductReports,reasonLabels} from "@/lib/creator-product-moderation";
import {requireAccount} from "@/lib/profiles-server";
export const metadata={title:"Private sandbox product reports",robots:{index:false,follow:false}};
export default async function Page({searchParams}:{searchParams:Promise<{version?:string}>}) {
 const query=await searchParams;
 const version=z.uuid().safeParse(query.version);
 const {client}=await requireAccount();
 const [reports,staff]=await Promise.all([
  client.rpc("list_my_creator_product_reports"),client.rpc("can_moderate_creator_products"),
 ]);
 const parsed=ownProductReports.safeParse(reports.data);
 return <main className="shell stack">
  <header className="nav"><Brand/><Link className="button small" href="/studio">Studio</Link></header>
  <section className="panel stack">
   <p className="eyebrow">SANDBOX / PRODUCT SAFETY</p><h1>Report an unsafe PDF product</h1>
   <p>Use this verified-account form for a publicly reviewed sandbox product. Reports are confidential. Filing a report does not immediately remove a listing, refund a charge or change another buyer’s entitlement. A separately authorised moderator can quarantine a version after review.</p>
   {staff.data===true&&!staff.error&&<Link href="/studio/product-reports/staff">Restricted moderator queue</Link>}
   {reports.error||!parsed.success?<p role="alert">Product reports are temporarily unavailable.</p>:<>
    <ProductReportForm versionId={version.success?version.data:""}/>
    <h2>Your reports</h2>
    {parsed.data.length===0?<p>No reports yet.</p>:parsed.data.map(item=><article key={item.id} className="panel stack" style={{overflowWrap:"anywhere"}}>
     <h3>{reasonLabels[item.reason]}</h3>
     <p>Report: <code>{item.id}</code> · Version: <code>{item.versionId}</code></p>
     <p>Status: {item.state} · <time dateTime={item.createdAt}>{new Date(item.createdAt).toUTCString()}</time></p>
     <p>{item.detail}</p>
    </article>)}
   </>}
   <p>This reporting workflow is not automatic antivirus scanning. For a suspected active harmful download, contact <a href="mailto:SnoozerSupport@Snoozer.uk">Snoozer support</a>.</p>
  </section>
 </main>;
}
