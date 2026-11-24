import { z } from "zod";
import { requireOwner } from "@/lib/owner/auth";
import { saveDiscoveryCollection, deleteDiscoveryCollection } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Discovery management", robots: { index: false, follow: false } };

const collectionsSchema = z.array(z.object({
  slug: z.string(), collection_type: z.enum(["featured", "spotlight", "collection"]),
  title: z.string(), description: z.string(), published: z.boolean(), sort_order: z.number().int(),
  starts_at: z.string().nullable(), expires_at: z.string().nullable(),
  profiles: z.array(z.string()).max(20),
})).max(100);

function dateInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0,16) : "";
}

export default async function OwnerDiscoveryPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const params = await searchParams;
  const { client } = await requireOwner();
  const response = await client.rpc("owner_discovery_collections");
  const parsed = collectionsSchema.safeParse(response.data);
  return <main className="shell owner-discovery-page stack">
    <header className="stack"><p className="eyebrow">OWNER / DISCOVERY</p><h1>Discovery management</h1>
      <p className="muted">Curate public creator collections. A collection can only include published profiles that have opted into Discover and are not restricted or moderated. Changes require Owner MFA (AAL2).</p></header>
    {params.status && <p className={params.status === "saved" || params.status === "deleted" ? "message" : "message error"} role="status">
      {params.status === "saved" ? "Collection saved." : params.status === "deleted" ? "Collection deleted." :
        params.status === "mfa" ? "Verify your Owner MFA session (AAL2) and try again." :
        params.status === "invalid" ? "Check the collection details, profile usernames and dates." : "The collection could not be changed."}
    </p>}
    {response.error || !parsed.success ? <p role="alert">Discovery collections are temporarily unavailable.</p> :
      <section className="owner-discovery-list stack">
        <h2>Existing collections</h2>
        {parsed.data.length === 0 && <p className="muted">No collections have been created yet.</p>}
        {parsed.data.map((collection) => <details className="owner-discovery-item" key={collection.slug}>
          <summary><strong>{collection.title}</strong><span className="muted">/{collection.slug} · {collection.collection_type} · {collection.published ? "Published" : "Draft"} · {collection.profiles.length} profiles</span></summary>
          <form action={saveDiscoveryCollection} className="owner-discovery-form">
            <label>URL slug<input name="slug" required minLength={2} maxLength={48} defaultValue={collection.slug}/></label>
            <label>Collection type<select name="collection_type" defaultValue={collection.collection_type}><option value="featured">Featured creators</option><option value="spotlight">Community spotlight</option><option value="collection">Standard collection</option></select></label>
            <label>Title<input name="title" required minLength={2} maxLength={72} defaultValue={collection.title}/></label>
            <label>Description<textarea name="description" maxLength={280} defaultValue={collection.description}/></label>
            <label>Profile usernames (up to 20, comma or line separated)<textarea name="profiles" rows={3} defaultValue={collection.profiles.join("\n")}/></label>
            <label>Display order<input name="sort_order" type="number" min={0} max={10000} defaultValue={collection.sort_order}/></label>
            <label>Start date/time<input name="starts_at" type="datetime-local" defaultValue={dateInput(collection.starts_at)}/></label>
            <label>Expiry date/time<input name="expires_at" type="datetime-local" defaultValue={dateInput(collection.expires_at)}/></label>
            <label className="discovery-toggle-row"><input type="checkbox" name="published" defaultChecked={collection.published}/><span>Publish collection</span></label>
            <label>Reason for audit log<input name="reason" required minLength={8} maxLength={500} placeholder="Explain this curation change"/></label>
            <button className="button primary" type="submit">Save collection</button>
          </form>
          <form action={deleteDiscoveryCollection} className="owner-discovery-delete">
            <input type="hidden" name="slug" value={collection.slug}/>
            <label>Reason<input name="reason" required minLength={8} maxLength={500} placeholder="Why remove this collection?"/></label>
            <button className="button danger" type="submit">Delete collection</button>
          </form>
        </details>)}
      </section>}
    <section className="panel stack">
      <h2>Create a collection</h2>
      <form action={saveDiscoveryCollection} className="owner-discovery-form">
        <label>URL slug<input name="slug" required minLength={2} maxLength={48} placeholder="featured-creators"/></label>
        <label>Collection type<select name="collection_type" defaultValue="collection"><option value="featured">Featured creators</option><option value="spotlight">Community spotlight</option><option value="collection">Standard collection</option></select></label>
        <label>Title<input name="title" required minLength={2} maxLength={72} placeholder="Featured creators"/></label>
        <label>Description<textarea name="description" maxLength={280} placeholder="A short introduction to this collection."/></label>
        <label>Profile usernames (up to 20, comma or line separated)<textarea name="profiles" rows={3} placeholder={"creator-one\ncreator-two"}/></label>
        <label>Display order<input name="sort_order" type="number" min={0} max={10000} defaultValue={0}/></label>
        <label>Start date/time<input name="starts_at" type="datetime-local"/></label>
        <label>Expiry date/time<input name="expires_at" type="datetime-local"/></label>
        <label className="discovery-toggle-row"><input type="checkbox" name="published"/><span>Publish immediately</span></label>
        <label>Reason for audit log<input name="reason" required minLength={8} maxLength={500} placeholder="Explain why this collection is being created"/></label>
        <button className="button primary" type="submit">Create collection</button>
      </form>
    </section>
  </main>;
}
