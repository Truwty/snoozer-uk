import { NextResponse } from "next/server";
import { z } from "zod";
import { storageAdmin } from "@/lib/supabase";
import { profileAudioFinal } from "@/lib/profile-audio";

const filenameSchema=z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:mp3|m4a|ogg|wav|aac|flac)$/i);

async function serve(file:string) {
  if(!filenameSchema.safeParse(file).success) {
    return new NextResponse(null,{status:404,headers:{"Cache-Control":"no-store"}});
  }
  try {
    const admin=storageAdmin();
    const {data,error}=await admin.rpc("get_published_profile_audio_object",{p_filename:file});
    if(error||!data||typeof data!=="object") {
      return new NextResponse(null,{status:404,headers:{"Cache-Control":"no-store"}});
    }
    const object=z.object({scope:z.uuid(),id:z.uuid(),extension:z.enum(["mp3","m4a","ogg","wav","aac","flac"])}).safeParse(data);
    if(!object.success||object.data.id+"."+object.data.extension!==file) {
      return new NextResponse(null,{status:404,headers:{"Cache-Control":"no-store"}});
    }
    const path=object.data.scope+"/"+file;
    const {data:signed,error:signError}=await admin.storage.from(profileAudioFinal).createSignedUrl(path,3600);
    if(signError||!signed?.signedUrl) {
      return new NextResponse(null,{status:404,headers:{"Cache-Control":"no-store"}});
    }
    return NextResponse.redirect(signed.signedUrl,{
      status:307,
      headers:{
        "Cache-Control":"private, no-store, max-age=0",
        "Referrer-Policy":"no-referrer",
        "X-Content-Type-Options":"nosniff"
      }
    });
  } catch {
    return new NextResponse(null,{status:404,headers:{"Cache-Control":"no-store"}});
  }
}

export async function GET(_request:Request,{params}:{params:Promise<{file:string}>}) {
  return serve((await params).file);
}

export async function HEAD(_request:Request,{params}:{params:Promise<{file:string}>}) {
  return serve((await params).file);
}
