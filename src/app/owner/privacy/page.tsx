import Link from "next/link";
import {z} from "zod";
import {requireOwner} from "@/lib/owner/auth";
import {reviewPrivacyRequest} from "./actions";
const preflightSchema=z.object({
 request_id:z.uuid(),user_id:z.uuid(),kind:z.enum(["export","deletion"]),status:z.string(),
 verified_email:z.boolean(),profile_count:z.number(),gallery_metadata_count:z.number(),
 media_folder_count:z.number(),has_avatar_media:z.boolean(),has_stripe_customer:z.boolean(),
 live_checkout_records:z.number(),has_subscription_references:z.boolean(),
 has_retained_billing_evidence:z.boolean(),active_grants:z.number(),appeal_count:z.number()
});
const schema=z.array(z.object({
 id:z.uuid(),user_id:z.uuid(),email:z.string().nullable(),kind:z.enum(["export","deletion"]),
 status:z.string(),requested_at:z.string(),reviewed_at:z.string().nullable(),
 owner_response:z.string().nullable()
}));
export const metadata={title:"Owner · Privacy requests",robots:{index:false,follow:false}};
export default async function OwnerPrivacy({searchParams}:{searchParams:Promise<{admin?:string;preflight?:string}>}) {
 const {client}=await requireOwner();
 const {data,error}=await client.rpc("owner_privacy_requests",{p_limit:100});
 const requests=schema.safeParse(data);
 const params=await searchParams;
 const message=params.admin;
 const selected=z.uuid().safeParse(params.preflight);
 const {data:check,error:checkError}=selected.success?await client.rpc("owner_privacy_preflight",{p_request:selected.data}):{data:null,error:null};
 const preflight=preflightSchema.safeParse(check);
 return <main className="stack"><h1>Data access and deletion requests</h1>
 <p className="muted">Private, Owner-only request queue. Replies and status changes require verified MFA and are recorded in the audit log.</p>
 <section className="panel stack">
 <h2>Manual fulfilment is mandatory</h2>
 <p>Requests do not automatically export private provider data, erase accounts, cancel Stripe subscriptions or override required legal retention. Confirm the requester identity; gather relevant app, Supabase and Stripe records; provide the export securely or verify erasure and required retention before marking completed.</p>
 <p><strong>Do not mark a request completed just because you have reviewed it.</strong> Record the actual fulfilment evidence in the response. Consult the <Link href="/privacy">privacy policy</Link> and account billing obligations.</p>
 </section>
 {selected.success&&<section className="panel stack">
 <h2>Fulfilment preflight</h2>
 {checkError||!preflight.success?<p role="alert">Preflight unavailable or request not found. Confirm the record before taking action.</p>:<>
 <p>Request {preflight.data.request_id} · {preflight.data.kind} · {preflight.data.status}</p>
 <p>Verified email: <strong>{preflight.data.verified_email?"Yes":"No"}</strong></p>
 <p>Profiles: {preflight.data.profile_count} · Gallery records: {preflight.data.gallery_metadata_count} · Media folders: {preflight.data.media_folder_count} · Avatar media: {preflight.data.has_avatar_media?"Yes":"No"}</p>
 <p>Local billing references: Stripe customer {preflight.data.has_stripe_customer?"present":"not found"} · Checkout records {preflight.data.live_checkout_records} · Subscription references {preflight.data.has_subscription_references?"present":"not found"} · Active grants {preflight.data.active_grants}</p>
 <p>Appeal records: {preflight.data.appeal_count}</p>
 <p className="muted">A missing local record is not proof that a third-party processor holds no data. Before fulfilment, verify identity, historical Storage objects, active Stripe subscriptions and invoices, Zoho/support records, lawful retention, and a secure delivery or erasure confirmation. This is a read-only preflight: it has changed nothing.</p>
 </>}
 </section>}
 {message&&<p role="status">Result: {message}</p>}
 {error||!requests.success?<p role="alert">Privacy request queue unavailable.</p>:requests.data.length===0?<p>No privacy requests yet.</p>:
 requests.data.map(r=><section className="panel stack" key={r.id}>
 <h2>{r.kind==="export"?"Personal data export":"Account deletion"} · {r.status}</h2>
 <p><Link href={"/owner/users/"+r.user_id}>{r.email??r.user_id}</Link></p>
 <p className="muted">Requested {new Date(r.requested_at).toLocaleString("en-GB")} · Request reference {r.id}</p>
 <p><Link href={"/owner/privacy?preflight="+r.id}>Inspect fulfilment preflight</Link></p>
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
