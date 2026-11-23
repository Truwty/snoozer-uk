import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { username } from "@/lib/profile";
import { spotifyConfigured, fetchCurrentSpotifyTrack, type SpotifyPrivateClaim } from "@/lib/spotify-oauth";
import { safeCachedStatus } from "@/lib/spotify-now-playing";
import { anonymousClient, storageAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
function reply(data: unknown, code = 200) {
  return NextResponse.json(data, { status: code, headers: {
    "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
  } });
}
const claimSchema = z.object({
  owner_id: z.uuid(), access_ciphertext: z.string().min(20),
  refresh_ciphertext: z.string().min(20), expires_at: z.string(),
  cached_status: z.unknown().nullable(), checked_at: z.string().nullable(),
  should_poll: z.boolean(),
});
export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get("username") ?? "";
  if (!username.safeParse(name).success) return reply({ error: "Invalid username" }, 400);
  if (!spotifyConfigured()) return reply({ state: "unavailable" }, 503);
  try {
    const admin = storageAdmin();
    const { data, error } = await admin.rpc("spotify_private_claim", { p_name: name });
    if (error) return reply({ state: "unavailable" }, 503);
    if (!data) return reply({ state: "unavailable" }, 404);
    const parsed = claimSchema.safeParse(data);
    if (!parsed.success) return reply({ state: "unavailable" }, 503);
    const claim: SpotifyPrivateClaim = parsed.data;
    const previous = safeCachedStatus(claim.cached_status, claim.checked_at);
    if (!claim.should_poll) return previous ? reply(previous) : reply({ state: "unavailable" }, 503);

    const result = await fetchCurrentSpotifyTrack(claim, async (oldRefresh, access, refresh, expiry) => {
      const { data: rotated, error: rotateError } = await admin.rpc("spotify_private_rotate", {
        p_owner: claim.owner_id, p_old_refresh: oldRefresh, p_access: access,
        p_refresh: refresh, p_expiry: expiry,
      });
      return !rotateError && rotated === true;
    });
    if (result.revoked) {
      await admin.rpc("spotify_private_invalidate", { p_owner: claim.owner_id });
      return reply({ state: "unavailable" }, 503);
    }
    await admin.rpc("spotify_private_cache", {
      p_owner: claim.owner_id, p_status: result.status, p_delay_seconds: result.delay,
    });
    // Visibility may have changed while Spotify was being contacted. Fail closed.
    const { data: stillPublic, error: visibilityError } = await anonymousClient().rpc(
      "spotify_public_enabled", { p_name: name });
    if (visibilityError || stillPublic !== true) return reply({ state: "unavailable" }, 404);
    return result.status ? reply({ ...result.status, checkedAt: new Date().toISOString() }) :
      previous ? reply(previous) : reply({ state: "unavailable" }, 503);
  } catch {
    return reply({ state: "unavailable" }, 503);
  }
}
