import Link from "next/link";
import { redirect } from "next/navigation";
import { GalleryEditor } from "@/components/gallery-editor";
import { MediaFolderEditor } from "@/components/media-folder-editor";
import { mediaLibrary } from "@/lib/media-folders";
import { pendingGalleryItem } from "@/lib/gallery";
import { readStudioDraft, requireAccount, studioHref, type StudioProfileQuery } from "@/lib/profiles-server";

export const metadata = { title: "Image Host", robots: { index: false, follow: false } };

export default async function ImageHostPage({ searchParams }: { searchParams: Promise<StudioProfileQuery> }) {
  const { profile } = await searchParams;
  const draft = await readStudioDraft(profile);
  if (!draft) redirect("/studio");
  const selected = profile === undefined ? undefined : draft.profile_id;
  const { client } = await requireAccount();
  const [{ data: pendingData, error: pendingError }, { data: libraryData, error: libraryError }, { data: planData }] = await Promise.all([
    client.rpc("pending_gallery_upload", { p_profile: draft.profile_id }),
    client.rpc("get_media_folders", { p_profile: draft.profile_id }),
    client.rpc("get_my_plan"),
  ]);
  if (pendingError || libraryError || !libraryData) throw new Error("Couldn’t load your media library.");
  const pending = pendingData ? pendingGalleryItem.parse(pendingData) : null;
  const library = mediaLibrary.parse(libraryData);
  return <main className="shell studio-shell studio-image-host">
    <header className="studio-page-heading"><div><p className="eyebrow">STUDIO / ASSETS</p><h1>Image Host</h1>
      <p className="muted">Manage profile images, organise your library, and see the published URLs visitors can access.</p></div>
      <Link className="button small" href={studioHref("/studio/gallery", selected)}>Open profile gallery</Link></header>
    <section className="studio-dashboard-panel"><div className="studio-panel-heading"><div><p className="eyebrow">LIBRARY</p><h2>Profile images</h2>
      <p className="muted">Uploads use Snoozer’s private staging and image-processing pipeline. Images become public only when included in a published profile.</p></div>
      <strong className="studio-badge-count">{library.items.length} stored</strong></div>
      <GalleryEditor profileId={draft.profile_id} revision={draft.revision} items={draft.gallery} pending={pending}/>
    </section>
    <section className="studio-dashboard-panel"><div className="studio-panel-heading"><div><p className="eyebrow">ORGANISATION</p><h2>Folders and usage</h2>
      <p className="muted">Folders are private to your account; moving an image does not change its profile URL or publication.</p></div>
      {planData && <Link className="button small" href={studioHref("/studio/plan", selected)}>View storage plan</Link>}</div>
      <MediaFolderEditor profileId={draft.profile_id} library={library} draftRevision={draft.revision} draftSize={draft.gallery.length}/>
    </section>
    <p className="muted">The current media system supports processed profile images and private folders. Arbitrary public uploads, text pastes, custom asset domains, audio, and cursor assets are not available yet.</p>
  </main>;
}
