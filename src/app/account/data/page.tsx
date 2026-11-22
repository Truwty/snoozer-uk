import Link from "next/link";
import { redirect } from "next/navigation";
import { z } from "zod";
import { sessionClient } from "@/lib/supabase";
import { requestDataAction } from "../privacy-actions";

export const metadata={title:"Your data requests · Snoozer",robots:{index:false,follow:false}};
export const dynamic="force-dynamic";
const schema=z.array(z.object({
 id:z.uuid(),kind:z.enum(["export","deletion"]),status:z.string(),
 requested_at:z.string(),reviewed_at:z.string().nullable(),owner_response:z.string().nullable(),
}));
export default async function AccountData({searchParams}:{searchParams:Promise<{status?:string}>}) {
 const client=await sessionClient();
 const {data:auth}=await client.auth.getUser();
 if(!auth.user?.email_confirmed_at) redirect("/sign-in");
 const {data,error}=await client.rpc("my_privacy_requests");
 const requests=schema.safeParse(data);
 const status=(await searchParams).status;
 return <main className="shell stack">
 <p className="eyebrow">SNOOZER / YOUR DATA</p><h1>Data access and deletion requests</h1>
 <p>Ask Snoozer to provide an export of the personal data associated with your account or review an account deletion request. Requests are reviewed securely. An account deletion does not automatically remove legally retained payment or fraud-prevention records.</p>
 <p className="muted">Submitting a deletion request does not immediately close your account or cancel any subscription. You will be contacted before permanent removal. Never share your password or authentication codes with support.</p>
 {status&&<p role="status">{status==="received"?"Your request has been recorded.":"The request could not be recorded. Please retry or contact support."}</p>}
 <section className="panel stack"><h2>Download a basic account snapshot</h2>
 <p>You can immediately download your account details, data request history and account notices. This is not your complete personal-data archive; use the full export request below to obtain additional profile, media, analytics or payment information.</p>
 <a href="/api/v1/account/data-snapshot" download="snoozer-account-snapshot.json" className="button">Download JSON snapshot</a>
 <a href="/api/v1/account/data-archive" download="snoozer-app-data-archive.json" className="button">Download my app data archive</a>
 <a href="/api/v1/account/media-export" download="snoozer-private-media-manifest.json" className="button">Download private media file list</a>
 <p className="muted">The media list contains individual, authenticated file download links for your current private Storage objects. Each download requires your own active account session; the list does not disclose public URLs. Historical orphaned media may still require a reviewed request.</p>
 <p className="muted">The app archive includes profile settings, link and gallery metadata, folders, entitlements, restrictions, appeals and notices. It does not contain media file bytes, all analytics or Stripe payment records, so a reviewed full-data request is still available below.</p>
 </section>
 <section className="panel stack"><h2>Make a request</h2>
 <form action={requestDataAction} className="stack">
  <label>Request type<select name="kind"><option value="export">Export my personal data</option><option value="deletion">Request account deletion</option></select></label>
  <button className="button">Submit request</button>
 </form></section>
 <section className="stack"><h2>Previous requests</h2>
 {error||!requests.success?<p role="alert">Request history is currently unavailable.</p>:
 requests.data.length===0?<p>No previous requests.</p>:requests.data.map(r=><div className="panel stack" key={r.id}>
 <strong>{r.kind==="export"?"Data export":"Account deletion"} · {r.status}</strong>
 <p className="muted">Requested {new Date(r.requested_at).toLocaleString("en-GB")} · Reference {r.id}</p>
 {r.owner_response&&<p>Owner response: {r.owner_response}</p>}
 </div>)}
 </section>
 <div className="actions"><Link href="/account/notifications">Account notifications</Link><Link href="/privacy">Privacy Policy</Link><Link href="/studio">Studio</Link></div>
 </main>;
}
