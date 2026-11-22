import {z} from "zod";
import Link from "next/link";
import {requireOwner} from "@/lib/owner/auth";
import {changeCaseStatus,triageReport,reviewModerationAppeal,blockModeratedProfile,unblockModeratedProfile,takeDownModeratedGalleryImage} from "../actions";
const casesSchema=z.array(z.object({id:z.uuid(),target_id:z.uuid().nullable(),category:z.string(),status:z.string(),reason:z.string(),created_at:z.string(),updated_at:z.string()}));
const reportsSchema=z.array(z.object({id:z.uuid(),reporter_id:z.uuid(),profile_id:z.uuid(),username:z.string(),category:z.string(),reason:z.string(),case_id:z.uuid().nullable(),created_at:z.string()}));
const appealsSchema=z.array(z.object({id:z.uuid(),case_id:z.uuid(),user_id:z.uuid(),reason:z.string(),status:z.string(),response:z.string().nullable(),created_at:z.string(),reviewed_at:z.string().nullable()}));
export default async function Moderation({searchParams}:{searchParams:Promise<{admin?:string}>}) {
 const {client}=await requireOwner();
 const [casesResult,reportsResult,appealsResult]=await Promise.all([
  client.rpc("owner_cases",{p_limit:50}),
  client.rpc("owner_reports",{p_limit:50}),
  client.rpc("owner_appeals",{p_limit:50}),
 ]);
 const cases=casesSchema.safeParse(casesResult.data);
 const reports=reportsSchema.safeParse(reportsResult.data);
 const appeals=appealsSchema.safeParse(appealsResult.data);
 const message=(await searchParams).admin;
 const casesWithProfiles=new Set(reports.success?reports.data.filter(r=>r.case_id).map(r=>r.case_id):[]);
 return <main className="stack"><h1>Moderation & appeals</h1><p className="muted">Review verified user reports, investigate cases, control public profile visibility, and review appeals. Owner enforcement requires MFA.</p>
 {message&&<p role="status">Result: {message==="denied"?"Action rejected. Check MFA, case status and input.":message}</p>}
 <section className="stack"><h2>Incoming profile reports</h2>
 {reportsResult.error||!reports.success?<p role="alert">Reports unavailable.</p>:reports.data.length===0?<p>No reports yet.</p>:reports.data.map(r=><div className="panel stack" key={r.id}>
  <h3>{r.category}: @{r.username}</h3><p>{r.reason}</p><p className="muted">Submitted {new Date(r.created_at).toLocaleString("en-GB")} · {r.id}</p>
  <Link href={"/"+r.username}>View public profile</Link>
  {r.case_id?<p>Linked case {r.case_id}</p>:<form action={triageReport} className="stack"><input type="hidden" name="report" value={r.id}/>
   <label>Review note<input name="reason" minLength={8} maxLength={500} required/></label>
   <button className="button">Open linked moderation case</button></form>}
 </div>)}</section>
 <section className="stack"><h2>Moderation cases</h2>
 {casesResult.error||!cases.success?<p role="alert">Cases unavailable.</p>:cases.data.length===0?<p>No cases yet.</p>:cases.data.map(c=><div className="panel stack" key={c.id}>
  <h3>{c.category} · {c.status}</h3><p>{c.reason}</p><p className="muted">Case {c.id} · {new Date(c.created_at).toLocaleString("en-GB")}</p>
  {c.target_id&&<Link href={"/owner/users/"+c.target_id}>Affected account</Link>}
  <form action={changeCaseStatus} className="stack"><input type="hidden" name="id" value={c.id}/>
   <label>Case status<select name="status" defaultValue={c.status}>{["open","review","actioned","closed","appealed"].map(s=><option key={s} value={s}>{s}</option>)}</select></label>
   <label>Reason<input name="reason" required minLength={8} maxLength={500}/></label><button className="button">Update case</button>
  </form>
  {casesWithProfiles.has(c.id)&&<>
   <form action={blockModeratedProfile} className="stack"><input type="hidden" name="case" value={c.id}/>
    <label>Reason to hide public profile<input name="reason" minLength={8} maxLength={500} required/></label><button className="button">Hide public profile</button>
   </form>
   <form action={unblockModeratedProfile} className="stack"><input type="hidden" name="case" value={c.id}/>
    <label>Reason to reinstate profile<input name="reason" minLength={8} maxLength={500} required/></label><button className="button">Reinstate public profile</button>
   </form>
   <form action={takeDownModeratedGalleryImage} className="stack"><input type="hidden" name="case" value={c.id}/>
    <label>Gallery image UUID<input name="image" maxLength={36} required/></label>
    <label>Media takedown reason<input name="reason" minLength={8} maxLength={500} required/></label><button className="button">Block reported gallery image</button>
   </form>
  </>}
 </div>)}</section>
 <section className="stack"><h2>Appeals</h2>
 {appealsResult.error||!appeals.success?<p role="alert">Appeals unavailable.</p>:appeals.data.length===0?<p>No appeals yet.</p>:appeals.data.map(a=><div className="panel stack" key={a.id}>
  <h3>Appeal · {a.status}</h3><p>{a.reason}</p><p className="muted">Case {a.case_id} · {new Date(a.created_at).toLocaleString("en-GB")}</p>
  <Link href={"/owner/users/"+a.user_id}>Appellant</Link>
  {a.response&&<p>Last response: {a.response}</p>}
  {!["accepted","rejected"].includes(a.status)&&<form action={reviewModerationAppeal} className="stack">
   <input type="hidden" name="appeal" value={a.id}/>
   <label>Decision<select name="status"><option value="review">Under review</option><option value="accepted">Accept</option><option value="rejected">Reject</option></select></label>
   <label>Decision explanation<textarea name="response" minLength={8} maxLength={1000} required/></label>
   <button className="button">Record appeal decision</button>
  </form>}
 </div>)}</section>
 </main>;
}
