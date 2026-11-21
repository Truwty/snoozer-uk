import Link from "next/link";
import {z} from "zod";
import {Brand} from "@/components/shell";
import {CreatorSupportForm,CloseSupportCase} from "@/components/creator-support-forms";
import {buyerSupportCases,supportReferenceKind,supportStateLabels,supportIssueLabels} from "@/lib/creator-support";
import {requireAccount} from "@/lib/profiles-server";
import {purchaseSupportHref} from "@/lib/creator-purchase-support";

export const metadata={title:"Your creator-commerce support cases",robots:{index:false,follow:false}};
export default async function Page({searchParams}:{searchParams:Promise<{kind?:string;reference?:string}>}) {
 const {client}=await requireAccount();
 const [owned,role,query]=await Promise.all([
  client.rpc("list_my_creator_support_cases"),client.rpc("can_read_creator_support_cases"),searchParams,
 ]);
 const cases=buyerSupportCases.safeParse(owned.data);
 const kind=supportReferenceKind.safeParse(query.kind);
 const reference=z.uuid().safeParse(query.reference);
 return <main className="shell stack">
  <header className="nav"><Brand/><Link className="button small" href="/studio/purchases">Your purchases</Link><Link className="button small" href="/studio/memberships">Your memberships</Link></header>
  <section className="panel stack">
   <p className="eyebrow">STUDIO / SANDBOX</p><h1>Your creator-commerce support cases</h1>
   <p>Use this private case history for test PDF purchases or recurring test memberships. Creating a case never changes a charge, refunds a payment, releases a risk hold or extends access. A staff reply appears here when available; this is not an emergency channel.</p>
   {role.data===true&&!role.error&&<Link href="/studio/support/staff">Support staff queue</Link>}
   {owned.error||!cases.success?<p role="alert">Support cases are temporarily unavailable. Use <a href={purchaseSupportHref}>email support</a> instead.</p>:<>
    <section className="stack"><h2>Open a support case</h2><CreatorSupportForm kind={kind.success?kind.data:"purchase"} reference={reference.success?reference.data:""}/></section>
    <section className="stack"><h2>Case history</h2>
     {cases.data.length===0?<p>You have no support cases yet.</p>:cases.data.map(c=><article key={c.id} className="panel stack" style={{overflowWrap:"anywhere"}}>
      <h3>{supportIssueLabels[c.issue]}</h3>
      <p>Status: {supportStateLabels[c.state]} · {c.referenceKind} reference: <code>{c.referenceId}</code></p>
      <p>Case ID: <code>{c.id}</code> · <time dateTime={c.createdAt}>{new Date(c.createdAt).toUTCString()}</time></p>
      <p><strong>Your message:</strong> {c.message}</p>
      {c.response&&<p><strong>Private staff response:</strong> {c.response}</p>}
      {c.state!=="closed"&&<CloseSupportCase id={c.id}/>}
     </article>)}
    </section>
   </>}
   <p>For urgent or inaccessible cases, <a href={purchaseSupportHref}>email Snoozer support</a> with the case reference only. Never email card numbers or passwords.</p>
  </section>
 </main>;
}
