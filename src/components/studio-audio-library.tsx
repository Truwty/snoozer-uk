"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { supabaseConfig } from "@/lib/env";
import { profileAudioIncoming } from "@/lib/profile-audio";
import { discardGalleryUpload, finishGalleryUpload, startGalleryUpload } from "@/app/studio/gallery/actions";
import { galleryIncoming, galleryMaxBytes, galleryTypes } from "@/lib/gallery";
import { discardProfileAudioUpload, finishProfileAudioUpload, loadProfileAudio, removeProfileAudio, startProfileAudioUpload } from "@/app/studio/audio/actions";

type GalleryImage={id:string;alt:string};
type AudioItem={id:string;title:string;artist:string;extension:string;contentType:string;bytes:number;createdAt:string;url:string};
type Props={
  profileId:string;
  revision:number;
  gallery:GalleryImage[];
  onAddTrack:(track:{title:string;artist:string;url:string;coverImageId?:string})=>void;
};

export function StudioAudioLibrary({profileId,revision,gallery,onAddTrack}:Props){
  const [items,setItems]=useState<AudioItem[]>([]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [title,setTitle]=useState("");
  const [artist,setArtist]=useState("");
  const [file,setFile]=useState<File|null>(null);
  const [cover,setCover]=useState<Record<string,string>>({});
  const [coverBusy,setCoverBusy]=useState(false);
  const coverTarget=useRef<string|null>(null);
  const coverInput=useRef<HTMLInputElement>(null);
  const router=useRouter();
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");

  const reload=useCallback(async()=>{
    setLoading(true);
    const result=await loadProfileAudio(profileId);
    setItems(result.items as AudioItem[]);
    setError(result.error);
    setLoading(false);
  },[profileId]);
  useEffect(()=>{
    let active=true;
    void loadProfileAudio(profileId).then(result=>{
      if(!active)return;
      setItems(result.items as AudioItem[]);
      setError(result.error);
      setLoading(false);
    });
    return ()=>{active=false;};
  },[profileId]);

  async function upload(){
    if(!file||busy)return;
    setBusy(true);setError("");setMessage("");
    try{
      const started=await startProfileAudioUpload(profileId,revision,title,artist,file.type,file.size);
      if("error" in started){setError(started.error ?? "Could not prepare the audio upload. Try again.");return;}
      const config=supabaseConfig();
      const browser=createBrowserClient(config.url,config.key);
      const {error:uploadError}=await browser.storage.from(profileAudioIncoming)
        .uploadToSignedUrl(started.path,started.token,file,{contentType:file.type,upsert:false});
      if(uploadError){
        await discardProfileAudioUpload(profileId,revision,started.id);
        setError("The audio file could not be uploaded. Check its format and try again.");
        return;
      }
      const completed=await finishProfileAudioUpload(profileId,revision,started.id);
      if("error" in completed){setError(completed.error);return;}
      setMessage(completed.message);
      setTitle("");setArtist("");setFile(null);
      const input=document.getElementById("studio-audio-file") as HTMLInputElement|null;
      if(input)input.value="";
      await reload();
    }catch{
      setError("The audio upload failed. Try again with an MP3, M4A, OGG, WAV, AAC or FLAC file up to 15 MB.");
    }finally{setBusy(false);}
  }

  async function uploadCover(item:AudioItem,file:File){
    if(coverBusy)return;
    if(file.size<1||file.size>galleryMaxBytes||!galleryTypes.includes(file.type)){
      setError("Choose a JPEG, PNG or WebP cover image up to 4 MB.");return;
    }
    setCoverBusy(true);setError("");setMessage("");
    let stagedId="";
    try{
      const started=await startGalleryUpload(profileId,revision,("Audio cover art — "+item.title).slice(0,180));
      if("error" in started||!started.id||!started.path||!started.token){
        setError(started.error??"Could not prepare the cover upload.");return;
      }
      stagedId=started.id;
      const config=supabaseConfig();
      const browser=createBrowserClient(config.url,config.key);
      const {error:uploadError}=await browser.storage.from(galleryIncoming)
        .uploadToSignedUrl(started.path,started.token,file,{contentType:file.type,upsert:false});
      if(uploadError){
        await discardGalleryUpload(profileId,revision,stagedId);
        setError("The cover image could not be uploaded. Try again.");return;
      }
      const result=await finishGalleryUpload(profileId,revision,stagedId);
      if("error" in result){
        await discardGalleryUpload(profileId,revision,stagedId);
        setError(result.error??"The cover image could not be saved.");return;
      }
      setCover(current=>({...current,[item.id]:stagedId}));
      setMessage("Cover artwork added. It is now selected for "+item.title+".");
      router.refresh();
    }catch{
      if(stagedId)await discardGalleryUpload(profileId,revision,stagedId).catch(()=>undefined);
      setError("The cover image could not be saved. Try again.");
    }finally{setCoverBusy(false);coverTarget.current=null;if(coverInput.current)coverInput.current.value="";}
  }

  async function remove(id:string){
    setBusy(true);setError("");setMessage("");
    try{
      const result=await removeProfileAudio(profileId,id);
      if("error" in result){setError(result.error);return;}
      setMessage(result.message);
      await reload();
    }catch{setError("The audio file could not be removed.");}
    finally{setBusy(false);}
  }

  return <section className="studio-audio-library stack" aria-label="Profile audio library">
    <input ref={coverInput} type="file" accept={galleryTypes.join(",")} hidden
      onChange={event=>{const file=event.target.files?.[0];const item=items.find(track=>track.id===coverTarget.current);if(file&&item)void uploadCover(item,file);}}/>

    <div className="studio-audio-upload-grid">
      <label>Track title<input value={title} maxLength={80} onChange={event=>setTitle(event.target.value)} placeholder="Track title"/></label>
      <label>Artist<input value={artist} maxLength={80} onChange={event=>setArtist(event.target.value)} placeholder="Artist name"/></label>
      <label className="studio-audio-file">Audio file<input id="studio-audio-file" type="file" accept=".mp3,.m4a,.ogg,.wav,.aac,.flac,audio/mpeg,audio/mp4,audio/ogg,audio/wav,audio/aac,audio/flac"
        onChange={event=>setFile(event.target.files?.[0]??null)}/><small>15 MB maximum · 12 uploads per day · 30 tracks</small></label>
      <button type="button" className="button primary" onClick={()=>void upload()} disabled={!file||!title.trim()||!artist.trim()||busy}>{busy?"Uploading…":"Upload track"}</button>
    </div>
    {error&&<p className="message error" role="alert">{error}</p>}
    {message&&<p className="message" role="status">{message}</p>}
    <div className="studio-audio-track-list">
      <div className="studio-audio-list-heading"><strong>Your audio</strong><span>{items.length}/30 tracks</span></div>
      {loading?<p className="muted">Loading audio library…</p>:items.length===0?<p className="muted">Your audio library is empty.</p>:items.map(item=>
        <article key={item.id} className="studio-audio-track">
          <div className="studio-audio-track-copy"><strong>{item.title}</strong><span>{item.artist}</span><small>{item.extension.toUpperCase()} · {(item.bytes/1024/1024).toFixed(1)} MB</small></div>
          <div className="studio-audio-cover-control stack">
            <label>Cover art<select value={cover[item.id]??""} onChange={event=>setCover(current=>({...current,[item.id]:event.target.value}))}>
              <option value="">Use profile artwork</option>{gallery.map(image=><option key={image.id} value={image.id}>{image.alt||"Gallery image"}</option>)}
            </select></label>
            <button type="button" className="button small" disabled={coverBusy} onClick={()=>{
              coverTarget.current=item.id;coverInput.current?.click();
            }}>{coverBusy&&coverTarget.current===item.id?"Uploading cover…":"Upload cover artwork"}</button>
          </div>
          <div className="studio-audio-track-actions">
            <button type="button" className="button small primary" onClick={()=>onAddTrack({title:item.title,artist:item.artist,url:item.url,...(cover[item.id]?{coverImageId:cover[item.id]}:{})})}>Add to profile</button>
            <button type="button" className="button small" disabled={busy} onClick={()=>void remove(item.id)}>Delete</button>
          </div>
        </article>)}
    </div>
    <p className="muted">Files remain private until linked from your profile and published. Only linked tracks on the current published profile can be streamed. Removing a track from the library requires unlinking it from both the draft and published profile first.</p>
  </section>;
}
