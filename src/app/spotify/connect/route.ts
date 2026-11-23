import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { requireAccount } from "@/lib/profiles-server";
import { siteUrl } from "@/lib/env";
import { spotifyAuthoriseUrl, spotifyConfigured } from "@/lib/spotify-oauth";

export const runtime = "nodejs";
export async function GET() {
  const { user } = await requireAccount();
  if (!spotifyConfigured())
    return NextResponse.redirect(new URL("/studio/spotify?result=unavailable", siteUrl()));
  const state = randomBytes(32).toString("base64url");
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const response = NextResponse.redirect(spotifyAuthoriseUrl(state, challenge));
  response.headers.set("Cache-Control", "no-store");
  response.cookies.set("__Host-snoozer-spotify-oauth", JSON.stringify({
    state, verifier, userId: user.id, issuedAt: Date.now(),
  }), { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 600 });
  return response;
}
