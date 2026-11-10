import { galleryImages, galleryIncoming } from "@/lib/gallery";
import { anonymousClient, storageAdmin } from "@/lib/supabase";

export async function GET() {
  let ready = false;
  try {
    const admin = storageAdmin();
    const [lookup, buckets] = await Promise.all([
      anonymousClient().rpc("username_available", { p_name: "snoozer" }),
      Promise.all(["avatar-incoming", "avatar-images", galleryIncoming, galleryImages]
        .map((bucket) => admin.storage.getBucket(bucket))),
    ]);
    ready = !lookup.error && lookup.data === false && buckets.every(({ data, error }) => !error && data?.public === false);
  } catch {
    // Runtime misconfiguration and upstream failures share the same public response.
  }
  return Response.json({ status: ready ? "ready" : "unavailable" }, {
    status: ready ? 200 : 503, headers: { "Cache-Control": "no-store" },
  });
}
