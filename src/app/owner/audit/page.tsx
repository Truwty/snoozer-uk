import { z } from "zod";
import Link from "next/link";
import { requireOwner } from "@/lib/owner/auth";
const schema=z.array(z.object({id:z.number(),actor_id:z.uuid().nullable(),target_id:z.uuid().nullable(),action:z.string(),reason:z.string().nullable(),details:z.record(z.string(),z.unknown()),occurred_at:z.string()}));
export default async function OwnerAudit({searchParams}:{searchParams:Promise<{before?:string}>}) {
 const beforeRaw=(await searchParams).before;
 const before=beforeRaw&&/^\d+$/.test(beforeRaw)?Number(beforeRaw):null;
 const {client}=await requireOwner();const {data,error}=await client.rpc("owner_audit_page",{p_before:before,p_limit:50});const events=schema.safeParse(data);
 return <main className="stack"><h1>Administrative audit log</h1><p className="muted">Append-only records of committed Owner operations. Newest 50 entries per page.</p>
 {error||!events.success?<p role="alert">Audit log unavailable.</p>:<div className="panel owner-profiles-list"><table><thead><tr><th>Time</th><th>Action</th><th>Target</th><th>Reason</th></tr></thead><tbody>
 {events.data.map(e=><tr key={e.id}><td>{new Date(e.occurred_at).toLocaleString("en-GB")}</td><td>{e.action}</td><td>{e.target_id?<Link href={"/owner/users/"+e.target_id}>{e.target_id}</Link>:"Platform"}</td><td>{e.reason??"—"}</td></tr>)}
 </tbody></table>{events.data.length===50&&<p><Link href={"/owner/audit?before="+events.data[49].id}>Older audit records</Link></p>}</div>}
 </main>;
}
