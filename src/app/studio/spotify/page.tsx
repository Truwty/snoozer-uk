import Link from "next/link";
import { spotifyConfigured } from "@/lib/spotify-oauth";
import { requireAccount } from "@/lib/profiles-server";
import { disconnectSpotify, setSpotifyVisibility } from "./actions";

export const metadata = { title: "Spotify integration · Studio", robots: { index: false, follow: false } };
type Connection = { spotify_user_id: string; public_enabled: boolean; connected_at: string };
const notices: Record<string, string> = {
  connected: "Spotify linked. Now Playing is private by default until you opt in.",
  public: "Your current Spotify track is now visible on your published Snoozer profiles.",
  private: "Now Playing is private again. Public updates have stopped.",
  disconnected: "Spotify disconnected. Its stored tokens and cache were deleted.",
  denied: "Spotify authorisation was cancelled.",
  expired: "The Spotify link expired. Try connecting again.",
  invalid: "Spotify verification failed. Try connecting again.",
  consent: "Explicit consent is required before showing your listening activity.",
  error: "The change could not be saved. Try again.",
  unavailable: "Spotify OAuth is not configured on this deployment.",
};
export default async function Page({ searchParams }: { searchParams: Promise<{result?: string}> }) {
  const { client } = await requireAccount();
  const { data, error } = await client.rpc("spotify_my_connection");
  const connection: Connection | null = data && typeof data === "object" &&
    typeof data.spotify_user_id === "string" && typeof data.public_enabled === "boolean"
    ? data as Connection : null;
  const result = (await searchParams).result ?? "";
  const ready = spotifyConfigured();
  return <main className="shell">
    <nav className="nav studio-subnav"><Link className="button small" href="/studio">Back to Studio</Link></nav>
    <section className="panel stack">
      <p className="eyebrow">STUDIO / INTEGRATIONS</p>
      <h1>Spotify</h1>
      <p className="muted">Every profile can publish official Spotify links and consent-first players with no Spotify account connection. Live Now Playing is a separate, optional beta feature.</p>
      {notices[result] && <p role="status" className="message">{notices[result]}</p>}
      {error && <p role="alert">Spotify connection details are unavailable. Reload to try again.</p>}
      {!ready && <p className="message">Authenticated Spotify linking is not enabled by the site operator. Public embeds still work for everyone.</p>}
      {ready && <p className="muted">Spotify currently allows only five authorised users per Development Mode app. The Spotify app owner needs Spotify Premium, and your Spotify account must be included in the developer allowlist.</p>}
      {connection ? <>
        <p><strong>Connected Spotify account:</strong> {connection.spotify_user_id}</p>
        <p><strong>Public Now Playing:</strong> {connection.public_enabled ? "Enabled" : "Off (private)"}</p>
        {connection.public_enabled ?
          <form action={setSpotifyVisibility} className="stack">
            <input type="hidden" name="enabled" value="no" />
            <button className="button" type="submit">Make Now Playing private</button>
          </form> :
          <form action={setSpotifyVisibility} className="stack">
            <input type="hidden" name="enabled" value="yes" />
            <label><input type="checkbox" name="consent" required /> I agree to publicly show my currently playing Spotify tracks on all of my published Snoozer profiles.</label>
            <button className="button primary" type="submit">Enable public Now Playing</button>
          </form>}
        {ready && <p><Link className="button small" href="/spotify/connect">Reconnect Spotify</Link></p>}
        <form action={disconnectSpotify} className="stack">
          <button className="button" type="submit">Disconnect Spotify and delete credentials</button>
        </form>
      </> : ready ? <p><Link className="button primary" href="/spotify/connect">Connect an authorised Spotify account</Link></p> : null}
      <p className="muted">Snoozer never controls playback or publishes your listening history. Spotify tokens are encrypted server-side; private sessions and paused tracks do not reveal a song. You can hide or disconnect whenever you choose.</p>
      <p className="muted">Your Spotify account is separate from Snoozer sign-in. Disconnecting does not affect public music embeds you have saved as profile links.</p>
    </section>
  </main>;
}
