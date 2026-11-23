import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { siteUrl } from "./env";
import { normaliseSpotifyPlayback, spotifyRetrySeconds, type PlayingStatus } from "./spotify-now-playing";

const accounts = "https://accounts.spotify.com";
const api = "https://api.spotify.com/v1";

export function spotifyConfigured() {
  return process.env.SPOTIFY_OAUTH_ENABLED === "true" &&
    /^[a-f\d]{32}$/i.test(process.env.SPOTIFY_CLIENT_ID ?? "") &&
    /^[a-f\d]{64}$/i.test(process.env.SPOTIFY_TOKEN_KEY_HEX ?? "") &&
    siteUrl().protocol === "https:";
}
export function spotifyRedirectUri() {
  return new URL("/spotify/callback", siteUrl()).href;
}
export function spotifyAuthoriseUrl(state: string, challenge: string) {
  const url = new URL("/authorize", accounts);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", process.env.SPOTIFY_CLIENT_ID ?? "");
  url.searchParams.set("redirect_uri", spotifyRedirectUri());
  url.searchParams.set("scope", "user-read-currently-playing user-read-private");
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("state", state);
  url.searchParams.set("show_dialog", "true");
  return url;
}
export function encryptSpotifyToken(token: string) {
  const key = Buffer.from(process.env.SPOTIFY_TOKEN_KEY_HEX ?? "", "hex");
  if (key.length !== 32 || !token || token.length > 8000) throw new Error("Spotify encryption unavailable");
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  const data = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return ["v1", nonce.toString("base64url"), cipher.getAuthTag().toString("base64url"),
    data.toString("base64url")].join(".");
}
export function decryptSpotifyToken(value: string) {
  const key = Buffer.from(process.env.SPOTIFY_TOKEN_KEY_HEX ?? "", "hex");
  const parts = value.split(".");
  if (key.length !== 32 || parts.length !== 4 || parts[0] !== "v1") throw new Error("Invalid token");
  const nonce = Buffer.from(parts[1], "base64url"), tag = Buffer.from(parts[2], "base64url");
  if (nonce.length !== 12 || tag.length !== 16) throw new Error("Invalid token");
  const decipher = createDecipheriv("aes-256-gcm", key, nonce);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(Buffer.from(parts[3], "base64url")), decipher.final()]).toString("utf8");
}
type TokenReply = { access_token: string; refresh_token?: string; expires_in: number };
function validReply(value: unknown): value is TokenReply {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string,unknown>;
  return typeof v.access_token === "string" && v.access_token.length > 10 &&
    (v.refresh_token === undefined || typeof v.refresh_token === "string") &&
    typeof v.expires_in === "number" && v.expires_in >= 60 && v.expires_in <= 86400;
}
async function tokenRequest(form: URLSearchParams): Promise<TokenReply> {
  const reply = await fetch(accounts + "/api/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form, cache: "no-store", signal: AbortSignal.timeout(8000),
  });
  if (!reply.ok) throw new Error(reply.status === 400 || reply.status === 401 ? "spotify_invalid_grant" : "spotify_provider_unavailable");
  const data: unknown = await reply.json();
  if (!validReply(data)) throw new Error("spotify_provider_unavailable");
  return data;
}
export async function exchangeSpotifyCode(code: string, verifier: string) {
  const form = new URLSearchParams({
    client_id: process.env.SPOTIFY_CLIENT_ID ?? "", grant_type: "authorization_code",
    code, code_verifier: verifier, redirect_uri: spotifyRedirectUri(),
  });
  const tokens = await tokenRequest(form);
  if (!tokens.refresh_token) throw new Error("spotify_provider_unavailable");
  const current = await fetch(api + "/me", {
    headers: { Authorization: "Bearer " + tokens.access_token },
    cache: "no-store", signal: AbortSignal.timeout(8000),
  });
  if (!current.ok) throw new Error("spotify_provider_unavailable");
  const me: unknown = await current.json();
  const id = me && typeof me === "object" && "id" in me && typeof me.id === "string" ? me.id : "";
  if (!id || id.length > 128) throw new Error("spotify_provider_unavailable");
  return {
    spotifyId: id, access: encryptSpotifyToken(tokens.access_token),
    refresh: encryptSpotifyToken(tokens.refresh_token),
    expiry: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
  };
}
export type SpotifyPrivateClaim = {
  owner_id: string; access_ciphertext: string; refresh_ciphertext: string;
  expires_at: string; cached_status: unknown; checked_at: string | null; should_poll: boolean;
};

export async function fetchCurrentSpotifyTrack(
  claim: SpotifyPrivateClaim,
  onRotate: (oldToken: string, access: string, refresh: string, expiry: string) => Promise<boolean>,
): Promise<{ status: PlayingStatus | null; delay: number; revoked?: boolean }> {
  let access = decryptSpotifyToken(claim.access_ciphertext);
  if (Date.parse(claim.expires_at) - Date.now() <= 60_000) {
    try {
      const oldRefresh = decryptSpotifyToken(claim.refresh_ciphertext);
      const tokens = await tokenRequest(new URLSearchParams({
        client_id: process.env.SPOTIFY_CLIENT_ID ?? "",
        grant_type: "refresh_token", refresh_token: oldRefresh,
      }));
      const rotated = await onRotate(claim.refresh_ciphertext, encryptSpotifyToken(tokens.access_token),
        encryptSpotifyToken(tokens.refresh_token ?? oldRefresh),
        new Date(Date.now() + tokens.expires_in * 1000).toISOString());
      if (!rotated) return { status: null, delay: 60 };
      access = tokens.access_token;
    } catch (error) {
      return { status: null, delay: 300, revoked: error instanceof Error && error.message === "spotify_invalid_grant" };
    }
  }
  try {
    const response = await fetch(api + "/me/player/currently-playing", {
      headers: { Authorization: "Bearer " + access },
      cache: "no-store", signal: AbortSignal.timeout(8000),
    });
    if (response.status === 204) return { status: { state: "idle" }, delay: 30 };
    if (response.status === 429) return { status: null, delay: spotifyRetrySeconds(response.headers.get("retry-after")) };
    if (response.status === 401 || response.status === 403) return { status: null, delay: 300, revoked: response.status === 401 };
    if (!response.ok) return { status: null, delay: 120 };
    const body: unknown = await response.json();
    return { status: normaliseSpotifyPlayback(body), delay: 30 };
  } catch {
    return { status: null, delay: 120 };
  }
}
