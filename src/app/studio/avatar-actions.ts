"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { profileRevision } from "@/lib/profile";
import { encodeAvatar } from "@/lib/avatar";
import { avatarKey, imagesBucket, incomingBucket, pendingPath, pruneAvatars } from "@/lib/avatar-server";
import { requireAccount } from "@/lib/profiles-server";
import { storageAdmin } from "@/lib/supabase";

async function readScope(client: Awaited<ReturnType<typeof requireAccount>>["client"], revision: number) {
  const { data, error } = await client.rpc("draft_media_scope", { p_expected: revision });
  return !error && typeof data === "string" ? data : null;
}

export async function requestAvatarUpload(revision: number) {
  if (typeof revision !== "number" || !profileRevision.safeParse(revision).success) return { error: "Reload Studio and try again." };
  const { client } = await requireAccount();
  const scope = await readScope(client, revision);
  if (!scope) return { error: "The draft changed. Reload Studio and try again." };

  const admin = storageAdmin();
  const bucket = admin.storage.from(incomingBucket);
  const path = pendingPath(scope);
  const { data: existing, error: listError } = await bucket.list(scope, { search: "pending", limit: 1 });
  if (listError) return { error: "Couldn’t prepare the upload. Try again." };
  if (existing?.length) return { path, staged: true as const };
  const { data, error: uploadError } = await bucket.createSignedUploadUrl(path, { upsert: false });
  if (uploadError || !data) return { error: "Couldn’t prepare the upload. Try again." };
  if (await readScope(client, revision) !== scope) return { error: "The draft changed. Reload Studio and try again." };
  return { path, token: data.token, staged: false as const };
}

export async function finishAvatarUpload(revision: number) {
  if (typeof revision !== "number" || !profileRevision.safeParse(revision).success) return { error: "Reload Studio and try again." };
  const { client, user } = await requireAccount();
  const scope = await readScope(client, revision);
  if (!scope) return { error: "The draft changed. Reload Studio and try again." };
  const admin = storageAdmin();
  const { data: allowed, error: gateError } = await admin.rpc("begin_avatar_processing", { p_owner: user.id, p_expected: revision });
  if (gateError || !allowed) return { error: "Wait 20 seconds before trying again. Reload Studio if the draft changed." };

  const path = pendingPath(scope);
  const incoming = admin.storage.from(incomingBucket);
  const { data: file, error } = await incoming.download(path);
  if (error || !file) return { error: "Couldn’t find an uploaded image. Try again." };

  let encoded: Buffer;
  try {
    encoded = await encodeAvatar(new Uint8Array(await file.arrayBuffer()));
  } catch {
    const { error: removal } = await incoming.remove([path]);
    return { error: removal ? "The image was invalid and couldn’t be cleared. Try discarding the pending upload."
      : "Use a single JPEG, PNG or WebP image under 2 MB and 16 megapixels." };
  }

  if (!await pruneAvatars(admin, user.id, scope)) return { error: "Avatar storage is temporarily full or unavailable. Try again later." };
  const id = randomUUID();
  const key = avatarKey(scope, id);
  const final = admin.storage.from(imagesBucket);
  const { error: writeError } = await final.upload(key, encoded, { contentType: "image/webp", upsert: false });
  if (writeError) return { error: "Couldn’t store the image. Retry the pending upload." };
  const { data: saved, error: commitError } = await admin.rpc("set_avatar", { p_owner: user.id, p_expected: revision, p_avatar: id });
  if (commitError) return { error: "Couldn’t confirm the save. Reload Studio before retrying." };
  if (!saved) {
    await final.remove([key]);
    return { error: "Your draft changed. Reload Studio and retry the pending upload." };
  }
  const { error: cleanupError } = await incoming.remove([path]);
  revalidatePath("/studio");
  return { message: cleanupError ? "Avatar saved. Discard the pending upload before adding another image." : "Avatar saved to your draft." };
}

export async function discardAvatarUpload(revision: number) {
  if (typeof revision !== "number" || !profileRevision.safeParse(revision).success) return { error: "Reload Studio and try again." };
  const { client } = await requireAccount();
  const scope = await readScope(client, revision);
  if (!scope) return { error: "The draft changed. Reload Studio and try again." };
  const { error } = await storageAdmin().storage.from(incomingBucket).remove([pendingPath(scope)]);
  return error ? { error: "Couldn’t discard the pending upload. Try again." } : { message: "Pending upload cleared." };
}
