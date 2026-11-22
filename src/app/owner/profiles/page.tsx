import Link from "next/link";
import { z } from "zod";
import { requireOwner } from "@/lib/owner/auth";
const schema=z.array(z.object({username:z.string(),display_name:z.string(),published:z.boolean(),created_at:z.string()}));
export default async function OwnerProfiles() {
 const {client}=await requireOwner();const {data,error}=await client.rpc("owner_recent_profiles",{p_limit:100});const profiles=schema.safeParse(data);
 return <main className="stack"><h1>Profile inventory</h1><p className="muted">100 most recent profiles. Full search, enforcement and case-linked takedowns will follow in the next rollout.</p>
 {error||!profiles.success?<p role="alert">Profiles unavailable.</p>:<div className="panel owner-profiles-list"><table><thead><tr><th>Profile</th><th>Status</th><th>Created</th></tr></thead><tbody>
 {profiles.data.map(p=><tr key={p.username}><td>@{p.username} {p.published&&<Link href={"/"+p.username}>View</Link>}</td><td>{p.published?"Published":"Draft"}</td><td>{new Date(p.created_at).toLocaleDateString("en-GB")}</td></tr>)}
 </tbody></table></div>}</main>;
}
