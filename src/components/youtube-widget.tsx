"use client";

import { useState } from "react";

export function YouTubeWidget({ videoId, label }: { videoId: string; label: string }) {
  const [loaded, setLoaded] = useState(false);
  // Defence in depth if this component gains another caller.
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) return null;
  return <div className="youtube-widget">
    <p className="muted">Optional YouTube player. Loading connects to Google and shares your IP address and the Snoozer site origin. Your profile analytics choice is separate.</p>
    <button className="button small" type="button" aria-expanded={loaded} onClick={() => setLoaded(!loaded)}>
      {loaded ? "Hide YouTube player" : "Load YouTube player"}
    </button>
    {loaded && <>
      <iframe title={`YouTube: ${label}`} src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=0`}
        loading="lazy" referrerPolicy="strict-origin" allow="encrypted-media; picture-in-picture; fullscreen"
        sandbox="allow-scripts allow-same-origin allow-presentation" allowFullScreen />
      <p className="muted">If playback is unavailable or blocked by the video owner, use the original link above. Hiding removes the player and stops future requests from it.</p>
    </>}
  </div>;
}
