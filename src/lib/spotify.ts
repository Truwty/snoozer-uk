/**
 * Spotify Web Embeds require neither a Web API client ID nor an OAuth token.
 * Parse official share links only. Never use submitted URLs as iframe sources.
 */
export const spotifyKinds = ["track", "album", "playlist", "artist", "show", "episode"] as const;
export type SpotifyKind = typeof spotifyKinds[number];
export type SpotifyResource = { kind: SpotifyKind; id: string };

const validId = /^[A-Za-z0-9]{22}$/;

export function spotifyResource(value: string): SpotifyResource | null {
  let url: URL;
  try { url = new URL(value); } catch { return null; }
  if (url.protocol !== "https:" || url.hostname !== "open.spotify.com" ||
    url.username || url.password || url.port) return null;
  // Optional Spotify language prefixes appear on some shared URLs.
  const match = url.pathname.match(/^\/(?:intl-[a-z]{2}(?:-[A-Z]{2})?\/)?(track|album|playlist|artist|show|episode)\/([A-Za-z0-9]{22})\/?$/);
  if (!match) return null;
  return { kind: match[1] as SpotifyKind, id: match[2] };
}

export function spotifyLink(resource: SpotifyResource): string | null {
  if (!spotifyKinds.includes(resource.kind) || !validId.test(resource.id)) return null;
  return `https://open.spotify.com/${resource.kind}/${resource.id}`;
}

export function spotifyEmbedUrl(resource: SpotifyResource): string | null {
  if (!spotifyKinds.includes(resource.kind) || !validId.test(resource.id)) return null;
  return `https://open.spotify.com/embed/${resource.kind}/${resource.id}`;
}
