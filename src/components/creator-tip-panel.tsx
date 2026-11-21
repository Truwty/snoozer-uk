import {kofiProfileUrl} from "@/lib/kofi-link";

export function CreatorTipPanel({href}:{href:string|null}) {
  // Defence in depth: never render a user-provided URL without revalidating
  // the exact trusted Ko-fi profile host and path.
  const safe=href?kofiProfileUrl(href):null;
  if(!safe) return null;
  return <aside className="panel stack" aria-label="Creator tips and donations">
    <h2>Support this creator</h2>
    <p>The creator has published an external Ko-fi tipping link. You will leave Snoozer. Ko-fi may charge real money; donations do not buy this PDF, unlock downloads, count as Snoozer purchases, or generate a Snoozer tax receipt.</p>
    <a className="button secondary" href={safe} rel="noopener noreferrer" target="_blank">Visit creator on Ko-fi</a>
  </aside>;
}
