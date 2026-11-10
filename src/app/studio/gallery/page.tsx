import Link from "next/link";
import { redirect } from "next/navigation";
import { GalleryEditor } from "@/components/gallery-editor";
import { Brand } from "@/components/shell";
import { pendingGalleryItem } from "@/lib/gallery";
import { readDraft, requireAccount } from "@/lib/profiles-server";

export const metadata = { title: "Image gallery", robots: { index: false, follow: false } };

export default async function GalleryPage() {
  const draft = await readDraft();
  if (!draft) redirect("/studio");
  const { client } = await requireAccount();
  const { data, error } = await client.rpc("pending_gallery_upload");
  if (error) throw new Error("Couldn’t load pending gallery uploads.");
  const pending = data ? pendingGalleryItem.parse(data) : null;

  return <main className="shell stack">
    <header className="nav"><Brand /><Link className="button small" href="/studio">Back to Studio</Link></header>
    <section className="panel stack">
      <p className="eyebrow">STUDIO / MEDIA</p>
      <h1>Image gallery</h1>
      <p className="muted">Add up to eight images. Your changes stay in your draft until you publish in Studio.</p>
      <GalleryEditor revision={draft.revision} items={draft.gallery} pending={pending} />
    </section>
  </main>;
}
