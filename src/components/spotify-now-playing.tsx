"use client";
import { useCallback, useEffect, useState } from "react";
import type { PublicPlayingStatus } from "@/lib/spotify-now-playing";

export function SpotifyNowPlaying({ username }: { username: string }) {
  const [opened, setOpened] = useState(false);
  const [status, setStatus] = useState<PublicPlayingStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/v1/spotify/now-playing?username=" + encodeURIComponent(username), {
        cache: "no-store", credentials: "omit",
      });
      if (!response.ok) { setStatus(null); return; }
      const body: unknown = await response.json();
      if (!body || typeof body !== "object" || !("state" in body)) { setStatus(null); return; }
      const value = body as PublicPlayingStatus;
      setStatus(value.state === "idle" || value.state === "playing" ? value : null);
    } catch { setStatus(null); } finally { setLoading(false); }
  }, [username]);
  useEffect(() => {
    if (!opened) return;
    void refresh();
    const id = setInterval(() => void refresh(), 60_000);
    return () => clearInterval(id);
  }, [opened, refresh]);
  return <section className="spotify-now-playing" aria-label="Live Spotify listening">
    <div className="actions"><strong>Now Playing · Spotify</strong>
      <button type="button" className="button small" aria-expanded={opened} onClick={() => {
        setOpened((value) => !value); setStatus(null);
      }}>{opened ? "Hide live status" : "Show live status"}</button></div>
    {opened && <div aria-live="polite" className="stack">
      {loading && !status && <p className="muted">Checking Spotify…</p>}
      {status?.state === "playing" && <p><strong>{status.track.title}</strong> · {status.track.artist}
        {" "}<a href={status.track.url} rel="ugc nofollow noreferrer" target="_blank">Open track ↗</a></p>}
      {status?.state === "idle" && <p className="muted">No public track is playing right now.</p>}
      {!loading && !status && <p className="muted">Live status is temporarily unavailable. Spotify may need authorisation again.</p>}
      <small className="muted">Updated about once a minute. Your browser contacts Snoozer, not Spotify, for this status.</small>
    </div>}
  </section>;
}
