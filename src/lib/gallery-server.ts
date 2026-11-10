import "server-only";
import { z } from "zod";
import { galleryAlt, galleryImages } from "./gallery";
import { storageAdmin } from "./supabase";

export const galleryStage = z.object({ scope: z.uuid(), id: z.uuid(), alt: galleryAlt });
export const stagePath = (scope: string, id: string) => scope + "/" + id + ".upload";
export const imagePath = (scope: string, variant: string) => scope + "/" + variant + ".webp";

export async function serveGalleryImage(id: string, access: { p_name: string } | { p_owner: string }) {
  if (!z.uuid().safeParse(id).success) return new Response(null, { status: 404 });
  const admin = storageAdmin();
  const { data, error } = await admin.rpc("gallery_object", { p_id: id, ...access });
  if (error) return new Response(null, { status: 503 });
  if (!data) return new Response(null, { status: 404 });
  const result = z.object({ scope: z.uuid(), variant: z.uuid() }).safeParse(data);
  if (!result.success) return new Response(null, { status: 503 });
  const { scope, variant } = result.data;
  const { data: file, error: storageError } = await admin.storage.from(galleryImages).download(imagePath(scope, variant));
  if (storageError || !file) return new Response(null, { status: 503 });
  return new Response(file, { headers: {
    "Content-Type": "image/webp",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, no-store",
  } });
}
