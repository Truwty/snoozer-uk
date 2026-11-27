"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { profileRevisionNumber } from "@/lib/profile";
import { profileAudioExtension, profileAudioFormats, profileAudioFinal, profileAudioIncoming, profileAudioMaxBytes, validProfileAudioBytes } from "@/lib/profile-audio";
import { requireAccount } from "@/lib/profiles-server";
import { storageAdmin } from "@/lib/supabase";

const metadataSchema=z.object({
  id:z.uuid(),scope:z.uuid(),extension:z.enum(["mp3","m4a","ogg","wav","aac","flac"]),
  contentType:z.string(),title:z.string(),artist:z.string(),bytes:z.number().int().positive(),
});
const removeSchema=z.object({scope:z.uuid(),id:z.uuid(),extension:z.enum(["mp3","m4a","ogg","wav","aac","flac"])});

function changed(){return {error:"The profile draft changed. Refresh Studio and try again."};}
function refresh(){revalidatePath("/studio");revalidatePath("/studio/customize");revalidatePath("/");}

export async function startProfileAudioUpload(profileId:string,revision:number,title:string,artist:string,contentType:string,bytes:number,fileName?:string){
  if(!z.uuid().safeParse(profileId).success||!profileRevisionNumber.safeParse(revision).success
    ||!z.string().trim().min(1).max(80).safeParse(title).success
    ||!z.string().trim().min(1).max(80).safeParse(artist).success
    ||!Number.isInteger(bytes)||bytes<1||bytes>profileAudioMaxBytes)return {error:"Use a title and artist (up to 80 characters) and an audio file up to 15 MB."};
  const extension=profileAudioExtension(contentType,fileName);
  if(!extension)return {error:"Choose an MP3, M4A, OGG, WAV, AAC or FLAC audio file."};
  const canonicalContentType=profileAudioFormats[extension].contentType;
  const {user}=await requireAccount("/studio/customize");
  const admin=storageAdmin();
  const {data,error}=await admin.rpc("prepare_profile_audio_upload",{
    p_owner:user.id,p_profile:profileId,p_expected:revision,p_title:title,p_artist:artist,
    p_extension:extension,p_content_type:canonicalContentType,p_bytes:bytes,
  });
  if(error?.code==="P1103")return {error:"You have reached the daily audio upload limit. Try again after midnight UTC."};
  if(error?.code==="P1104")return {error:"Your plan's media storage allowance has been reached."};
  if(error?.code==="P1105")return {error:"Your audio library can hold up to 30 tracks."};
  if(error||!data)return changed();
  const stage=metadataSchema.safeParse(data);
  if(!stage.success)return changed();
  const path=`${stage.data.scope}/${stage.data.id}.${stage.data.extension}`;
  const {data:signed,error:signError}=await admin.storage.from(profileAudioIncoming).createSignedUploadUrl(path,{upsert:false});
  if(signError||!signed)return {error:"Could not prepare the private upload. Try again."};
  return {id:stage.data.id,path,token:signed.token,extension,contentType:canonicalContentType};
}

