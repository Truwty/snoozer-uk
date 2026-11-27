import "server-only";
import { galleryImages, galleryIncoming } from "@/lib/gallery";
import { anonymousClient, storageAdmin } from "@/lib/supabase";

/**
 * A deliberately small, non-destructive readiness probe.
 * It verifies the public database RPC and the private storage buckets that
 * Snoozer requires to serve profile media. It never returns provider errors.
 */
export async function checkServiceReadiness(): Promise<boolean> {
  try {
    const admin = storageAdmin();
    const [lookup, buckets] = await Promise.all([
      anonymousClient().rpc("username_available", { p_name: "snoozer" }),
      Promise.all(
        ["avatar-incoming", "avatar-images", galleryIncoming, galleryImages]
          .map((bucket) => admin.storage.getBucket(bucket)),
      ),
    ]);

    return !lookup.error
      && lookup.data === false
      && buckets.every(({ data, error }) => !error && data?.public === false);
  } catch {
    // Do not expose configuration, credentials or upstream errors publicly.
    return false;
  }
}
