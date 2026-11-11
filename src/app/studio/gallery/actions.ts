"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { galleryAlt, galleryImages, galleryIncoming, galleryMaxBytes } from "@/lib/gallery";
import { encodeGalleryImage } from "@/lib/gallery-codec";
import { galleryStage, imagePath, stagePath } from "@/lib/gallery-server";
import { profileRevisionNumber } from "@/lib/profile";
import { requireAccount } from "@/lib/profiles-server";
import { storageAdmin } from "@/lib/supabase";

const changed = "The draft or pending upload changed. Refresh and try again.";
function refreshGallery() {
  revalidatePath("/studio");
  revalidatePath("/studio/gallery");
}

export async function startGalleryUpload(revision: number, description: string) {
  const alt = galleryAlt.safeParse(description);
  if (!profileRevisionNumber.safeParse(revision).success || !alt.success) {
    return { error: "Enter an image description between 1 and 180 characters." };
  }
  const { user } = await requireAccount();
  const admin = storageAdmin();
  const { data, error } = await admin.rpc("prepare_gallery_upload", {
    p_owner: user.id, p_expected: revision, p_alt: alt.data,
  });
  if (error?.code === "P1101") return { error: "The gallery holds up to eight images. Remove one before adding another." };
  if (error?.code === "P1102") return { error: "Your media storage is full. Older images are cleared as their publications expire." };
  if (error?.code === "P1103") return { error: "You’ve started 12 gallery uploads today. Try again after midnight UTC." };
  if (error) return { error: "Couldn’t prepare the upload. Try again." };
  const stage = galleryStage.safeParse(data);
  if (!stage.success) return { error: changed };
  const { scope, id } = stage.data;
  if (stage.data.alt !== alt.data) return { error: "Another upload is pending. Finish or discard it first." };
  const path = stagePath(scope, id);
  const bucket = admin.storage.from(galleryIncoming);
  const name = id + ".upload";
  const { data: existing, error: listError } = await bucket.list(scope, { search: name, limit: 2 });
  if (listError) return { error: "Couldn’t check the pending upload. Try again." };
  if (existing?.some((entry) => entry.name === name)) {
    return { error: "An image is already staged. Finish or discard that upload first." };
  }
  const { data: signed, error: signError } = await bucket.createSignedUploadUrl(path, { upsert: false });
  if (signError || !signed) return { error: "Couldn’t open the upload. Try again." };
  return { path, id, token: signed.token };
}

export async function finishGalleryUpload(revision: number, id: string) {
  if (!profileRevisionNumber.safeParse(revision).success || !z.uuid().safeParse(id).success) return { error: changed };
  const { user } = await requireAccount();
  const admin = storageAdmin();
  const { data, error } = await admin.rpc("prepare_gallery_upload", {
    p_owner: user.id, p_expected: revision, p_alt: null, p_id: id,
  });
  if (error) return { error: "Couldn’t prepare the image. Try again." };
  const stage = galleryStage.safeParse(data);
  if (!stage.success) return { error: "Wait 20 seconds and try again. Refresh if the draft has changed." };
  const incoming = admin.storage.from(galleryIncoming);
  const key = stagePath(stage.data.scope, id);
  const { data: file, error: readError } = await incoming.download(key);
  if (readError || !file) return { error: "Couldn’t find the uploaded image. Choose the file again or discard this upload." };
  let encoded;
  try {
    if (file.size > galleryMaxBytes) throw new Error("Invalid file size.");
    encoded = await encodeGalleryImage(new Uint8Array(await file.arrayBuffer()));
  } catch {
    await discardGalleryUpload(revision, id);
    return { error: "Choose a single JPEG, PNG or WebP image under 4 MB and 16 megapixels." };
  }
  const variant = randomUUID();
  const final = admin.storage.from(galleryImages);
  const destination = imagePath(stage.data.scope, variant);
  const { error: writeError } = await final.upload(destination, encoded.data, { contentType: "image/webp", upsert: false });
  if (writeError) return { error: "Couldn’t store the processed image. Retry in a moment." };
  const { data: saved, error: commitError } = await admin.rpc("commit_gallery_upload", {
    p_owner: user.id, p_expected: revision, p_id: id, p_variant: variant,
    p_width: encoded.info.width, p_height: encoded.info.height,
  });
  if (commitError) return { error: "Couldn’t confirm the save. Refresh the gallery before retrying." };
  if (!saved) {
    await final.remove([destination]);
    return { error: changed };
  }
  await incoming.remove([key]);
  refreshGallery();
  return { message: "Image added to your draft. Publish in Studio to make it visible." };
}

export async function discardGalleryUpload(revision: number, id: string) {
  if (!profileRevisionNumber.safeParse(revision).success || !z.uuid().safeParse(id).success) return { error: changed };
  const { user } = await requireAccount();
  const admin = storageAdmin();
  const { data, error } = await admin.rpc("discard_gallery_upload", {
    p_owner: user.id, p_expected: revision, p_id: id,
  });
  if (error || !z.uuid().safeParse(data).success) return { error: changed };
  await admin.storage.from(galleryIncoming).remove([stagePath(data, id)]);
  refreshGallery();
  return { message: "Pending upload discarded." };
}

export async function editGallery(revision: number, id: string, operation: "earlier" | "later" | "remove") {
  if (!profileRevisionNumber.safeParse(revision).success || !z.uuid().safeParse(id).success
    || !["earlier", "later", "remove"].includes(operation)) return { error: changed };
  const { client } = await requireAccount();
  const { data, error } = await client.rpc("edit_gallery", { p_expected: revision, p_id: id, p_operation: operation });
  if (error || !data) return { error: changed };
  refreshGallery();
  return { message: operation === "remove" ? "Image removed from your draft." : "Gallery order saved to your draft." };
}

export async function addLibraryImage(revision: number, id: string) {
  if (!profileRevisionNumber.safeParse(revision).success || !z.uuid().safeParse(id).success) return { error: changed };
  const { client } = await requireAccount();
  const { data, error } = await client.rpc("add_library_image_to_gallery", { p_expected: revision, p_id: id });
  refreshGallery();
  revalidatePath("/studio/gallery/folders");
  if (error) return { error: "Couldn’t add the image. Try again." };
  if (data === "limit") return { error: "Your draft gallery holds up to eight images." };
  if (data === "unavailable") return { error: "That image is no longer available to add." };
  if (data !== "added") return { error: changed };
  return { message: "Image added to your draft. Publish in Studio to make it visible." };
}
