import Link from "next/link";
import { z } from "zod";
import { requireOwner } from "@/lib/owner/auth";

const schema = z.array(z.object({
 id: z.uuid(), owner_id: z.uuid(), username: z.string(),
 display_name: z.string(), published: z.boolean(), moderated: z.boolean(), created_at: z.string()
}));
const pageSize = 50;
export default async function OwnerProfiles({ searchParams }: {
 searchParams: Promise<{ q?: string; before?: string; id?: string }>
}) {
 const params = await searchParams;
 const q = (params.q ?? "").slice(0, 120);
 const cursorId = z.uuid().safeParse(params.id);
 const cursorTime = z.iso.datetime({ offset: true }).safeParse(params.before);
 const cursorValid = cursorId.success && cursorTime.success;
 const { client } = await requireOwner();
 const { data, error } = await client.rpc("owner_profile_inventory_page", {
  p_query: q,
  p_before_created: cursorValid ? cursorTime.data : null,
  p_before_id: cursorValid ? cursorId.data : null,
  p_limit: pageSize
 });
 const profiles = schema.safeParse(data);
 const last = profiles.success ? profiles.data.at(-1) : undefined;
 const next = last && profiles.data.length === pageSize
  ? "/owner/profiles?" + new URLSearchParams({ q, before: last.created_at, id: last.id })
  : null;
 return <main className="stack">
  <h1>Profile inventory</h1>
  <p className="muted">Search the full profile inventory by username or account UID, including drafts and moderated profiles.</p>
  <form action="/owner/profiles" className="actions" role="search">
   <label htmlFor="owner-profile-search">Profile search</label>
   <input id="owner-profile-search" name="q" maxLength={120} defaultValue={q} placeholder="Username or account UID"/>
   <button className="button">Search</button>
  </form>
  {error || !profiles.success ? <p role="alert">Profiles unavailable.</p> :
   <div className="panel owner-profiles-list">
    {profiles.data.length === 0 ? <p>No profiles match this search.</p> :
     <table><thead><tr><th>Profile</th><th>Owner</th><th>Status</th><th>Created</th></tr></thead>
      <tbody>{profiles.data.map(p => <tr key={p.id}>
       <td>@{p.username} {p.published && !p.moderated && <Link href={"/" + p.username}>View</Link>}</td>
       <td><Link href={"/owner/users/" + p.owner_id}>Open account</Link></td>
       <td>{p.moderated ? "Moderated" : p.published ? "Published" : "Draft"}</td>
       <td>{new Date(p.created_at).toLocaleDateString("en-GB")}</td>
      </tr>)}</tbody></table>}
    <div className="actions">
     {cursorValid && <Link href={"/owner/profiles?" + new URLSearchParams({ q })}>First page</Link>}
     {next && <Link href={next}>Next 50 profiles</Link>}
    </div>
   </div>}
 </main>;
}
