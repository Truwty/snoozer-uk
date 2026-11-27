import { NextResponse } from "next/server";
import { z } from "zod";
import { storageAdmin } from "@/lib/supabase";
import { profileBackgroundVideoFinal } from "@/lib/profile-background-video";

const idSchema = z.uuid();

async function serve(id: string) {
  if (!idSchema.safeParse(id).success) {
    return new NextResponse(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  try {
    const admin = storageAdmin();
    const { data, error } = await admin.rpc("get_published_profile_background_video_object", { p_id: id });
    if (error || !data || typeof data !== "object") {
      return new NextResponse(null, { status: 404, headers: { "Cache-Control": "no-store" } });
    }
    const parsed = z.object({
      scope: z.uuid(), id: z.uuid(), extension: z.enum(["mp4","webm"]),
    }).safeParse(data);
    if (!parsed.success || parsed.data.id !== id) {
      return new NextResponse(null, { status: 404, headers: { "Cache-Control": "no-store" } });
    }
    const path = parsed.data.scope + "/" + parsed.data.id + "." + parsed.data.extension;
    const { data: signed, error: signError } = await admin.storage.from(profileBackgroundVideoFinal).createSignedUrl(path, 3600);
    if (signError || !signed?.signedUrl) {
      return new NextResponse(null, { status: 404, headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.redirect(signed.signedUrl, {
      status: 307,
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new NextResponse(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return serve((await params).id);
}

export async function HEAD(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return serve((await params).id);
}
