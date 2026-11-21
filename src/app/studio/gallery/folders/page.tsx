import { PageHeader } from "@/components/ui";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MediaFolderEditor } from "@/components/media-folder-editor";
import { mediaLibrary } from "@/lib/media-folders";
import { readStudioDraft, requireAccount, studioHref, type StudioProfileQuery } from "@/lib/profiles-server";

export const metadata = { title: "Media folders", robots: { index: false, follow: false } };

export default async function MediaFoldersPage({ searchParams }: { searchParams: Promise<StudioProfileQuery> }) {
  const { client } = await requireAccount();
  const { profile } = await searchParams;
  const draft = await readStudioDraft(profile);
  if (!draft) redirect("/studio");
  const selected = profile === undefined ? undefined : draft.profile_id;
  const library = await client.rpc("get_media_folders", { p_profile: draft.profile_id });
  if (library.error) throw new Error("Couldn’t load your media library.");
  if (!library.data) redirect("/studio");

  return <main className="shell stack">
    <header className="nav studio-subnav"><Link className="button small" href={studioHref("/studio/gallery", selected)}>Back to image gallery</Link></header>
    <section className="panel stack">
      <p className="eyebrow">STUDIO / MEDIA</p>
      <PageHeader title="Media folders" />
      <p className="muted">Organise images from your draft and retained publications. Folders are private, and moving an image does not change your public gallery.</p>
      <MediaFolderEditor profileId={draft.profile_id} library={mediaLibrary.parse(library.data)} draftRevision={draft.revision} draftSize={draft.gallery.length} />
    </section>
  </main>;
}
