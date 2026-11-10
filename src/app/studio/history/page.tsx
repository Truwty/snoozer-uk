import Link from "next/link";
import { Brand } from "@/components/shell";
import { publicationDate, publicationList } from "@/lib/publication";
import { requireAccount } from "@/lib/profiles-server";

export const metadata = { title: "Publish history", robots: { index: false, follow: false } };

export default async function Page() {
  const { client } = await requireAccount();
  const { data, error } = await client.rpc("list_publications");
  if (error) throw new Error("Couldn’t load your publish history.");
  const versions = publicationList.parse(data);

  return <main className="shell narrow stack">
    <Brand />
    <Link href="/studio">← Back to Studio</Link>
    <section className="panel stack">
      <h1>Publish history</h1>
      <p className="muted">Snoozer keeps your 20 most recent publications. Open a version to preview it and restore it to your draft.</p>
      {versions.length === 0 ? <p>No published versions yet.</p> : <ul className="stack">
        {versions.map(({ revision, display_name, published_at, live }) => <li key={revision} className="panel stack">
          <strong>{display_name}</strong>
          <p>Version {revision} · <time dateTime={published_at}>{publicationDate(published_at)}</time>{live && " · Live"}</p>
          <Link className="button small" href={`/studio/history/${revision}`}>Preview version {revision}</Link>
        </li>)}
      </ul>}
    </section>
  </main>;
}
