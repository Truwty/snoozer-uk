import { spotifyEmbedUrl, spotifyLink, type SpotifyResource } from "@/lib/spotify";

/**
 * A clean, always-visible official Spotify player. Spotify owns the iframe UI,
 * playback and availability; the surrounding chrome inherits the Snoozer theme.
 * No Web API, OAuth or client-side state is required.
 */
export function SpotifyWidget({
  resource, label, analyticsUsername, analyticsPosition, compact = false,
}: {
  resource: SpotifyResource;
  label: string;
  analyticsUsername?: string;
  analyticsPosition?: number;
  compact?: boolean;
}) {
  const source = spotifyEmbedUrl(resource);
  const link = spotifyLink(resource);
  if (!source || !link) return null;

  const kind = resource.kind === "show" ? "podcast" : resource.kind;
  const isCompact = resource.kind === "track" || resource.kind === "episode";

  return <section className={"spotify-widget" + (compact ? " spotify-widget--compact" : "")} aria-label={`Spotify ${kind} player`}>
    {!compact && <div className="spotify-widget__header">
      <span className="spotify-widget__brand">
        <svg className="spotify-widget__brand-icon" viewBox="0 0 24 24" role="img" aria-label="Spotify" focusable="false">
          <circle cx="12" cy="12" r="11" fill="currentColor" />
          <path d="M5.5 9.1c4.6-1.4 9.7-.8 13.2 1.3M6.4 12.7c3.8-1 8-.5 11 1.4M7.4 16c3-.7 6.4-.3 8.9 1.2"
            fill="none" stroke="#11251b" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <span>Spotify <span className="spotify-widget__kind">/ {kind}</span></span>
      </span>
      <a className="spotify-widget__open" href={link} target="_blank" rel="ugc nofollow noopener noreferrer"
        aria-label={`Open ${label} on Spotify`}
        data-analytics-profile={analyticsUsername} data-analytics-position={analyticsPosition}>
        Open
        <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor"
          strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
          <path d="M4 12 12 4M5 4h7v7" />
        </svg>
      </a>
    </div>}
    <div className="spotify-widget__player">
      <iframe
        className="spotify-widget__iframe"
        title={`Spotify: ${label}`}
        src={source}
        loading="lazy"
        width="100%"
        height={isCompact ? 152 : 352}
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        allowFullScreen
      />
    </div>
    {compact && <a className="spotify-widget__compact-open" href={link} target="_blank" rel="ugc nofollow noopener noreferrer">
      Open in Spotify <span aria-hidden="true">↗</span>
    </a>}
  </section>;
}
