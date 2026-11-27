"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { profileRevisionNumber } from "@/lib/profile";
import {
  profileBackgroundVideoExtension, profileBackgroundVideoFormats, profileBackgroundVideoFinal, profileBackgroundVideoIncoming,
  profileBackgroundVideoMaxBytes, validProfileBackgroundVideoBytes,
} from "@/lib/profile-background-video";
import { requireAccount } from "@/lib/profiles-server";
import { storageAdmin } from "@/lib/supabase";

const videoId = z.uuid();
const videoMeta = z.object({
  id: z.uuid(), scope: z.uuid(), extension: z.enum(["mp4","webm"]),
  contentType: z.enum(["video/mp4","video/webm"]), bytes: z.number().int().min(12).max(profileBackgroundVideoMaxBytes),
});
const removeMeta = z.object({ scope: z.uuid(), id: z.uuid(), extension: z.enum(["mp4","webm"]) });

function changed() {
  return { error: "The profile draft changed. Refresh Studio and try again." };
}
function refresh() {
  revalidatePath("/studio");
  revalidatePath("/studio/customize");
  revalidatePath("/");
}

export async function startProfileBackgroundVideoUpload(
  profileId: string, revision: number, contentType: string, bytes: number, fileName?: string,
) {
  if (!z.uuid().safeParse(profileId).success || !profileRevisionNumber.safeParse(revision).success
    || !Number.isInteger(bytes) || bytes < 12 || bytes > profileBackgroundVideoMaxBytes) {
    return { error: "Choose an MP4 or WebM clip up to 50 MB." };
  }
  const extension = profileBackgroundVideoExtension(contentType,fileName);
  if (!extension) return { error: "Choose an MP4 or WebM video file." };

  const canonicalContentType = profileBackgroundVideoFormats[extension].contentType;
  const { user } = await requireAccount("/studio/customize");
  const admin = storageAdmin();
  const { data, error } = await admin.rpc("prepare_profile_background_video_upload", {
    p_owner: user.id, p_profile: profileId, p_expected: revision,
    p_extension: extension, p_content_type: canonicalContentType, p_bytes: bytes,
  });
  if (error?.code === "P1103") return { error: "You have reached the daily background video upload limit. Try again after midnight UTC." };
  if (error?.code === "P1104") return { error: "Your plan's media storage allowance has been reached." };
  if (error?.code === "P1105") return { error: "Your background video library can hold up to eight clips." };
  if (error || !data) return changed();

  const parsed = videoMeta.safeParse(data);
  if (!parsed.success) return changed();
  const objectPath = parsed.data.scope + "/" + parsed.data.id + "." + parsed.data.extension;
  const { data: signed, error: signError } = await admin.storage.from(profileBackgroundVideoIncoming)
    .createSignedUploadUrl(objectPath, { upsert: false });
  if (signError || !signed) return { error: "Could not prepare the private video upload. Try again." };
  return { id: parsed.data.id, path: objectPath, token: signed.token, extension, contentType: canonicalContentType };
}

