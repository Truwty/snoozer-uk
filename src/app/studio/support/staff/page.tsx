import Link from "next/link";
import {notFound} from "next/navigation";
import {Brand} from "@/components/shell";
import {StaffSupportReply} from "@/components/creator-support-forms";
import {staffSupportCases,supportIssueLabels} from "@/lib/creator-support";
import {requireAccount} from "@/lib/profiles-server";

export const metadata={title:"Restricted commerce-support queue",robots:{index:false,follow:false}};
export default async function Page() {
 const {client}=await requireAccount();
 const permission=await client.rpc("can_read_creator_support_cases");
 if(permission.error||permission.data!==true) notFound();
 const casesResponse=await client.rpc("read_staff_creator_support_cases",{p_limit:50});
 const parsed=staffSupportCases.safeParse(casesResponse.data);
 return <main className="shell stack">
  <header className="nav"><Brand/><Link href="/studio/support" className="button small">Buyer support</Link></header>
  <section className="panel stack">
   <p className="eyebrow">RESTRICTED / COMMERCE SUPPORT</p><h1>Open buyer cases</h1>
   <p>Private sandbox support. Reads and replies are recorded in the case-access audit log. Never ask for payment cards or login credentials. Payment and fraud holds must be resolved by their separate authorised provider workflows.</p>
   {casesResponse.error||!parsed.success?<p role="alert">Staff queue is unavailable.</p>:parsed.data.length===0?<p>No open cases.</p>:parsed.data.map(c=><article className="panel stack" key={c.id} style={{overflowWrap:"anywhere"}}>
    <h2>{supportIssueLabels[c.issue]}</h2>
    <p>Case <code>{c.id}</code> · buyer <code>{c.buyerId}</code></p>
    <p>{c.referenceKind}: <code>{c.referenceId}</code> · opened <time dateTime={c.createdAt}>{new Date(c.createdAt).toUTCString()}</time></p>
    <p><strong>Buyer's message:</strong> {c.message}</p>
    <StaffSupportReply id={c.id}/>
   </article>)}
  </section>
 </main>;
}
