import Link from "next/link";
import { z } from "zod";
import { requireOwner } from "@/lib/owner/auth";

export const metadata = {title:"Owner · Users",robots:{index:false,follow:false}};
const person=z.object({id:z.uuid(),email:z.string().nullable(),verified:z.boolean(),created_at:z.string(),
  profile_count:z.number(),restricted:z.boolean(),is_owner:z.boolean()});
export default async function Users({searchParams}:{searchParams:Promise<{q?:string}>}) {
 const {q=""}=await searchParams;
 const {client}=await requireOwner();
 const {data,error}=await client.rpc("owner_user_search",{p_query:q.slice(0,120),p_limit:50});
 const users=z.array(person).safeParse(data);
 return <main className="stack">
  <h1>User management</h1><p className="muted">Find verified accounts by email, username or UID. Owner writes require MFA.</p>
  <form action="/owner/users" className="actions" role="search">
   <label htmlFor="owner-search">Account search</label><input id="owner-search" name="q" defaultValue={q} maxLength={120} placeholder="Email, username or UID"/>
   <button className="button" type="submit">Search</button>
  </form>
  {error||!users.success?<p role="alert">Account search is unavailable.</p>:<div className="panel owner-profiles-list">
  <table><thead><tr><th>Account</th><th>Profiles</th><th>Access</th><th>Created</th></tr></thead><tbody>
  {users.data.map(u=><tr key={u.id}><td><Link href={"/owner/users/"+u.id}>{u.email??u.id}</Link>{u.is_owner&&" · Owner"}<br/><small className="muted">{u.id}</small></td>
   <td>{u.profile_count}</td><td>{u.restricted?"Restricted":u.verified?"Verified":"Unverified"}</td><td>{new Date(u.created_at).toLocaleDateString("en-GB")}</td></tr>)}
  </tbody></table></div>}
 </main>;
}
