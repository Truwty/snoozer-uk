import Link from "next/link";
import { GalleryEditor } from "@/components/gallery-editor";
import { MediaFolderEditor } from "@/components/media-folder-editor";
import { mediaLibrary } from "@/lib/media-folders";
import { pendingGalleryItem } from "@/lib/gallery";
import { readStudioDraft, requireAccount, studioHref, type StudioProfileQuery } from "@/lib/profiles-server";
import { z } from "zod";

export const metadata = { title: "Image Host", robots: { index: false, follow: false } };


export default async function ImageHostPage({ searchParams }: { searchParams: Promise<Search> }) {
  const { profile } = await searchParams;
  const draft = await readStudioDraft(profile);
  const { client } = await requireAccount();
  const [{data:pendingData,error:pendingError},{data:libraryData,error:libraryError},{data:planData}] = await Promise.all([
    draft?client.rpc("pending_gallery_upload", { p_profile: draft.profile_id }):Promise.resolve({data:null,error:null}),
    draft?client.rpc("get_media_folders", { p_profile: draft.profile_id }):Promise.resolve({data:null,error:null}),
    client.rpc("get_my_plan"),
  ]);
  if(draft&&(pendingError||libraryError||!libraryData))throw new Error("Couldn’t load your media library.");
  const pending=pendingData?pendingGalleryItem.parse(pendingData):null;
  const library=libraryData?mediaLibrary.parse(libraryData):null;
  const selected=draft&&profile!==undefined?draft.profile_id:undefined;
  return <main className="shell studio-shell studio-image-host">
    <header className="studio-page-heading"><div><p className="eyebrow">STUDIO / ASSETS</p><h1>Image Host</h1>
      <p className="muted">Upload and organise profile images from one place.</p></div>
      {draft&&<Link className="button small" href={studioHref("/studio/gallery", selected)}>Open profile gallery</Link>}</header>
    {pasteStatus&&<p className="message" role={pasteStatus==="failed"||pasteStatus==="invalid"?"alert":"status"}>{({created:"Text paste created.",saved:"Text paste updated.",deleted:"Text paste deleted.",limit:"You can save up to 25 text pastes.",invalid:"Check the title and keep the paste under 16 KB.",failed:"Couldn’t save that paste. Refresh and try again."} as Record<string,string>)[pasteStatus]??""}</p>}
    {draft&&library&&<><section className="studio-dashboard-panel"><div className="studio-panel-heading"><div><p className="eyebrow">LIBRARY</p><h2>Assets</h2>
      <p className="muted">Uploads use Snoozer’s private staging and image-processing pipeline. Images become public only when included in a published profile.</p></div>
      <strong className="studio-badge-count">{library.items.length} stored</strong></div>
      <GalleryEditor profileId={draft.profile_id} revision={draft.revision} items={draft.gallery} pending={pending}/>
    </section><section className="studio-dashboard-panel"><div className="studio-panel-heading"><div><p className="eyebrow">ORGANISATION</p><h2>Folders</h2>
      <p className="muted">Folders are private to your account; moving an image does not change its public profile URL or publication.</p></div>
      {planData&&<Link className="button small" href={studioHref("/studio/plan",selected)}>View storage plan</Link>}</div>
      <MediaFolderEditor profileId={draft.profile_id} library={library} draftRevision={draft.revision} draftSize={draft.gallery.length}/>
    </section></>}
    {!draft&&<p className="muted">Create a profile to use image uploads and folders. Text pastes are available now.</p>}
    <p className="muted">The current image system supports processed profile images and private folders. Standalone binary asset links, custom asset domains, upload analytics, audio and cursor assets are not available yet.</p>
  </main>;
}
