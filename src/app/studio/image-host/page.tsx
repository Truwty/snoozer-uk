import Link from "next/link";
import { GalleryEditor } from "@/components/gallery-editor";
import { MediaFolderEditor } from "@/components/media-folder-editor";
import { mediaLibrary } from "@/lib/media-folders";
import { pendingGalleryItem } from "@/lib/gallery";
import { readStudioDraft, requireAccount, studioHref, type StudioProfileQuery } from "@/lib/profiles-server";
import { createTextPaste, deleteTextPaste, updateTextPaste } from "./actions";
import { z } from "zod";

export const metadata = { title: "Image Host", robots: { index: false, follow: false } };

type Search=StudioProfileQuery&{paste?:string|string[]};
const pastesSchema=z.array(z.object({
  id:z.uuid(),title:z.string(),body:z.string(),is_public:z.boolean(),created_at:z.string(),updated_at:z.string(),
}));

export default async function ImageHostPage({ searchParams }: { searchParams: Promise<Search> }) {
  const {profile,paste}=await searchParams;
  const draft=await readStudioDraft(profile);
  const {client}=await requireAccount();
  const [{data:pastesData,error:pastesError},{data:pendingData,error:pendingError},{data:libraryData,error:libraryError},{data:planData}] = await Promise.all([
    client.rpc("list_my_image_host_text_pastes"),
    draft?client.rpc("pending_gallery_upload",{p_profile:draft.profile_id}):Promise.resolve({data:null,error:null}),
    draft?client.rpc("get_media_folders",{p_profile:draft.profile_id}):Promise.resolve({data:null,error:null}),
    client.rpc("get_my_plan"),
  ]);
  if(pastesError)throw new Error("Couldn’t load your text pastes.");
  if(draft&&(pendingError||libraryError||!libraryData))throw new Error("Couldn’t load your media library.");
  const pastes=pastesSchema.parse(pastesData??[]);
  const pending=pendingData?pendingGalleryItem.parse(pendingData):null;
  const library=libraryData?mediaLibrary.parse(libraryData):null;
  const selected=draft&&profile!==undefined?draft.profile_id:undefined;
  const pasteStatus=typeof paste==="string"?paste:"";

  return <main className="shell studio-shell studio-image-host">
    <header className="studio-page-heading">
      <div><p className="eyebrow">STUDIO / ASSETS</p><h1>Image Host</h1>
        <p className="muted">Upload, organise and share your Snoozer assets and plain-text snippets.</p></div>
      {draft&&<Link className="button small" href={studioHref("/studio/customize",selected)}>Back to Customize</Link>}
    </header>

    {pasteStatus&&<p className="message" role={pasteStatus==="failed"||pasteStatus==="invalid"?"alert":"status"}>
      {({created:"Text paste created.",saved:"Text paste updated.",deleted:"Text paste deleted.",limit:"You can save up to 25 text pastes.",invalid:"Check the title and keep the paste under 16 KB.",failed:"Couldn’t save that paste. Refresh and try again."} as Record<string,string>)[pasteStatus]??""}
    </p>}

    <section className="studio-dashboard-panel">
      <div className="studio-panel-heading">
        <div><p className="eyebrow">TEXT PASTES</p><h2>Snippets</h2>
          <p className="muted">Create and share plain-text snippets using a random, unguessable URL. Each paste is limited to 16 KB; you can keep 25.</p></div>
        <strong className="studio-badge-count">{pastes.length} / 25</strong>
      </div>
      <form action={createTextPaste} className="studio-template-create-form">
        <input type="hidden" name="profile" value={selected??""}/>
        <label>Title<input name="title" required minLength={1} maxLength={80}/></label>
        <label>Text<textarea name="body" required maxLength={16384} rows={7}/></label>
        <label className="check"><input type="checkbox" name="is_public"/> Publish at a public URL</label>
        <button className="button primary" type="submit" disabled={pastes.length>=25}>Create text paste</button>
      </form>
      {pastes.length>0&&<ul className="studio-image-pastes">
        {pastes.map(item=><li className="studio-dashboard-panel" key={item.id}>
          <form action={updateTextPaste} className="studio-template-create-form">
            <input type="hidden" name="profile" value={selected??""}/><input type="hidden" name="id" value={item.id}/>
            <label>Title<input name="title" defaultValue={item.title} required maxLength={80}/></label>
            <label>Text<textarea name="body" defaultValue={item.body} required maxLength={16384} rows={6}/></label>
            <label className="check"><input type="checkbox" name="is_public" defaultChecked={item.is_public}/> Public at <code>/paste/{item.id}</code></label>
            <div className="actions"><button className="button small" type="submit">Save changes</button>
              {item.is_public&&<a className="button small" href={"/paste/"+item.id} target="_blank" rel="noreferrer">Open public text</a>}</div>
          </form>
          <form action={deleteTextPaste}>
            <input type="hidden" name="profile" value={selected??""}/><input type="hidden" name="id" value={item.id}/>
            <button className="button small danger" type="submit">Delete paste</button>
          </form>
        </li>)}
      </ul>}
    </section>

    {draft&&library&&<>
      <section className="studio-dashboard-panel">
        <div className="studio-panel-heading">
          <div><p className="eyebrow">LIBRARY</p><h2>Assets</h2>
            <p className="muted">Uploads use Snoozer’s private staging and image-processing pipeline. Images become public only when included in a published profile.</p></div>
          <strong className="studio-badge-count">{library.items.length} stored</strong>
        </div>
        <GalleryEditor profileId={draft.profile_id} revision={draft.revision} items={draft.gallery} pending={pending}/>
      </section>
      <section className="studio-dashboard-panel">
        <div className="studio-panel-heading">
          <div><p className="eyebrow">ORGANISATION</p><h2>Folders</h2>
            <p className="muted">Organise images without changing their public profile URLs or publication state.</p></div>
          {planData&&<Link className="button small" href={studioHref("/studio/plan",selected)}>View storage plan</Link>}
        </div>
        <MediaFolderEditor profileId={draft.profile_id} library={library} draftRevision={draft.revision} draftSize={draft.gallery.length}/>
      </section>
    </>}
    {!draft&&<p className="muted">Create a profile to use image uploads and folders. Text pastes are available now.</p>}
  </main>;
}
