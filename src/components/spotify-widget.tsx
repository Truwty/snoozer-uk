"use client";

import { useState } from "react";
import { Disclosure } from "./ui";
import { spotifyEmbedUrl, spotifyLink, type SpotifyResource } from "@/lib/spotify";

/**
 * Load Spotify only on a visitor's explicit, local action. No API token,
 * third-party iframe or Spotify script is present before that choice.
 */
export function SpotifyWidget({ resource, label }: { resource: SpotifyResource; label: string }) {
  const [loaded, setLoaded] = useState(false);
  const source = spotifyEmbedUrl(resource);
  const link = spotifyLink(resource);
  if (!source || !link) return null;
  const kindLabel = resource.kind === "show" ? "podcast" : resource.kind;
  const short = resource.kind === "track" || resource.kind === "episode";

  return <div className="spotify-widget">
    <p className="muted">Optional Spotify {kindLabel} player · loads only when you choose.</p>
    <Disclosure title="Learn more about Spotify privacy">
      <p className="muted">
        Loading the official Spotify player connects your browser directly to Spotify and
        shares connection data such as your IP address and this site's origin.
        This choice is separate from Snoozer profile analytics and is not remembered.
      </p>
    </Disclosure>
    <button type="button" className="button small" aria-expanded={loaded}
      onClick={() => setLoaded((previous) => !previous)}>
      {loaded ? "Hide Spotify player" : "Load Spotify player"}
    </button>
    {loaded && <>
      <iframe
        title={`Spotify: ${label}`}
        src={source}
        loading="lazy"
        width="100%"
        height={short ? 152 : 352}
        style={{ display: "block", width: "100%", maxWidth: "100%", border: 0, borderRadius: 12 }}
        referrerPolicy="strict-origin"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"
        allowFullScreen
      />
      <p className="muted">
        Spotify controls playback, content availability and any sign-in requirements.
        <a href={link} rel="ugc nofollow noreferrer" target="_blank"> Open in Spotify</a> if the embed is unavailable.
        Hiding the player removes it and stops future iframe requests.
      </p>
    </>}
  </div>;
}
