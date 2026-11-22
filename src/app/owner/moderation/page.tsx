import { z } from "zod";
import Link from "next/link";
import { requireOwner } from "@/lib/owner/auth";
import { changeCaseStatus } from "../actions";
const schema=z.array(z.object({id:z.uuid(),target_id:z.uuid().nullable(),category:z.string(),status:z.string(),reason:z.string(),created_at:z.string(),updated_at:z.string()}));
export default async function Moderation({searchParams}:{searchParams:Promise<{admin?:string}>}) {
 const {client}=await requireOwner();const {data,error}=await client.rpc("owner_cases",{p_limit:50});const cases=schema.safeParse(data);
 const message=(await searchParams).admin;
 return <main className="stack"><h1>Moderation queue</h1><p className="muted">Owner-created cases. Public user reporting and appeal intake are not yet enabled.</p>
 {message&&<p role="status">Result: {message}</p>}
 {error||!cases.success?<p role="alert">Moderation cases unavailable.</p>:cases.data.length===0?<p>No moderation cases.</p>:cases.data.map(c=><section className="panel stack" key={c.id}>
  <h2>{c.category} · {c.status}</h2><p>{c.reason}</p><p className="muted">{c.id} · {new Date(c.created_at).toLocaleString("en-GB")}</p>
  {c.target_id&&<Link href={"/owner/users/"+c.target_id}>View affected account</Link>}
  <form action={changeCaseStatus} className="stack"><input type="hidden" name="id" value={c.id}/>
  <label>Status<select name="status" defaultValue={c.status}>{["open","review","actioned","closed","appealed"].map(s=><option value={s} key={s}>{s}</option>)}</select></label>
  <label>Action reason<input name="reason" minLength={8} maxLength={500} required/></label><button className="button">Update case (MFA required)</button></form>
 </section>)}</main>;
}
