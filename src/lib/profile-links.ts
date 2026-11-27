import type { ProfileContent } from "./profile";

/**
 * Canonicalise profile link URLs without discarding presentation metadata.
 *
 * Keep this in one place because the RPC persists the supplied JSON objects:
 * text mode, custom gallery icons and audio cover selections must survive both
 * draft saves and publication.
 */
export function normalizeProfileLinks(links: ProfileContent["links"]) {
  return links.map((link) => ({
    ...link,
    url: new URL(link.url).href,
    hidden: link.hidden ?? false,
  }));
}
