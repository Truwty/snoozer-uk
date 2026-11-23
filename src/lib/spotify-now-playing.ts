import { spotifyLink } from "./spotify";
export type PlayingStatus =
  | { state: "idle" }
  | { state: "playing"; track: { title: string; artist: string; url: string } };
export type PublicPlayingStatus = PlayingStatus & { checkedAt: string };

export function normaliseSpotifyPlayback(value: unknown): PlayingStatus {
  if (!value || typeof value !== "object") return { state: "idle" };
  const result = value as Record<string, unknown>;
  if (result.is_playing !== true || result.currently_playing_type !== "track" ||
    !result.item || typeof result.item !== "object") return { state: "idle" };
  const item = result.item as Record<string, unknown>;
  if (item.type !== "track" || item.is_local === true || typeof item.id !== "string" ||
    typeof item.name !== "string" || !Array.isArray(item.artists)) return { state: "idle" };
  const url = spotifyLink({ kind: "track", id: item.id });
  const artists = item.artists
    .filter((a) => a && typeof a === "object" && typeof (a as {name?: unknown}).name === "string")
    .map((a) => (a as {name: string}).name.trim())
    .filter(Boolean).slice(0, 4).join(", ");
  const title = item.name.trim();
  if (!url || !title || !artists) return { state: "idle" };
  return { state: "playing", track: { title: title.slice(0, 160), artist: artists.slice(0, 160), url } };
}

export function safeCachedStatus(value: unknown, fetchedAt: unknown, now = Date.now()): PublicPlayingStatus | null {
  if (typeof fetchedAt !== "string") return null;
  const time = Date.parse(fetchedAt);
  if (!Number.isFinite(time) || now - time > 120_000 || now - time < -30_000 ||
    !value || typeof value !== "object") return null;
  const status = value as Record<string, unknown>;
  if (status.state === "idle") return { state: "idle", checkedAt: fetchedAt };
  if (status.state !== "playing" || !status.track || typeof status.track !== "object") return null;
  const track = status.track as Record<string, unknown>;
  if (typeof track.title !== "string" || typeof track.artist !== "string" ||
    typeof track.url !== "string" || track.title.length > 160 || track.artist.length > 160) return null;
  const parsed = track.url.match(/^https:\/\/open\.spotify\.com\/track\/([A-Za-z0-9]{22})$/);
  if (!parsed) return null;
  return { state: "playing", checkedAt: fetchedAt,
    track: { title: track.title, artist: track.artist, url: track.url } };
}

export function spotifyRetrySeconds(value: string | null) {
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds >= 30 ? Math.min(3600, Math.floor(seconds)) : 60;
}
