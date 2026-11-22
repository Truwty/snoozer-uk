import Link from "next/link";
import { z } from "zod";
import { requireOwner } from "@/lib/owner/auth";

export const metadata = { title: "Owner · Users", robots: { index: false, follow: false } };
const person = z.object({
 id: z.uuid(), email: z.string().nullable(), verified: z.boolean(),
 created_at: z.string(), profile_count: z.number(), restricted: z.boolean(), is_owner: z.boolean()
});
const pageSize = 50;
export default async function Users({ searchParams }: {
 searchParams: Promise<{ q?: string; before?: string; id?: string }>
}) {
 const params = await searchParams;
 const q = (params.q ?? "").slice(0, 120);
 const cursorId = z.uuid().safeParse(params.id);
 const cursorTime = z.iso.datetime({ offset: true }).safeParse(params.before);
 const cursorValid = cursorId.success && cursorTime.success;
 const { client } = await requireOwner();
 const { data, error } = await client.rpc("owner_user_search_page", {
  p_query: q,
  p_before_created: cursorValid ? cursorTime.data : null,
  p_before_id: cursorValid ? cursorId.data : null,
  p_limit: pageSize
 });
 const users = z.array(person).safeParse(data);
 const last = users.success ? users.data.at(-1) : undefined;
 const next = last && users.success && users.data.length === pageSize
  ? "/owner/users?" + new URLSearchParams({ q, before: last.created_at, id: last.id })
  : null;
 return <main className="stack">
  <h1>User management</h1>
  <p className="muted">Search all accounts by email, username or UID. Results are paginated; Owner writes require MFA.</p>
  <form action="/owner/users" className="actions" role="search">
   <label htmlFor="owner-search">Account search</label>
   <input id="owner-search" name="q" defaultValue={q} maxLength={120} placeholder="Email, username or UID" />
   <button className="button" type="submit">Search</button>
  </form>
  {error || !users.success ? <p role="alert">Account search is unavailable.</p> :
   <div className="panel owner-profiles-list">
    {users.data.length === 0 ? <p>No accounts match this search.</p> :
     <table><thead><tr><th>Account</th><th>Profiles</th><th>Access</th><th>Created</th></tr></thead>
      <tbody>{users.data.map(u => <tr key={u.id}>
       <td><Link href={"/owner/users/" + u.id}>{u.email ?? u.id}</Link>{u.is_owner && " · Owner"}<br/><small className="muted">{u.id}</small></td>
       <td>{u.profile_count}</td>
       <td>{u.restricted ? "Restricted" : u.verified ? "Verified" : "Unverified"}</td>
       <td>{new Date(u.created_at).toLocaleDateString("en-GB")}</td>
      </tr>)}</tbody></table>}
    <div className="actions">
     {cursorValid && <Link href={"/owner/users?" + new URLSearchParams({ q })}>First page</Link>}
     {next && <Link href={next}>Next 50 accounts</Link>}
    </div>
   </div>}
 </main>;
}
