import { describe, expect, it } from "vitest";
import { normaliseSpotifyPlayback, safeCachedStatus, spotifyRetrySeconds } from "@/lib/spotify-now-playing";
const trackId = "4iV5W9uYEdYUVa79Axb7Rh";
const song = { is_playing: true, currently_playing_type: "track", item: {
  id: trackId, type: "track", name: "A Song", is_local: false,
  artists: [{ name: "Artist One" }, { name: "Artist Two" }],
} };
describe("Spotify Now Playing public boundary", () => {
  it("allows only canonical official track links from validated playing items", () => {
    expect(normaliseSpotifyPlayback(song)).toEqual({ state: "playing", track: {
      title: "A Song", artist: "Artist One, Artist Two",
      url: "https://open.spotify.com/track/" + trackId,
    } });
  });
  it("does not disclose paused, local, missing, invalid, non-track or private content", () => {
    expect(normaliseSpotifyPlayback({ ...song, is_playing: false })).toEqual({ state: "idle" });
    expect(normaliseSpotifyPlayback({ ...song, item: { ...song.item, is_local: true } })).toEqual({ state: "idle" });
    expect(normaliseSpotifyPlayback({ ...song, item: { ...song.item, id: "javascript:alert(1)" } })).toEqual({ state: "idle" });
    expect(normaliseSpotifyPlayback({ ...song, currently_playing_type: "ad" })).toEqual({ state: "idle" });
    expect(normaliseSpotifyPlayback(null)).toEqual({ state: "idle" });
  });
  it("rejects stale or forged cache entries and normalises public URL", () => {
    const time = new Date().toISOString();
    const safe = {state: "playing",track:{title:"A Song",artist:"An Artist",url:"https://open.spotify.com/track/"+trackId}};
    expect(safeCachedStatus(safe,time)?.state).toBe("playing");
    expect(safeCachedStatus({...safe,track:{...safe.track,url:"https://attacker.example/"}},time)).toBeNull();
    expect(safeCachedStatus(safe,new Date(Date.now()-121000).toISOString())).toBeNull();
    expect(safeCachedStatus(safe,"not-a-date")).toBeNull();
    expect(safeCachedStatus({state:"idle"},time)?.state).toBe("idle");
  });
  it("caps 429 backoff at one hour and never retries under 30 seconds", () => {
    expect(spotifyRetrySeconds("99999")).toBe(3600);
    expect(spotifyRetrySeconds("4")).toBe(60);
    expect(spotifyRetrySeconds("60")).toBe(60);
    expect(spotifyRetrySeconds("NaN")).toBe(60);
  });
});
