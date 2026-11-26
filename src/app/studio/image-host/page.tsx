import Link from "next/link";
import { GalleryEditor } from "@/components/gallery-editor";
import { MediaFolderEditor } from "@/components/media-folder-editor";
import { mediaLibrary } from "@/lib/media-folders";
import { pendingGalleryItem } from "@/lib/gallery";
import { readStudioDraft, requireAccount, studioHref, type StudioProfileQuery } from "@/lib/profiles-server";

export const metadata = { title: "Image Host", robots: { index: false, follow: false } };

export default async function ImageHostPage({ searchParams }: { searchParams: Promise<StudioProfileQuery> }) {
  const { profile } = await searchParams;
  const draft = await readStudioDraft(profile);
  const { client } = await requireAccount();
  const [pendingResponse,libraryResponse,planResponse] = await Promise.all([
    draft ? client.rpc("pending_gallery_upload", { p_profile: draft.profile_id }) : Promise.resolve({ data: null, error: null }),
    draft ? client.rpc("get_media_folders", { p_profile: draft.profile_id }) : Promise.resolve({ data: null, error: null }),
    client.rpc("get_my_plan"),
  ]);
  if (draft && (pendingResponse.error || libraryResponse.error || !libraryResponse.data)) {
    throw new Error("Couldn’t load your media library.");
  }
  const pending = pendingResponse.data ? pendingGalleryItem.parse(pendingResponse.data) : null;
  const library = libraryResponse.data ? mediaLibrary.parse(libraryResponse.data) : null;
  const selected = draft && profile !== undefined ? draft.profile_id : undefined;

  return <main className="shell studio-shell studio-image-host">
    <header className="studio-page-heading">
      <div><p className="eyebrow">STUDIO / ASSETS</p><h1>Image Host</h1>
        <p className="muted">Upload and organise profile images from one place.</p></div>
      {draft && <Link className="button small" href={studioHref("/studio/customize", selected)}>Back to Customize</Link>}
    </header>
    {draft && library
      ? <>
          <section className="studio-dashboard-panel">
            <div className="studio-panel-heading">
              <div><p className="eyebrow">LIBRARY</p><h2>Assets</h2>
                <p className="muted">Uploads stay private until they are included in a published profile.</p></div>
              <strong className="studio-badge-count">{library.items.length} stored</strong>
            </div>
            <GalleryEditor profileId={draft.profile_id} revision={draft.revision} items={draft.gallery} pending={pending}/>
          </section>
          <section className="studio-dashboard-panel">
            <div className="studio-panel-heading">
              <div><p className="eyebrow">ORGANISATION</p><h2>Folders</h2>
                <p className="muted">Organise your image library without changing public profile URLs or published pages.</p></div>
              {planResponse.data && <Link className="button small" href={studioHref("/studio/plan", selected)}>View storage plan</Link>}
            </div>
            <MediaFolderEditor profileId={draft.profile_id} library={library} draftRevision={draft.revision} draftSize={draft.gallery.length}/>
          </section>
        </>
      : <section className="studio-dashboard-panel stack">
          <h2>Your media library is not ready yet</h2>
          <p className="muted">Claim a Snoozer profile to upload and organise images.</p>
          <Link className="button primary" href="/studio">Claim a profile</Link>
        </section>}
  </main>;
}