export async function finishProfileAudioUpload(profileId:string,revision:number,id:string){
  if(!z.uuid().safeParse(profileId).success||!profileRevisionNumber.safeParse(revision).success||!z.uuid().safeParse(id).success)return changed();
  const {user}=await requireAccount("/studio/customize");
  const admin=storageAdmin();
  const {data,error}=await admin.rpc("get_profile_audio_upload",{
    p_owner:user.id,p_profile:profileId,p_expected:revision,p_id:id,
  });
  if(error||!data)return {error:"The pending audio upload expired or the profile changed. Start again."};
  const meta=metadataSchema.safeParse(data);
  if(!meta.success)return changed();
  const incoming=admin.storage.from(profileAudioIncoming);
  const path=`${meta.data.scope}/${meta.data.id}.${meta.data.extension}`;
  const {data:file,error:downloadError}=await incoming.download(path);
  if(downloadError||!file)return {error:"The upload could not be found. Choose the file again."};
  if(file.size!==meta.data.bytes||file.size>profileAudioMaxBytes){
    await discardProfileAudioUpload(profileId,revision,id);
    return {error:"The uploaded file size did not match. Choose it again."};
  }
  const bytes=new Uint8Array(await file.arrayBuffer());
  if(!validProfileAudioBytes(bytes,meta.data.extension)){
    await discardProfileAudioUpload(profileId,revision,id);
    return {error:"The file content does not match the selected audio format."};
  }
  const final=admin.storage.from(profileAudioFinal);
  const {error:uploadError}=await final.upload(path,bytes,{contentType:meta.data.contentType,upsert:false,cacheControl:"0"});
  if(uploadError)return {error:"Could not store the processed audio. Try finishing the upload again."};
  const {data:committed,error:commitError}=await admin.rpc("commit_profile_audio_upload",{
    p_owner:user.id,p_profile:profileId,p_expected:revision,p_id:id,p_actual_bytes:file.size,
  });
  if(commitError||committed!==true){
    await final.remove([path]);
    return {error:"The upload could not be confirmed. Refresh the profile and retry."};
  }
  await incoming.remove([path]);
  refresh();
  return {message:"Track added to your private audio library.",url:"/media/audio/"+id+"."+meta.data.extension,
    title:meta.data.title,artist:meta.data.artist,id};
}

export async function discardProfileAudioUpload(profileId:string,revision:number,id:string){
  if(!z.uuid().safeParse(profileId).success||!profileRevisionNumber.safeParse(revision).success||!z.uuid().safeParse(id).success)return changed();
  const {user}=await requireAccount("/studio/customize");
  const admin=storageAdmin();
  const {data,error}=await admin.rpc("discard_profile_audio_upload",{p_owner:user.id,p_profile:profileId,p_expected:revision,p_id:id});
  const parsed=removeSchema.safeParse(data);
  if(error||!parsed.success)return changed();
  const path=`${parsed.data.scope}/${parsed.data.id}.${parsed.data.extension}`;
  await admin.storage.from(profileAudioIncoming).remove([path]);
  refresh();
  return {message:"Pending audio upload discarded."};
}

export async function loadProfileAudio(profileId:string){
  if(!z.uuid().safeParse(profileId).success)return {error:"Profile unavailable.",items:[]};
  const {client}=await requireAccount("/studio/customize");
  const {data,error}=await client.rpc("list_my_profile_audio",{p_profile:profileId});
  if(error||!Array.isArray(data))return {error:"Could not load the audio library.",items:[]};
  const items=z.array(z.object({
    id:z.uuid(),title:z.string(),artist:z.string(),extension:z.enum(["mp3","m4a","ogg","wav","aac","flac"]),
    contentType:z.string(),bytes:z.number().int().positive(),createdAt:z.string(),
  })).safeParse(data);
  if(!items.success)return {error:"Could not read the audio library.",items:[]};
  return {error:"",items:items.data.map(item=>({...item,url:"/media/audio/"+item.id+"."+item.extension}))};
}

export async function removeProfileAudio(profileId:string,id:string){
  if(!z.uuid().safeParse(profileId).success||!z.uuid().safeParse(id).success)return changed();
  const {client}=await requireAccount("/studio/customize");
  const {data,error}=await client.rpc("remove_my_profile_audio",{p_profile:profileId,p_id:id});
  if(error||!data||typeof data!=="object")return {error:"Could not remove this track."};
  if("error" in data && typeof data.error==="string")return {error:data.error};
  const parsed=removeSchema.safeParse(data);
  if(!parsed.success)return {error:"Could not remove this track."};
  const path=`${parsed.data.scope}/${parsed.data.id}.${parsed.data.extension}`;
  const admin=storageAdmin();
  const {error:storageError}=await admin.storage.from(profileAudioFinal).remove([path]);
  refresh();
  return storageError?{message:"Track removed from the library. Private storage cleanup is still pending."}:{message:"Track removed from the audio library."};
}
