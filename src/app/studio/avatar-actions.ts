"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { profileRevisionNumber } from "@/lib/profile";
import { encodeAvatar } from "@/lib/avatar";
import { avatarKey, imagesBucket, incomingBucket, pruneAvatars } from "@/lib/avatar-server";
import { requireAccount } from "@/lib/profiles-server";
import { storageAdmin } from "@/lib/supabase";

const staging = z.object({ scope: z.uuid(), key: z.string().nullable() });
const changed = "The draft changed. Reload Studio and try again.";

async function prepare(admin: ReturnType<typeof storageAdmin>, owner: string, revision: number, open: boolean) {
  const { data, error } = await admin.rpc("prepare_avatar_upload", { p_owner: owner, p_expected: revision, p_open: open });
  if (error?.code === "P1003") return { error: "You’ve started 12 avatar uploads today. Try again after midnight UTC." };
  if (error) return { error: "Couldn’t prepare the upload. Try again." };
  const result = staging.safeParse(data);
  return result.success ? { stage: result.data } : { error: changed };
}

async function clear(admin: ReturnType<typeof storageAdmin>, owner: string, revision: number, key: string) {
  const { data, error } = await admin.rpc("clear_avatar_upload", { p_owner: owner, p_expected: revision, p_key: key });
  return !error && data === true;
}

export async function requestAvatarUpload(revision: number, hasFile: boolean) {
  if (!profileRevisionNumber.safeParse(revision).success || typeof hasFile !== "boolean") return { error: changed };
  const { user } = await requireAccount();
  const admin = storageAdmin();
  const prepared = await prepare(admin, user.id, revision, hasFile);
  if (!prepared.stage) return { error: prepared.error };
  const { scope, key } = prepared.stage;
  if (!key) return { error: "Choose an image to upload." };

  const bucket = admin.storage.from(incomingBucket);
  const path = `${scope}/${key}`;
  const { data: existing, error: listError } = await bucket.list(scope, { search: key, limit: 2 });
  if (listError) return { error: "Couldn’t prepare the upload. Try again." };
  if (existing?.some(({ name }) => name === key)) return { path, uploadKey: key, staged: true as const };
  if (!hasFile) return { error: "Choose an image to upload." };

  const { data, error: uploadError } = await bucket.createSignedUploadUrl(path, { upsert: false });
  if (uploadError || !data) return { error: "Couldn’t prepare the upload. Try again." };
  const latest = await prepare(admin, user.id, revision, false);
  if (latest.stage?.key !== key) return { error: changed };
  return { path, uploadKey: key, token: data.token, staged: false as const };
}

export async function finishAvatarUpload(revision: number, expectedUploadKey: string) {
  if (!profileRevisionNumber.safeParse(revision).success) return { error: changed };
  const { user } = await requireAccount();
  const admin = storageAdmin();
  const prepared = await prepare(admin, user.id, revision, false);
  if (!prepared.stage) return { error: prepared.error };
  const { scope, key: uploadKey } = prepared.stage;
  if (!uploadKey || uploadKey !== expectedUploadKey) return { error: "This upload changed or expired. Choose the image again." };

  const { data: allowed, error: gateError } = await admin.rpc("begin_avatar_processing", { p_owner: user.id, p_expected: revision });
  if (gateError || !allowed) return { error: "Wait 20 seconds before trying again. Reload Studio if the draft changed." };

  const path = `${scope}/${uploadKey}`;
  const incoming = admin.storage.from(incomingBucket);
  const { data: file, error } = await incoming.download(path);
  if (error || !file) return { error: "Couldn’t find an uploaded image. Try again." };

  let encoded: Buffer;
  try {
    encoded = await encodeAvatar(new Uint8Array(await file.arrayBuffer()));
  } catch {
    if (!await clear(admin, user.id, revision, uploadKey)) return { error: changed };
    await incoming.remove([path]);
    return { error: "Use a single JPEG, PNG or WebP image under 2 MB and 16 megapixels." };
  }

  if (!await pruneAvatars(admin, user.id, scope)) return { error: "Avatar storage is temporarily full or unavailable. Try again later." };
  const id = randomUUID();
  const key = avatarKey(scope, id);
  const final = admin.storage.from(imagesBucket);
  const { error: writeError } = await final.upload(key, encoded, { contentType: "image/webp", upsert: false });
  if (writeError) return { error: "Couldn’t store the image. Retry the pending upload." };
  const { data: saved, error: commitError } = await admin.rpc("commit_avatar_upload", {
    p_owner: user.id, p_expected: revision, p_key: uploadKey, p_avatar: id,
  });
  if (commitError) return { error: "Couldn’t confirm the save. Reload Studio before retrying." };
  if (!saved) {
    await final.remove([key]);
    return { error: "This upload changed or expired. Reload Studio and try again." };
  }
  await incoming.remove([path]);
  revalidatePath("/studio");
  return { message: "Avatar saved to your draft." };
}

export async function discardAvatarUpload(revision: number) {
  if (!profileRevisionNumber.safeParse(revision).success) return { error: changed };
  const { user } = await requireAccount();
  const admin = storageAdmin();
  const prepared = await prepare(admin, user.id, revision, false);
  if (!prepared.stage) return { error: prepared.error };
  const { scope, key } = prepared.stage;
  if (!key) return { message: "No pending upload to discard." };
  if (!await clear(admin, user.id, revision, key)) return { error: "The pending upload changed. Try again." };
  const { error } = await admin.storage.from(incomingBucket).remove([`${scope}/${key}`]);
  return { message: error ? "Pending upload cleared. Its file will be removed by cleanup." : "Pending upload cleared." };
}
