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

const audioAccept=".mp3,.m4a,.ogg,.wav,.aac,.flac,audio/mpeg,audio/mp4,audio/ogg,audio/wav,audio/aac,audio/flac";

export function StudioAudioLibrary({profileId,revision,gallery,onAddTrack}:Props){
  const [items,setItems]=useState<AudioItem[]>([]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [managerOpen,setManagerOpen]=useState(false);
  const [addOpen,setAddOpen]=useState(false);
  const [title,setTitle]=useState("");
  const [artist,setArtist]=useState("");
  const [audioFile,setAudioFile]=useState<File|null>(null);
  const [newCoverFile,setNewCoverFile]=useState<File|null>(null);
  const [cover,setCover]=useState<Record<string,string>>({});
  const [coverBusy,setCoverBusy]=useState(false);
  const [coverTarget,setCoverTarget]=useState<string|null>(null);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");
  const audioInput=useRef<HTMLInputElement>(null);
  const newCoverInput=useRef<HTMLInputElement>(null);
  const coverInput=useRef<HTMLInputElement>(null);
  const router=useRouter();

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

  useEffect(()=>{
    if(!managerOpen&&!addOpen)return;
    const previous=document.body.style.overflow;
    document.body.style.overflow="hidden";
    const onKeyDown=(event:KeyboardEvent)=>{
      if(event.key==="Escape"){
        if(addOpen)setAddOpen(false);
        else setManagerOpen(false);
      }
    };
    document.addEventListener("keydown",onKeyDown);
    return ()=>{
      document.body.style.overflow=previous;
      document.removeEventListener("keydown",onKeyDown);
    };
  },[managerOpen,addOpen]);

  function resetAddForm(){
    setTitle("");setArtist("");setAudioFile(null);setNewCoverFile(null);
    if(audioInput.current)audioInput.current.value="";
    if(newCoverInput.current)newCoverInput.current.value="";
  }

  async function saveCoverAsset(file:File,description:string){
    if(file.size<1||file.size>galleryMaxBytes||!galleryTypes.includes(file.type)){
      throw new Error("Choose a JPEG, PNG or WebP cover image up to 4 MB.");
    }
    const started=await startGalleryUpload(profileId,revision,description.slice(0,180));
    if("error" in started||!started.id||!started.path||!started.token){
      throw new Error(started.error??"Could not prepare the cover image.");
    }
    const config=supabaseConfig();
    const browser=createBrowserClient(config.url,config.key);
    const {error:uploadError}=await browser.storage.from(galleryIncoming)
      .uploadToSignedUrl(started.path,started.token,file,{contentType:file.type,upsert:false});
    if(uploadError){
      await discardGalleryUpload(profileId,revision,started.id);
      throw new Error("The cover image could not be uploaded. Try again.");
    }
    const completed=await finishGalleryUpload(profileId,revision,started.id);
    if("error" in completed){
      await discardGalleryUpload(profileId,revision,started.id);
      throw new Error(completed.error??"The cover image could not be saved.");
    }
    router.refresh();
    return started.id;
  }

  async function uploadNewAudio(){
    if(!audioFile||busy)return;
    if(audioFile.size<1||audioFile.size>15*1024*1024){
      setError("Choose an audio file up to 15 MB.");return;
    }
    if(!title.trim()){
      setError("Enter an audio title.");return;
    }
    setBusy(true);setError("");setMessage("");
    try{
      const cleanArtist=artist.trim()||"Unknown artist";
      const started=await startProfileAudioUpload(profileId,revision,title.trim(),cleanArtist,audioFile.type,audioFile.size);
      if("error" in started){setError(started.error??"Could not prepare the audio upload. Try again.");return;}
      const config=supabaseConfig();
      const browser=createBrowserClient(config.url,config.key);
      const {error:uploadError}=await browser.storage.from(profileAudioIncoming)
        .uploadToSignedUrl(started.path,started.token,audioFile,{contentType:audioFile.type,upsert:false});
      if(uploadError){
        await discardProfileAudioUpload(profileId,revision,started.id);
        setError("The audio file could not be uploaded. Check its format and try again.");
        return;
      }
      const completed=await finishProfileAudioUpload(profileId,revision,started.id);
      if("error" in completed){setError(completed.error??"The audio file could not be saved.");return;}

      let coverImageId:string|undefined;
      let coverWarning="";
      if(newCoverFile){
        try{
          coverImageId=await saveCoverAsset(newCoverFile,"Audio cover art — "+title.trim());
        }catch(reason){
          coverWarning=reason instanceof Error?reason.message:"The cover image could not be saved.";
        }
      }
      onAddTrack({title:completed.title,artist:completed.artist,url:completed.url,...(coverImageId?{coverImageId}:{})});
      await reload();
      setAddOpen(false);
      resetAddForm();
      setMessage("Audio uploaded and added to your profile draft. Save and publish to make it visible.");
      if(coverWarning)setError("Audio was uploaded, but cover art was not saved: "+coverWarning);
    }catch{
      setError("The audio upload failed. Try again with an MP3, M4A, OGG, WAV, AAC or FLAC file up to 15 MB.");
    }finally{setBusy(false);}
  }

  async function uploadCoverForTrack(item:AudioItem,file:File){
    if(coverBusy)return;
    setCoverBusy(true);setError("");setMessage("");
    try{
      const id=await saveCoverAsset(file,"Audio cover art — "+item.title);
      setCover(current=>({...current,[item.id]:id}));
      setMessage("Cover artwork added. Select it when adding this track to your profile.");
    }catch(reason){
      setError(reason instanceof Error?reason.message:"The cover image could not be saved.");
    }finally{
      setCoverBusy(false);setCoverTarget(null);
      if(coverInput.current)coverInput.current.value="";
    }
  }

  async function remove(id:string){
    setBusy(true);setError("");setMessage("");
    try{
      const result=await removeProfileAudio(profileId,id);
      if("error" in result){setError(result.error);return;}
      setMessage(result.message);
      await reload();
    }catch{
      setError("The audio file could not be removed.");
    }finally{setBusy(false);}
  }

  return <>
    <button type="button" className="button primary studio-audio-manager-open" onClick={()=>{
      setError("");setMessage("");setManagerOpen(true);void reload();
    }}>
      Click to open audio manager
    </button>

    {managerOpen&&<div className="studio-audio-modal-overlay" onMouseDown={event=>{
      if(event.target===event.currentTarget){setAddOpen(false);setManagerOpen(false);}
    }}>
      <section className="studio-audio-manager-dialog" role="dialog" aria-modal="true" aria-labelledby="studio-audio-manager-title">
        <button type="button" className="studio-audio-modal-close" aria-label="Close audio manager" onClick={()=>setManagerOpen(false)}>×</button>
        <p className="eyebrow">PROFILE ASSETS / AUDIO</p>
        <h2 id="studio-audio-manager-title">Audio Manager</h2>
        <p className="muted">Upload tracks and manage the audio used on your profile. Files stay private until linked to your draft and published.</p>
        <div className="studio-audio-manager-toolbar">
          <div><strong>Your audio</strong><span>{items.length}/30 tracks</span></div>
          <button type="button" className="button primary" onClick={()=>{setError("");setAddOpen(true);}}>+ Add Audio</button>
        </div>
        {error&&<p className="message error" role="alert">{error}</p>}
        {message&&<p className="message" role="status">{message}</p>}
        <div className="studio-audio-track-list">
          {loading?<p className="muted">Loading audio library…</p>
            :items.length===0?<div className="studio-audio-empty"><span aria-hidden="true">♫</span><strong>No audio uploaded yet</strong><p className="muted">Add an audio file to start your profile playlist.</p></div>
            :items.map(item=><article key={item.id} className="studio-audio-track">
              <div className="studio-audio-track-copy">
                <strong>{item.title}</strong><span>{item.artist}</span>
                <small>{item.extension.toUpperCase()} · {(item.bytes/1024/1024).toFixed(1)} MB</small>
              </div>
              <div className="studio-audio-cover-control stack">
                <label>Cover art<select value={cover[item.id]??""} onChange={event=>setCover(current=>({...current,[item.id]:event.target.value}))}>
                  <option value="">Use profile artwork</option>
                  {gallery.map(image=><option key={image.id} value={image.id}>{image.alt||"Gallery image"}</option>)}
                  {cover[item.id]&&!gallery.some(image=>image.id===cover[item.id])&&<option value={cover[item.id]}>New cover art</option>}
                </select></label>
                <button type="button" className="button small" disabled={coverBusy} onClick={()=>{
                  setCoverTarget(item.id);coverInput.current?.click();
                }}>{coverBusy&&coverTarget===item.id?"Uploading cover…":"Upload cover art"}</button>
              </div>
              <div className="studio-audio-track-actions">
                <button type="button" className="button small primary" onClick={()=>{
                  onAddTrack({title:item.title,artist:item.artist,url:item.url,...(cover[item.id]?{coverImageId:cover[item.id]}:{})});
                  setMessage("Track added to your profile draft. Save and publish to make it public.");
                }}>Add to profile</button>
                <button type="button" className="button small studio-audio-delete" disabled={busy} onClick={()=>void remove(item.id)}>Delete</button>
              </div>
            </article>)}
        </div>
        <p className="studio-audio-modal-note">Supported formats: MP3, M4A, OGG, WAV, AAC and FLAC. 15 MB per file · 12 uploads per day · 30 tracks per account.</p>
      </section>
    </div>}

    {addOpen&&<div className="studio-audio-modal-overlay studio-audio-add-overlay" onMouseDown={event=>{
      if(event.target===event.currentTarget)setAddOpen(false);
    }}>
      <section className="studio-audio-add-dialog" role="dialog" aria-modal="true" aria-labelledby="studio-audio-add-title">
        <button type="button" className="studio-audio-modal-close" aria-label="Close Add Audio" onClick={()=>setAddOpen(false)}>×</button>
        <h2 id="studio-audio-add-title">Add an Audio</h2>
        <div className="studio-audio-picker-grid">
          <button type="button" className={"studio-audio-picker"+(audioFile?" is-selected":"")} onClick={()=>audioInput.current?.click()}>
            <span aria-hidden="true">♫</span><strong>{audioFile?"Audio selected":"Click to upload an audio"}</strong>
            {audioFile&&<small>{audioFile.name}</small>}
          </button>
          <button type="button" className={"studio-audio-picker"+(newCoverFile?" is-selected":"")} onClick={()=>newCoverInput.current?.click()}>
            <span aria-hidden="true">▧</span><strong>{newCoverFile?"Cover selected":"Click to upload an audio cover"}</strong>
            {newCoverFile&&<small>{newCoverFile.name}</small>}
          </button>
        </div>
        <input ref={audioInput} type="file" accept={audioAccept} hidden onChange={event=>setAudioFile(event.target.files?.[0]??null)}/>
        <input ref={newCoverInput} type="file" accept={galleryTypes.join(",")} hidden onChange={event=>setNewCoverFile(event.target.files?.[0]??null)}/>
        <input ref={coverInput} type="file" accept={galleryTypes.join(",")} hidden
          onChange={event=>{
            const file=event.target.files?.[0];
            const item=items.find(track=>track.id===coverTarget);
            if(file&&item)void uploadCoverForTrack(item,file);
          }}/>
        <label className="studio-audio-title-field">Audio Title
          <input value={title} maxLength={80} onChange={event=>setTitle(event.target.value)} placeholder="Add a title…"/>
        </label>
        <label className="studio-audio-artist-field">Artist <span>(optional)</span>
          <input value={artist} maxLength={80} onChange={event=>setArtist(event.target.value)} placeholder="Artist name"/>
        </label>
        {error&&<p className="message error" role="alert">{error}</p>}
        <div className="studio-audio-add-actions">
          <button type="button" className="button" onClick={()=>setAddOpen(false)} disabled={busy}>Cancel</button>
          <button type="button" className="button primary" onClick={()=>void uploadNewAudio()} disabled={!audioFile||!title.trim()||busy}>
            {busy?"Uploading…":"Add Audio"}
          </button>
        </div>
        <p className="studio-audio-modal-note">Audio up to 15 MB. Cover art accepts JPEG, PNG or WebP up to 4 MB.</p>
      </section>
    </div>}
  </>;
}
