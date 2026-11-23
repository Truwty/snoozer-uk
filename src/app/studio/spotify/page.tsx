import Link from "next/link";
import { requireAccount } from "@/lib/profiles-server";

export const metadata = { title: "Spotify embeds · Studio", robots: { index: false, follow: false } };

export default async function Page() {
  await requireAccount();
  return <main className="shell">
    <nav className="nav studio-subnav"><Link className="button small" href="/studio">Back to Studio</Link></nav>
    <section className="panel stack">
      <p className="eyebrow">STUDIO / INTEGRATIONS</p>
      <h1>Spotify embeds</h1>
      <p className="muted">Add music to your Snoozer profile for free. No Spotify Premium, developer application, account connection or Spotify API token is needed.</p>
      <ol className="stack">
        <li>In Spotify, open a song, album, playlist, artist, show or episode, then choose Share → Copy link.</li>
        <li>Open your Snoozer Studio editor. Choose <strong>Add Spotify music or playlist</strong>, or add the shared URL in your profile links.</li>
        <li>Save and publish your profile. The Spotify link stays clickable, and visitors can choose <strong>Load Spotify player</strong> to load the official embed.</li>
      </ol>
      <p className="muted">The embed loads only after each visitor opts in. Spotify controls playback and may require sign-in or limit playback in some regions. Hiding the player removes the iframe.</p>
      <p><Link className="button primary" href="/studio">Open profile editor</Link></p>
    </section>
  </main>;
}
