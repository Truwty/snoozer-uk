import Link from "next/link";
import {z} from "zod";
import {requireOwner} from "@/lib/owner/auth";
import {reviewPrivacyRequest} from "./actions";
const schema=z.array(z.object({
 id:z.uuid(),user_id:z.uuid(),email:z.string().nullable(),kind:z.enum(["export","deletion"]),
 status:z.string(),requested_at:z.string(),reviewed_at:z.string().nullable(),
 owner_response:z.string().nullable()
}));
export const metadata={title:"Owner · Privacy requests",robots:{index:false,follow:false}};
export default async function OwnerPrivacy({searchParams}:{searchParams:Promise<{admin?:string}>}) {
 const {client}=await requireOwner();
 const {data,error}=await client.rpc("owner_privacy_requests",{p_limit:100});
 const requests=schema.safeParse(data);
 const message=(await searchParams).admin;
 return <main className="stack"><h1>Data access and deletion requests</h1>
 <p className="muted">Private, Owner-only request queue. Replies and status changes require verified MFA and are recorded in the audit log.</p>
 <section className="panel stack">
 <h2>Manual fulfilment is mandatory</h2>
 <p>Requests do not automatically export private provider data, erase accounts, cancel Stripe subscriptions or override required legal retention. Confirm the requester identity; gather relevant app, Supabase and Stripe records; provide the export securely or verify erasure and required retention before marking completed.</p>
 <p><strong>Do not mark a request completed just because you have reviewed it.</strong> Record the actual fulfilment evidence in the response. Consult the <Link href="/privacy">privacy policy</Link> and account billing obligations.</p>
 </section>
 {message&&<p role="status">Result: {message}</p>}
 {error||!requests.success?<p role="alert">Privacy request queue unavailable.</p>:requests.data.length===0?<p>No privacy requests yet.</p>:
 requests.data.map(r=><section className="panel stack" key={r.id}>
 <h2>{r.kind==="export"?"Personal data export":"Account deletion"} · {r.status}</h2>
 <p><Link href={"/owner/users/"+r.user_id}>{r.email??r.user_id}</Link></p>
 <p className="muted">Requested {new Date(r.requested_at).toLocaleString("en-GB")} · Request reference {r.id}</p>
 {r.owner_response&&<p>Previous response: {r.owner_response}</p>}
 {["open","review"].includes(r.status)&&<form action={reviewPrivacyRequest} className="stack">
 <input type="hidden" name="id" value={r.id}/>
 <label>Decision<select name="status" defaultValue="review"><option value="review">Under review</option><option value="completed">Completed (manual fulfilment verified)</option><option value="rejected">Rejected (explain why)</option></select></label>
 <label>Owner response and evidence reference<textarea name="response" minLength={12} maxLength={1000} required/></label>
 <label><input type="checkbox" name="confirmed" value="yes"/> I have personally verified fulfilment before marking a request completed.</label>
 <button className="button">Record decision (MFA required)</button>
 </form>}
 </section>)}
 </main>;
}
