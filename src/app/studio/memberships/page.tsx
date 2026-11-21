import Link from "next/link";
import {Brand} from "@/components/shell";
import {MembershipControls} from "@/components/creator-membership-checkout";
import {memberHistory} from "@/lib/creator-membership-subscription";
import {requireAccount} from "@/lib/profiles-server";
import {purchaseSupportHref} from "@/lib/creator-purchase-support";
export const metadata={title:"Your sandbox memberships",robots:{index:false,follow:false}};
export default async function Page() {
 const {client}=await requireAccount();
 const response=await client.rpc("list_my_creator_memberships");
 const data=memberHistory.safeParse(response.data);
 return <main className="shell stack"><header className="nav"><Brand/><Link className="button small" href="/studio/purchases">Your purchases</Link></header>
 <section className="panel stack"><h1>Your sandbox memberships</h1><p>Test subscriptions only. No real payments or Snoozer Plus access. Stored status is not current access proof. Verify with Stripe before using any membership.</p>
 {response.error||!data.success?<p role="alert">Membership records are unavailable.</p>:data.data.length===0?<p>No test membership records.</p>:data.data.map(m=><article className="panel stack" key={m.id}>
  <h2>{m.title}</h2><p>£{(m.monthlyPence/100).toFixed(2)} GBP / month · Recorded status: {m.state}</p>
  <p>Reference: <code>{m.id}</code></p>
  {m.periodEnd&&<p>Recorded period end: <time dateTime={m.periodEnd}>{new Date(m.periodEnd).toUTCString()}</time></p>}
  {m.cancelAtEnd&&<p>Renewal cancellation recorded.</p>}
  {m.held&&<p>Membership withheld for payment-risk review.</p>}
  {m.pendingReceipt&&<p>Provider reconciliation pending; access withheld.</p>}
  <a href={`/studio/memberships/access/${m.id}`}>Verify and open membership record</a>
  <MembershipControls id={m.id} canCancel={m.canCancel}/>
  <a href={purchaseSupportHref}>Contact support</a>
 </article>)}
 </section></main>;
}
