import { describe, expect, it } from "vitest";
import { spotifyEmbedUrl, spotifyLink, spotifyResource } from "../src/lib/spotify";

const id = "37i9dQZF1DXcBWIGoYBM5M";

describe("Spotify share links and official Embed URLs", () => {
  it.each(["track", "album", "playlist", "artist", "show", "episode"] as const)(
    "recognises an official %s URL and constructs an allowlisted iframe source", (kind) => {
      const source = `https://open.spotify.com/${kind}/${id}?si=tracking-source&nd=1#fragment`;
      expect(spotifyResource(source)).toEqual({ kind, id });
      expect(spotifyLink({ kind, id })).toBe(`https://open.spotify.com/${kind}/${id}`);
      expect(spotifyEmbedUrl({ kind, id })).toBe(`https://open.spotify.com/embed/${kind}/${id}`);
      expect(spotifyEmbedUrl({ kind, id })).not.toContain("tracking");
    },
  );

  it("supports locale-prefixed Spotify sharing but not user-selected iframe parameters", () => {
    expect(spotifyResource(`https://open.spotify.com/intl-en/track/${id}?context=spotify:playlist:abc`))
      .toEqual({ kind: "track", id });
    expect(spotifyResource(`https://open.spotify.com/intl-de-DE/album/${id}`))
      .toEqual({ kind: "album", id });
  });

  it.each([
    `http://open.spotify.com/track/${id}`,
    `https://open.spotify.com.evil.example/track/${id}`,
    `https://evil.open.spotify.com/track/${id}`,
    `https://user:pass@open.spotify.com/track/${id}`,
    `https://open.spotify.com:444/track/${id}`,
    `https://spotify.link/${id}`,
    `https://open.spotify.com/embed/track/${id}`,
    `https://open.spotify.com/user/fixture/playlist/${id}`,
    `https://open.spotify.com/track/${id}/extra`,
    `https://open.spotify.com/track/${id}%2Fextra`,
    "https://open.spotify.com/track/bad",
    "javascript:alert(1)",
    "https://open.spotify.com/collection/tracks",
  ])("refuses unrecognised or deceptive embed input: %s", (url) => {
    expect(spotifyResource(url)).toBeNull();
  });

  it("never constructs an iframe from an unvalidated resource ID", () => {
    expect(spotifyEmbedUrl({ kind: "track", id: "../attacker" })).toBeNull();
    expect(spotifyLink({ kind: "track", id: "<script>" })).toBeNull();
    expect(spotifyEmbedUrl({ kind: "foo" as "track", id })).toBeNull();
  });
});
