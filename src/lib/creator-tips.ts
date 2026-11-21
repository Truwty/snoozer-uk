import {kofiProfileUrl} from "./kofi-link";

// Reuse only the creator's already published public links. No private account
// configuration, user-entered redirect URL or payment receipt crosses this edge.
export function creatorTipUrl(links:ReadonlyArray<{url:string}>):string|null {
  for(const item of links) {
    const url=kofiProfileUrl(item.url);
    if(url) return url;
  }
  return null;
}