export async function finishProfileBackgroundVideoUpload(profileId: string, revision: number, id: string) {
  if (!z.uuid().safeParse(profileId).success || !profileRevisionNumber.safeParse(revision).success || !videoId.safeParse(id).success) {
    return changed();
  }
  const { user } = await requireAccount("/studio/customize");
  const admin = storageAdmin();
  const { data, error } = await admin.rpc("get_profile_background_video_upload", {
    p_owner: user.id, p_profile: profileId, p_expected: revision, p_id: id,
  });
  if (error || !data) return { error: "The pending video upload expired or the profile changed. Start again." };
  const meta = videoMeta.safeParse(data);
  if (!meta.success || meta.data.id !== id) return changed();

  const objectPath = meta.data.scope + "/" + meta.data.id + "." + meta.data.extension;
  const incoming = admin.storage.from(profileBackgroundVideoIncoming);
  const { data: file, error: downloadError } = await incoming.download(objectPath);
  if (downloadError || !file) return { error: "The uploaded clip could not be found. Choose the file again." };
  if (file.size !== meta.data.bytes || file.size > profileBackgroundVideoMaxBytes) {
    await discardProfileBackgroundVideoUpload(profileId, revision, id);
    return { error: "The uploaded video size did not match. Choose it again." };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!validProfileBackgroundVideoBytes(bytes, meta.data.extension)) {
    await discardProfileBackgroundVideoUpload(profileId, revision, id);
    return { error: "The file content does not match its MP4 or WebM format." };
  }

  const final = admin.storage.from(profileBackgroundVideoFinal);
  const { error: uploadError } = await final.upload(objectPath, bytes, {
    contentType: meta.data.contentType, upsert: false, cacheControl: "0",
  });
  if (uploadError) return { error: "Could not store the background video. Retry the upload." };

  const { data: committed, error: commitError } = await admin.rpc("commit_profile_background_video_upload", {
    p_owner: user.id, p_profile: profileId, p_expected: revision, p_id: id, p_actual_bytes: file.size,
  });
  if (commitError || committed !== true) {
    await final.remove([objectPath]);
    return { error: "The background video could not be confirmed. Refresh the profile and retry." };
  }

  await incoming.remove([objectPath]);
  refresh();
  return {
    message: "Background video added to your private library.",
    asset: { id, extension: meta.data.extension, contentType: meta.data.contentType, bytes: file.size },
  };
}

export async function discardProfileBackgroundVideoUpload(profileId: string, revision: number, id: string) {
  if (!z.uuid().safeParse(profileId).success || !profileRevisionNumber.safeParse(revision).success || !videoId.safeParse(id).success) {
    return changed();
  }
  const { user } = await requireAccount("/studio/customize");
  const admin = storageAdmin();
  const { data, error } = await admin.rpc("discard_profile_background_video_upload", {
    p_owner: user.id, p_profile: profileId, p_expected: revision, p_id: id,
  });
  const parsed = removeMeta.safeParse(data);
  if (error || !parsed.success) return changed();
  await admin.storage.from(profileBackgroundVideoIncoming)
    .remove([parsed.data.scope + "/" + parsed.data.id + "." + parsed.data.extension]);
  refresh();
  return { message: "Pending background video discarded." };
}

export async function loadProfileBackgroundVideos(profileId: string) {
  if (!z.uuid().safeParse(profileId).success) return { error: "Profile unavailable.", items: [] };
  const { client } = await requireAccount("/studio/customize");
  const { data, error } = await client.rpc("list_my_profile_background_videos", { p_profile: profileId });
  if (error || !Array.isArray(data)) return { error: "Could not load your background video library.", items: [] };
  const parsed = z.array(z.object({
    id: z.uuid(), extension: z.enum(["mp4","webm"]), contentType: z.enum(["video/mp4","video/webm"]),
    bytes: z.number().int().min(12), createdAt: z.string(),
  })).safeParse(data);
  if (!parsed.success) return { error: "Could not read your background video library.", items: [] };
  return { error: "", items: parsed.data };
}

export async function removeProfileBackgroundVideo(profileId: string, id: string) {
  if (!z.uuid().safeParse(profileId).success || !videoId.safeParse(id).success) return changed();
  const { client } = await requireAccount("/studio/customize");
  const { data, error } = await client.rpc("remove_my_profile_background_video", { p_profile: profileId, p_id: id });
  if (error || !data || typeof data !== "object") return { error: "Could not remove this background clip." };
  if ("error" in data && typeof data.error === "string") return { error: data.error };
  const parsed = removeMeta.safeParse(data);
  if (!parsed.success) return { error: "Could not remove this background clip." };
  const admin = storageAdmin();
  const objectPath = parsed.data.scope + "/" + parsed.data.id + "." + parsed.data.extension;
  const { error: storageError } = await admin.storage.from(profileBackgroundVideoFinal).remove([objectPath]);
  refresh();
  return storageError
    ? { message: "Clip removed from the library. Private storage cleanup is still pending." }
    : { message: "Background clip removed from the library." };
}
