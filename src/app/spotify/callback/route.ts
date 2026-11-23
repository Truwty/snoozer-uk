import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { siteUrl } from "@/lib/env";
import { requireAccount } from "@/lib/profiles-server";
import { storageAdmin } from "@/lib/supabase";
import { exchangeSpotifyCode, spotifyConfigured } from "@/lib/spotify-oauth";

export const runtime = "nodejs";
const cookieName = "__Host-snoozer-spotify-oauth";
function safeEqual(a: string, b: string) {
  const left = Buffer.from(a), right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
export async function GET(request: NextRequest) {
  const jar = await cookies();
  const pending = jar.get(cookieName)?.value;
  // Clear the one-time state even when the provider denies consent.
  const finish = (result: string) => {
    const response = NextResponse.redirect(new URL("/studio/spotify?result=" + result, siteUrl()));
    response.headers.set("Cache-Control", "no-store");
    response.cookies.set(cookieName, "", {
      httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0,
    });
    return response;
  };
  if (!spotifyConfigured() || !pending) return finish("expired");
  let state: { state: string; verifier: string; userId: string; issuedAt: number };
  try {
    state = JSON.parse(pending);
    if (typeof state.state !== "string" || typeof state.verifier !== "string" ||
      typeof state.userId !== "string" || !Number.isFinite(state.issuedAt) ||
      Date.now() - state.issuedAt > 600_000 || Date.now() - state.issuedAt < 0)
      return finish("expired");
  } catch { return finish("expired"); }
  const returned = request.nextUrl.searchParams.get("state");
  if (!returned || !safeEqual(returned, state.state)) return finish("invalid");
  if (request.nextUrl.searchParams.has("error")) return finish("denied");
  const code = request.nextUrl.searchParams.get("code");
  if (!code || code.length > 2500 || !/^[A-Za-z0-9_-]+$/.test(code)) return finish("invalid");
  const { user } = await requireAccount();
  if (user.id !== state.userId) return finish("invalid");
  try {
    const spotify = await exchangeSpotifyCode(code, state.verifier);
    const { error } = await storageAdmin().rpc("spotify_private_save", {
      p_owner: user.id, p_spotify_id: spotify.spotifyId, p_access: spotify.access,
      p_refresh: spotify.refresh, p_expiry: spotify.expiry,
    });
    if (error) return finish("error");
    return finish("connected");
  } catch { return finish("error"); }
}
