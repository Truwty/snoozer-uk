import "server-only";
import { storageAdmin } from "./supabase";

export const incomingBucket = "avatar-incoming";
export const imagesBucket = "avatar-images";
export const pendingPath = (scope: string) => `${scope}/pending`;
export const avatarKey = (scope: string, avatar: string) => `${scope}/${avatar}.webp`;

export async function pruneAvatars(admin: ReturnType<typeof storageAdmin>, owner: string, scope: string) {
  const bucket = admin.storage.from(imagesBucket);
  const { data: files, error: listError } = await bucket.list(scope, { limit: 40 });
  if (listError || !files) return false;
  const { data: referenced, error } = await admin.rpc("avatar_references", { p_owner: owner });
  if (error || !Array.isArray(referenced)) return false;
  const referencedNames = new Set(referenced.map((id: string) => `${id}.webp`));
  // A freshly uploaded derivative can be between Storage and the database commit.
  const stale = files.filter((file) =>
    !referencedNames.has(file.name) && Date.parse(file.created_at ?? "") < Date.now() - 3_600_000);
  if (stale.length) {
    const { error: removeError } = await bucket.remove(stale.map((file) => `${scope}/${file.name}`));
    if (removeError) return false;
  }
  return files.length - stale.length < 40;
}

export async function serveAvatar(scope: string, avatar: string) {
  const admin = storageAdmin();
  const { data, error } = await admin.storage.from(imagesBucket).download(avatarKey(scope, avatar));
  if (error || !data) return new Response(null, { status: 404 });
  return new Response(data, { headers: {
    "Content-Type": "image/webp",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, no-store",
  } });
}
