"use client";

import { useEffect, useRef, useState } from "react";

export function TwitchWidget({ channel, label }: { channel: string; label: string }) {
  const container = useRef<HTMLDivElement>(null);
  const [wide, setWide] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const element = container.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => setWide(entries[0].contentRect.width >= 400));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  if (!/^[a-z0-9_]{3,25}$/.test(channel)) return null;
  const src = loaded && typeof window !== "undefined"
    ? `https://player.twitch.tv/?channel=${channel}&parent=${encodeURIComponent(window.location.hostname)}&autoplay=false&muted=true` : "";
  return <div className="twitch-widget" ref={container}>
    <p className="muted">Optional Twitch player. Loading connects to Twitch and shares your IP address and the Snoozer site origin. This choice is separate from profile analytics.</p>
    {!wide && <p className="muted">Twitch requires a player at least 400 px wide. Use the original link above on smaller screens.</p>}
    {(wide || loaded) && <button className="button small" type="button" aria-expanded={loaded && wide} onClick={() => setLoaded(!loaded)}>
      {loaded ? "Hide Twitch player" : "Load Twitch player"}
    </button>}
    {loaded && wide && <>
      <iframe title={`Twitch: ${label}`} src={src} allowFullScreen referrerPolicy="strict-origin"
        allow="encrypted-media; fullscreen" sandbox="allow-scripts allow-same-origin allow-presentation" />
      <p className="muted">Playback and online/offline information come from Twitch. If unavailable, use the original link above. Hiding removes the player.</p>
    </>}
  </div>;
}
