import Link from "next/link";
import {z} from "zod";
import {requireOwner} from "@/lib/owner/auth";
import {reviewPrivacyRequest,recordPrivacyEvidence,executeSafePrivacyErasure} from "./actions";
const preflightSchema=z.object({
 request_id:z.uuid(),user_id:z.uuid(),kind:z.enum(["export","deletion"]),status:z.string(),
 verified_email:z.boolean(),profile_count:z.number(),gallery_metadata_count:z.number(),
 media_folder_count:z.number(),has_avatar_media:z.boolean(),has_stripe_customer:z.boolean(),
 live_checkout_records:z.number(),has_subscription_references:z.boolean(),
 has_retained_billing_evidence:z.boolean(),active_grants:z.number(),appeal_count:z.number()
});
const inventorySchema=z.object({
 request_id:z.uuid(),user_id:z.uuid(),direct_fk_matches:z.number(),
 dependencies:z.array(z.object({
  table:z.string(),column:z.string(),rows:z.number(),
  on_delete:z.enum(["cascade","set_null","restrict","no_action"])
 })),scope:z.string()
});
const evidenceSchema=z.object({
 checked_at:z.string(),identity_verified:z.boolean(),app_data_processed:z.boolean(),
 private_media_processed:z.boolean(),billing_processed:z.boolean(),
 processors_processed:z.boolean(),retention_reviewed:z.boolean(),
 subscriptions_resolved:z.boolean(),account_erasure_verified:z.boolean(),
 secure_notice_sent:z.boolean(),evidence_reference:z.string()
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
 const erasureEnabled=process.env.SNOOZER_ENABLE_SAFE_PRIVACY_ERASURE==="true";
 const selected=z.uuid().safeParse(params.preflight);
 const {data:check,error:checkError}=selected.success?await client.rpc("owner_privacy_preflight",{p_request:selected.data}):{data:null,error:null};
 const preflight=preflightSchema.safeParse(check);
 const {data:dependencyData,error:dependencyError}=selected.success?
  await client.rpc("owner_privacy_dependency_inventory",{p_request:selected.data}):{data:null,error:null};
 const inventory=inventorySchema.safeParse(dependencyData);
 const {data:record}=selected.success?await client.rpc("owner_privacy_evidence",{p_request:selected.data}):{data:null};
 const evidence=evidenceSchema.safeParse(record);
 const checks=[
  ["identity","Identity confirmed against the verified account email",evidence.success&&evidence.data.identity_verified],
  ["app","First-party app data exported or erased and verified",evidence.success&&evidence.data.app_data_processed],
  ["media","All current and historical private Storage objects processed",evidence.success&&evidence.data.private_media_processed],
  ["billing","Stripe invoices, customers and billing evidence reviewed",evidence.success&&evidence.data.billing_processed],
  ["processors","All relevant third-party processors reviewed and actioned",evidence.success&&evidence.data.processors_processed],
  ["retention","Legal holds, lawful retention and data minimisation reviewed",evidence.success&&evidence.data.retention_reviewed],
  ["subscriptions","Any subscriptions safely cancelled or otherwise resolved (deletion only)",evidence.success&&evidence.data.subscriptions_resolved],
  ["erasure","Account deletion independently verified across Auth, app and Storage (deletion only)",evidence.success&&evidence.data.account_erasure_verified],
  ["notice","Secure fulfilment confirmation actually delivered",evidence.success&&evidence.data.secure_notice_sent],
 ] as const;
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
 {selected.success&&<section className="panel stack">
 <h2>Account deletion dependency inventory</h2>
 {dependencyError||!inventory.success?
  <p role="alert">Dependency inventory unavailable. Do not attempt Auth deletion until all database and processor dependencies have been reviewed.</p>:
  <>
   <p>Direct Auth foreign-key references: <strong>{inventory.data.direct_fk_matches}</strong> · Referencing columns with matches: {inventory.data.dependencies.length}</p>
   {inventory.data.dependencies.length===0?<p>No direct Auth foreign-key references remain in Snoozer tables.</p>:
    <ul>{inventory.data.dependencies.map((item,i)=><li key={item.table+"."+item.column+"."+i}>
     <code>{item.table}.{item.column}</code> — {item.rows} row(s) · on delete: {item.on_delete}
    </li>)}</ul>}
   <p className="muted">{inventory.data.scope}</p>
   <p><strong>Read-only:</strong> this inventory does not delete records, cancel subscriptions, override legal holds or prove GDPR erasure is complete.</p>
  </>}
 </section>}
 {selected.success&&preflight.success&&preflight.data.kind==="deletion"&&
 <section className="panel stack">
 <h2>Execute restricted account erasure</h2>
 <p className="muted">This is an irreversible, narrow deletion route for an identity-verified, billing-free account without private Storage, creator commerce, legal holds, unresolved third-party obligations or blocking foreign keys. The database refuses unsafe accounts. Paid records and Storage objects are never deleted by this executor; they require their own reviewed fulfilment.</p>
 <p>Required before executing: Owner MFA AAL2, an open deletion request, documented identity, Stripe and processor review, retention approval, resolved subscriptions and a working notification sender.</p>
 {!erasureEnabled?<p role="alert">Restricted erasure execution is disabled until the disposable-account acceptance tests and operator sign-off. You may still inspect and record fulfilment evidence.</p>:
 <form action={executeSafePrivacyErasure} className="stack">
  <input type="hidden" name="id" value={selected.data}/>
  <label>To authorise irreversible deletion of the requested Auth account, type <code>ERASE {selected.data}</code>
   <input name="confirmation" required autoComplete="off" spellCheck={false} placeholder={"ERASE "+selected.data}/>
  </label>
  <button className="button">Execute verified deletion (Owner AAL2 required)</button>
 </form>}
 </section>}
 {selected.success&&<section className="panel stack">
 <h2>Document fulfilment evidence (Owner MFA required)</h2>
 <p className="muted">This form does not delete data or cancel subscriptions. Only check work you have independently performed. Completion is blocked at database level until every required check is true, with separate deletion proof. Do not paste account secrets, MFA codes or customer data into the reference.</p>
 {evidence.success&&<p>Last evidence recorded {new Date(evidence.data.checked_at).toLocaleString("en-GB")} · Reference: {evidence.data.evidence_reference}</p>}
 <form action={recordPrivacyEvidence} className="stack">
  <input type="hidden" name="id" value={selected.data}/>
  {checks.map(([name,description,checked])=><label key={name}><input type="checkbox" name={name} value="yes" defaultChecked={checked}/>{" "}{description}</label>)}
  <label>Secure evidence or ticket reference (at least 32 characters)
   <textarea name="reference" minLength={32} maxLength={1000} required defaultValue={evidence.success?evidence.data.evidence_reference:""} rows={3}/>
  </label>
  <button className="button">Record fulfilment evidence</button>
 </form>
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
 <label><input type="checkbox" name="confirmed" value="yes"/> I have independently verified the recorded fulfilment evidence before marking the request completed.</label>
 <p className="muted">Completion now also requires a separate evidence record via the request preflight above; the database rejects missing evidence even if this box is checked.</p>
 <button className="button">Record decision (MFA required)</button>
 </form>}
 </section>)}
 </main>;
}
