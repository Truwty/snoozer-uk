import { PageHeader } from "@/components/ui";
import Link from "next/link";
import { redirect } from "next/navigation";
import { GalleryEditor } from "@/components/gallery-editor";
import { Brand } from "@/components/shell";
import { pendingGalleryItem } from "@/lib/gallery";
import { readStudioDraft, requireAccount, studioHref, type StudioProfileQuery } from "@/lib/profiles-server";

export const metadata = { title: "Image gallery", robots: { index: false, follow: false } };

export default async function GalleryPage({ searchParams }: { searchParams: Promise<StudioProfileQuery> }) {
  const { profile } = await searchParams;
  const draft = await readStudioDraft(profile);
  if (!draft) redirect("/studio");
  const selected = profile === undefined ? undefined : draft.profile_id;
  const { client } = await requireAccount();
  const { data, error } = await client.rpc("pending_gallery_upload", { p_profile: draft.profile_id });
  if (error) throw new Error("Couldn’t load pending gallery uploads.");
  const pending = data ? pendingGalleryItem.parse(data) : null;

  return <main className="shell stack">
    <header className="nav"><Brand /><Link className="button small" href={studioHref("/studio", selected)}>Back to Studio</Link></header>
    <section className="panel stack">
      <p className="eyebrow">STUDIO / MEDIA</p>
      <PageHeader title="Image gallery" />
      <p className="muted">Add up to eight images. Your changes stay in your draft until you publish in Studio.</p>
      <div><Link className="button small" href={studioHref("/studio/gallery/folders", selected)}>Organise media folders</Link></div>
      <GalleryEditor profileId={draft.profile_id} revision={draft.revision} items={draft.gallery} pending={pending} />
    </section>
  </main>;
}
