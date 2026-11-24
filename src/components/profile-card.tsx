"use client";

import { useEffect, useRef, useState, type CSSProperties, type DragEvent, type MouseEvent, type PointerEvent, type ReactNode, type RefObject } from "react";
import { countdownDate, countdownTarget } from "@/lib/countdown";
import { Countdown } from "./countdown";
import { linkAccentColours } from "@/lib/link-accent";
import { socialProviderForUrl, type SocialProviderId } from "@/lib/social-providers";
import { kofiProfileUrl } from "@/lib/kofi-link";
import { normalizeProfilePageLayout, type ProfilePageLayoutItem } from "@/lib/profile-layout";
import { profileBackgroundImage, safeLink, type PublishedProfile } from "@/lib/profile";
import { youtubeVideoId } from "@/lib/youtube";
import { YouTubeWidget } from "./youtube-widget";
import { spotifyResource } from "@/lib/spotify";
import { SpotifyWidget } from "./spotify-widget";
import { metadataWidget, twitchChannel, robloxPlace } from "@/lib/widgets";
import { PublicMetadataWidget } from "./public-metadata-widget";
import { TwitchWidget } from "./twitch-widget";
import { ProfileEffectsLayer } from "./profile-effects";
import { defaultEffects } from "@/lib/profile-effects";
import { DiscordPresenceWidget } from "./discord-presence-widget";
import type { DiscordPresencePublic } from "@/lib/discord-presence";
import { InteractiveProfileWidgets } from "./interactive-profile-widgets";
import { SocialProviderIcon } from "./social-provider-icon";

type SocialLink = { label: string; url: string; index: number; providerId: SocialProviderId };

const audioFilePattern = /\.(?:mp3|m4a|ogg|wav|aac|flac)$/i;

function directAudioSource(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && audioFilePattern.test(url.pathname) ? url.toString() : null;
  } catch {
    return null;
  }
}

function audioMetadata(label: string, fallbackArtist: string) {
  const match = label.trim().match(/^(.+?)\s+[—–-]\s+(.+)$/);
  return match
    ? { title: match[1].trim(), artist: match[2].trim() }
    : { title: label.trim() || "Untitled track", artist: fallbackArtist };
}

function TypewriterBio({ value }: { value: string }) {
  const [visible, setVisible] = useState(value);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let cursor = 0;
    const reset = window.setTimeout(() => setVisible(""), 0);
    const timer = window.setInterval(() => {
      cursor = Math.min(cursor + 1, value.length);
      setVisible(value.slice(0, cursor));
      if (cursor >= value.length) window.clearInterval(timer);
    }, 24);
    return () => {
      window.clearTimeout(reset);
      window.clearInterval(timer);
    };
  }, [value]);

  return <p className="profile-bio profile-bio--typewriter" aria-label={value}>
    <span aria-hidden="true">{visible}</span>
    <span className="profile-typewriter-caret" aria-hidden="true" />
  </p>;
}

function formatAudioTime(value: number) {
  if (!Number.isFinite(value) || value < 0) return "0:00";
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  return minutes + ":" + String(seconds).padStart(2, "0");
}

function ProfileAudioPlayer({ src, title, artist, cover, volume, audioRef }: {
  src: string;
  title: string;
  artist: string;
  cover?: string;
  volume: number;
  audioRef: RefObject<HTMLAudioElement | null>;
}) {
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  async function togglePlayback() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      try {
        await audio.play();
      } catch {
        setPlaying(false);
      }
    } else {
      audio.pause();
    }
  }

  return <section className="profile-audio-player" aria-label="Profile music player">
    <audio ref={audioRef} src={src} preload="metadata"
      onPlay={() => setPlaying(true)}
      onPause={() => setPlaying(false)}
      onTimeUpdate={(event) => setPosition(event.currentTarget.currentTime)}
      onLoadedMetadata={(event) => setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)}
      onDurationChange={(event) => setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)}
      onEnded={() => { setPlaying(false); setPosition(0); }} />
    {cover
      // The selected image is already a same-origin, resized profile asset.
      // eslint-disable-next-line @next/next/no-img-element
      ? <img className="profile-audio-cover" src={cover} alt="" width={48} height={48} />
      : <span className="profile-audio-cover profile-audio-cover--fallback" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
          </svg>
        </span>}
    <div className="profile-audio-details">
      <strong title={title}>{title}</strong>
      <span title={artist}>{artist}</span>
      <input className="profile-audio-progress" type="range" min={0} max={Math.max(duration, 1)}
        step={0.1} value={Math.min(position, duration || 0)} disabled={!duration}
        aria-label="Track progress"
        onChange={(event) => {
          if (audioRef.current) {
            audioRef.current.currentTime = Number(event.currentTarget.value);
            setPosition(audioRef.current.currentTime);
          }
        }} />
      <span className="profile-audio-time" aria-live="off">{formatAudioTime(position)} / {formatAudioTime(duration)}</span>
    </div>
    <button className="profile-audio-toggle" type="button" onClick={() => void togglePlayback()}
      aria-label={playing ? "Pause music" : "Play music"}>
      {playing
        ? <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M7 5h4v14H7zM15 5h4v14h-4z" /></svg>
        : <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l10-6.5z" /></svg>}
    </button>
  </section>;
}


function LayoutBlock({
  item, position, total, preview, onMove, onSelect, children,
}: {
  item: ProfilePageLayoutItem;
  position: number;
  total: number;
  preview: boolean;
  onMove?: (from: number, to: number) => void;
  onSelect?: (item: ProfilePageLayoutItem) => void;
  children: ReactNode;
}) {
  const label = item.type === "section" ? `Section ${item.index + 1}`
    : item.type === "block" ? "Content block"
    : item.type === "links" ? "Social links" : item.type === "widgets" ? "Interactive widgets" : "Gallery";
  const touchDrag = useRef<{ pointerId: number; from: number; x: number; y: number; active: boolean } | null>(null);

  function pointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (!preview || !onMove || event.pointerType === "mouse" || !event.isPrimary || touchDrag.current) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    touchDrag.current = { pointerId: event.pointerId, from: position, x: event.clientX, y: event.clientY, active: false };
  }

  function pointerMove(event: PointerEvent<HTMLButtonElement>) {
    const active = touchDrag.current;
    if (!active || active.pointerId !== event.pointerId) return;
    if (!active.active && Math.hypot(event.clientX - active.x, event.clientY - active.y) < 7) return;
    active.active = true;
    document.querySelectorAll<HTMLElement>(".profile-layout-block[data-drop-target]")
      .forEach((node) => delete node.dataset.dropTarget);
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>(".profile-layout-block");
    if (target) target.dataset.dropTarget = "true";
  }

  function pointerFinish(event: PointerEvent<HTMLButtonElement>, commit: boolean) {
    const active = touchDrag.current;
    if (!active || active.pointerId !== event.pointerId) return;
    touchDrag.current = null;
    document.querySelectorAll<HTMLElement>(".profile-layout-block[data-drop-target]")
      .forEach((node) => delete node.dataset.dropTarget);
    if (!commit || !active.active || !onMove) return;
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>(".profile-layout-block");
    const destination = Number(target?.dataset.layoutPosition);
    if (Number.isInteger(destination)) onMove(active.from, destination);
  }

  function onDragOver(event: DragEvent<HTMLDivElement>) {
    if (!preview || !onMove || !Array.from(event.dataTransfer.types).includes("application/x-snoozer-layout-item")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    event.currentTarget.dataset.dropTarget = "true";
  }

  function onDragLeave(event: DragEvent<HTMLDivElement>) {
    if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
    delete event.currentTarget.dataset.dropTarget;
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    const raw = event.dataTransfer.getData("application/x-snoozer-layout-item");
    if (!raw || !onMove) return;
    event.preventDefault();
    event.stopPropagation();
    delete event.currentTarget.dataset.dropTarget;
    const from = Number(raw);
    if (Number.isInteger(from)) onMove(from, position);
  }

  function onClick(event: MouseEvent<HTMLDivElement>) {
    if (!preview || !onSelect) return;
    if (event.target instanceof Element && event.target.closest("a,button,input,textarea,select,summary,label")) return;
    onSelect(item);
  }

  return <div className="profile-layout-block" data-layout-type={item.type} data-layout-position={position}
    data-section-index={item.type === "section" ? item.index : undefined}
    data-block-id={item.type === "block" ? item.id : undefined}
    onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop} onClick={onClick}>
    {preview && onMove && <div className="profile-layout-controls">
      <button type="button" className="profile-layout-drag-handle" draggable
        aria-label={`Drag ${label} to change its position`}
        onPointerDown={pointerDown} onPointerMove={pointerMove}
        onPointerUp={(event) => pointerFinish(event, true)}
        onPointerCancel={(event) => pointerFinish(event, false)}
        onLostPointerCapture={(event) => pointerFinish(event, false)}
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("application/x-snoozer-layout-item", String(position));
        }}
        onDragEnd={() => {
          document.querySelectorAll<HTMLElement>(".profile-layout-block[data-drop-target]")
            .forEach((node) => delete node.dataset.dropTarget);
        }}>
        <span aria-hidden="true">⠿</span>
      </button>
      <button type="button" className="profile-layout-move-button" disabled={position === 0}
        aria-label={`Move ${label} up`} onClick={() => onMove(position, position - 1)}>↑</button>
      <button type="button" className="profile-layout-move-button" disabled={position === total - 1}
        aria-label={`Move ${label} down`} onClick={() => onMove(position, position + 1)}>↓</button>
    </div>}
    {children}
  </div>;
}

export function ProfileCard({ profile, avatarSrc, galleryBase, preview = false, previewLabel = "Page preview", ownerBadge = false, discordPresence = null, discordPresenceRetry = false, reportBaseUrl, onMoveLayoutItem, onSelectLayoutItem, entryExperience = false }: {
  profile: PublishedProfile;
  avatarSrc?: string;
  galleryBase?: string;
  preview?: boolean;
  previewLabel?: string;
  ownerBadge?: boolean;
  discordPresence?: DiscordPresencePublic | null;
  discordPresenceRetry?: boolean;
  reportBaseUrl?: string;
  onMoveLayoutItem?: (from: number, to: number) => void;
  onSelectLayoutItem?: (item: ProfilePageLayoutItem) => void;
  entryExperience?: boolean;
}) {
  const [entered, setEntered] = useState(!entryExperience);
  const [entryOverlayVisible, setEntryOverlayVisible] = useState(entryExperience);
  const [musicVolume, setMusicVolume] = useState(0.72);
  const [musicMuted, setMusicMuted] = useState(false);
  const profileAudioRef = useRef<HTMLAudioElement>(null);
  const effects = profile.appearance.effects ?? defaultEffects;
  const layout = normalizeProfilePageLayout(profile.pageLayout, profile);
  const linkColours = linkAccentColours(profile.appearance.accent);
  const linkStyle = linkColours ? {
    "--link-background": linkColours.background,
    "--link-foreground": linkColours.foreground,
  } as CSSProperties : undefined;
  const background = profileBackgroundImage(profile);
  const backgroundImage = background && galleryBase
    ? `url("${galleryBase}/${encodeURIComponent(background.id)}")`
    : undefined;
  const backgroundStyle = backgroundImage
    ? { "--profile-background-image": backgroundImage }
    : {};
  const colors = profile.appearance.colors;
  const fontFamilies = {
    system: "system-ui, sans-serif",
    sans: "Arial, Helvetica, sans-serif",
    serif: "Georgia, serif",
    mono: "ui-monospace, SFMono-Regular, monospace",
  } as const;
  const appearanceStyle = {
    ...backgroundStyle,
    ...(colors?.background ? { "--page": colors.background } : {}),
    ...(colors?.text ? { "--text": colors.text } : {}),
    ...(colors?.accent ? { "--detail": colors.accent } : {}),
    ...(colors?.effect ? { "--wash": colors.effect } : {}),
    "--profile-icon-color": colors?.icon ?? "var(--text)",
    "--profile-opacity": (profile.appearance.opacity ?? 100) + "%",
    "--profile-blur": (profile.appearance.blur ?? 0) + "px",
    "--profile-font": fontFamilies[profile.appearance.font ?? "system"],
    "--profile-gradient-start": colors?.gradientStart ?? "#493c96",
    "--profile-gradient-end": colors?.gradientEnd ?? "#137f83",
  } as unknown as CSSProperties;
  const discordBadge = !preview && (discordPresence !== null || discordPresenceRetry)
    ? <DiscordPresenceWidget key={profile.username} username={profile.username} initialPresence={discordPresence} />
    : null;

  const identity = <>
    {avatarSrc
      // The server route serves an already resized raster.
      // eslint-disable-next-line @next/next/no-img-element
      ? <img className="avatar" alt="" width={88} height={88} src={avatarSrc} />
      : <div className="avatar avatar-fallback" aria-hidden="true">{Array.from(profile.display_name)[0]?.toUpperCase()}</div>}
    <p className="profile-handle">@{profile.username}</p>
    {preview ? <h2 className="profile-name-heading">{profile.display_name}{discordBadge}{ownerBadge && <span className="profile-owner-badge" title="Verified Snoozer platform owner"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m2 8 5 4 5-8 5 8 5-4-2 11H4L2 8Z"/><path d="M7 22h10"/></svg> Owner</span>}</h2> : <h1 className="profile-name-heading">{profile.display_name}{discordBadge}{ownerBadge && <span className="profile-owner-badge" title="Verified Snoozer platform owner"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m2 8 5 4 5-8 5 8 5-4-2 11H4L2 8Z"/><path d="M7 22h10"/></svg> Owner</span>}</h1>}
    {profile.bio && (entryExperience ? <TypewriterBio value={profile.bio} /> : <p className="profile-bio">{profile.bio}</p>)}
  </>;

  function renderSection(index: number) {
    const section = profile.sections[index];
    if (!section || section.hidden || !section.heading.trim()) return null;
    const target = section.kind === "countdown" ? countdownTarget(section.target ?? "") : null;
    if (section.kind === "quote") return <figure className="profile-text-section profile-quote">
      <blockquote><p>{section.body}</p></blockquote>
      <figcaption>{section.heading}</figcaption>
    </figure>;
    return <section className={"profile-text-section" + (section.kind === "callout" ? " profile-callout" : section.kind === "project" ? " profile-project" : "")}>
      {preview ? <h3>{section.heading}</h3> : <h2>{section.heading}</h2>}
      <p>{section.body}</p>
      {section.kind === "project" && section.target && safeLink(section.target) && <a className="project-link" href={section.target} rel="ugc nofollow noreferrer">Explore {section.heading} <span aria-hidden="true">↗</span></a>}
      {section.kind === "countdown" && <div className="countdown">
        {target ? <><p><time dateTime={target.toISOString()}>{countdownDate(target)}</time></p><Countdown key={section.target} target={target.valueOf()} /></> : <p>Choose a target time to preview the countdown.</p>}
      </div>}
    </section>;
  }

  function renderLinkList(links: { label: string; url: string; index: number }[]) {
    if (links.length === 0) return null;
    return <ul className="profile-links" style={linkStyle}>
      {links.map(({ label, url, index }) => {
        const video = youtubeVideoId(url);
        const metadata = metadataWidget(url);
        const channel = twitchChannel(url);
        const place = robloxPlace(url);
        const spotify = spotifyResource(url);
        return <li key={url + "-" + index} className={spotify ? "spotify-link-slot" : undefined}>
          {spotify
            ? <SpotifyWidget key={spotify.kind + spotify.id} resource={spotify} label={label}
                analyticsUsername={preview ? undefined : profile.username}
                analyticsPosition={preview ? undefined : index + 1} />
            : <a href={url} rel="ugc nofollow noreferrer"
                data-analytics-profile={preview ? undefined : profile.username}
                data-analytics-position={preview ? undefined : index + 1}>{label}{kofiProfileUrl(url) && " · Ko-fi"}{place && " · Roblox"} <span aria-hidden="true">↗</span></a>}
          {video && <YouTubeWidget key={video} videoId={video} label={label} />}
          {metadata && (preview ? <p className="widget-preview-note">Public {metadata.provider === "github" ? "GitHub" : "Discord"} summaries are available after publishing this link.</p>
            : <PublicMetadataWidget key={metadata.provider + metadata.resource} {...metadata} username={profile.username} position={index + 1} />)}
          {channel && <TwitchWidget key={channel} channel={channel} label={label} />}
        </li>;
      })}
    </ul>;
  }

  function renderLinks() {
    const valid = profile.links.map((item, index) => ({ ...item, index }))
      .filter(({ url, hidden }) => safeLink(url) && !hidden);
    if (valid.length === 0) return null;

    const hasProviderEmbed = (url: string) => Boolean(
      spotifyResource(url) || youtubeVideoId(url) || metadataWidget(url) || twitchChannel(url) || robloxPlace(url)
    );

    if (entryExperience) {
      const social: SocialLink[] = valid.flatMap(({ label, url, index }) => {
        const provider = socialProviderForUrl(url);
        return provider && provider.id !== "spotify"
          ? [{ label, url, index, providerId: provider.id }]
          : [];
      });
      const audioLink = valid.find(({ url }) => directAudioSource(url));
      const spotifyTrack = audioLink ? null : valid.find(({ url }) => spotifyResource(url)?.kind === "track");
      const audioSource = audioLink ? directAudioSource(audioLink.url) : null;
      const audioInfo = audioLink ? audioMetadata(audioLink.label, profile.display_name) : null;
      const spotifyTrackResource = spotifyTrack ? spotifyResource(spotifyTrack.url) : null;
      const cover = profile.gallery[0] && galleryBase
        ? galleryBase + "/" + profile.gallery[0].id
        : avatarSrc;

      return <>
        {social.length > 0 && <nav className="profile-social-links" aria-label="Social profiles">
          {social.map(({ label, url, index, providerId }) => <a key={url + index} className="profile-social-link" href={url}
            rel="ugc nofollow noreferrer" title={label} aria-label={label}
            data-analytics-profile={preview ? undefined : profile.username}
            data-analytics-position={preview ? undefined : index + 1}>
            <span aria-hidden="true" className="profile-social-mark"><SocialProviderIcon providerId={providerId} /></span>
          </a>)}
        </nav>}
        {audioLink && audioSource && audioInfo
          ? <ProfileAudioPlayer src={audioSource} title={audioInfo.title} artist={audioInfo.artist}
              cover={cover} volume={musicMuted ? 0 : musicVolume} audioRef={profileAudioRef} />
          : spotifyTrack && spotifyTrackResource
            ? <SpotifyWidget key={spotifyTrackResource.kind + spotifyTrackResource.id}
                resource={spotifyTrackResource} label={spotifyTrack.label} compact
                analyticsUsername={profile.username} analyticsPosition={spotifyTrack.index + 1} />
            : null}
      </>;
    }

    const social: SocialLink[] = valid.flatMap(({ label, url, index }) => {
      const provider = socialProviderForUrl(url);
      return provider && !hasProviderEmbed(url) ? [{ label, url, index, providerId: provider.id }] : [];
    });
    const regular = valid.filter(({ url }) => !socialProviderForUrl(url) || hasProviderEmbed(url));
    return <>
      {social.length > 0 && <nav className="profile-social-links" aria-label="Social profiles">
        {social.map(({ label, url, index, providerId }) => <a key={url + index} className="profile-social-link" href={url}
          rel="ugc nofollow noreferrer" title={label} aria-label={label}
          data-analytics-profile={preview ? undefined : profile.username}
          data-analytics-position={preview ? undefined : index + 1}>
          <span aria-hidden="true" className="profile-social-mark"><SocialProviderIcon providerId={providerId} /></span>
        </a>)}
      </nav>}
      {renderLinkList(regular)}
    </>;
  }

  function renderMoreContent() {
    const valid = profile.links.map((item, index) => ({ ...item, index }))
      .filter(({ url, hidden }) => safeLink(url) && !hidden);
    const hasProviderEmbed = (url: string) => Boolean(
      spotifyResource(url) || youtubeVideoId(url) || metadataWidget(url) || twitchChannel(url) || robloxPlace(url)
    );
    const social = valid.filter(({ url }) => {
      const provider = socialProviderForUrl(url);
      return provider && !hasProviderEmbed(url) && provider.id !== "spotify";
    });
    const audioLink = valid.find(({ url }) => directAudioSource(url));
    const spotifyTrack = audioLink ? null : valid.find(({ url }) => spotifyResource(url)?.kind === "track");
    const extras = valid.filter((link) =>
      !social.some((item) => item.index === link.index)
      && (!audioLink || link.index !== audioLink.index)
      && (!spotifyTrack || link.index !== spotifyTrack.index)
    );
    const additionalLinks = renderLinkList(extras);
    const additionalItems = layout.items.map((item, index) => item.type === "links"
      ? null
      : renderItem(item, index)).filter(Boolean);

    if (!additionalLinks && additionalItems.length === 0) return null;

    return <details className="profile-more-content">
      <summary>More</summary>
      {additionalLinks}
      {additionalItems}
    </details>;
  }

  function renderBlock(id: string) {
    const block = profile.blocks.find((item) => item.id === id && !item.hidden);
    if (!block) return null;
    const className = "profile-content-block profile-block-" + block.type;
    const common = { className, "data-width": block.width, "data-align": block.align, "data-variant": block.variant };

    if (block.type === "heading") return <section {...common}>
      {block.level === "h3" ? <h3>{block.text}</h3> : <h2>{block.text}</h2>}
    </section>;
    if (block.type === "about") return <section {...common}>
      {preview ? <h3>{block.heading}</h3> : <h2>{block.heading}</h2>}
      <p>{block.body}</p>
    </section>;
    if (block.type === "callout") return <section {...common} data-tone={block.tone}>
      {preview ? <h3>{block.heading}</h3> : <h2>{block.heading}</h2>}
      <p>{block.body}</p>
    </section>;
    if (block.type === "quote") return <figure {...common}>
      <blockquote><p>{block.quote}</p></blockquote>
      {block.attribution && <figcaption>{block.attribution}</figcaption>}
    </figure>;
    if (block.type === "project") return <article {...common}>
      <h3>{block.title}</h3><p>{block.description}</p>
      {safeLink(block.url) && <a className="profile-block-action" href={block.url} rel="ugc nofollow noreferrer">{block.buttonLabel} <span aria-hidden="true">↗</span></a>}
    </article>;
    if (block.type === "skills") return <section {...common}>
      {preview ? <h3>{block.heading}</h3> : <h2>{block.heading}</h2>}
      <ul className="profile-skill-list">{block.items.map((skill, index) => <li key={index}>{skill}</li>)}</ul>
    </section>;
    if (block.type === "cta") return <section {...common}>
      <h3>{block.heading}</h3><p>{block.body}</p>
      {safeLink(block.url) && <a className="profile-block-action" href={block.url} rel="ugc nofollow noreferrer">{block.label} <span aria-hidden="true">↗</span></a>}
    </section>;
    if (block.type === "divider") return <div {...common} aria-hidden="true"><hr data-divider-style={block.style}/></div>;
    if (block.type === "countdown") {
      const target = countdownTarget(block.target);
      return <section {...common}>
        <h3>{block.heading}</h3>
        {target && <><p><time dateTime={target.toISOString()}>{countdownDate(target)}</time></p><Countdown key={block.target} target={target.valueOf()}/></>}
      </section>;
    }
    return <section {...common}>
      {preview ? <h3>{block.heading}</h3> : <h2>{block.heading}</h2>}
      <dl className="profile-stats-grid">{block.items.map((item, index) => <div key={index}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl>
    </section>;
  }

  function renderWidgets() {
    return <InteractiveProfileWidgets widgets={profile.widgets} username={profile.username} preview={preview} reportBaseUrl={reportBaseUrl} hideGuestbook={entryExperience} />;
  }

  function renderGallery() {
    if (!galleryBase || profile.gallery.length === 0) return null;
    const visible = profile.gallery.filter((item) => item.id !== (backgroundImage ? background?.id : undefined));
    if (visible.length === 0) return null;
    return <section className="profile-gallery">
      {preview ? <h3>Gallery</h3> : <h2>Gallery</h2>}
      <ul className="profile-gallery-grid">
        {visible.map((item) => <li key={item.id}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="gallery-image" src={galleryBase + "/" + item.id} alt={item.alt}
            width={item.width} height={item.height} loading="lazy" />
        </li>)}
      </ul>
    </section>;
  }

  function renderItem(item: ProfilePageLayoutItem, position: number) {
    let child: ReactNode;
    if (item.type === "section") child = renderSection(item.index);
    else if (item.type === "block") child = renderBlock(item.id);
    else if (item.type === "links") child = renderLinks();
    else if (item.type === "widgets") child = renderWidgets();
    else child = renderGallery();
    if (!child) return null;
    return <LayoutBlock key={item.type === "section" ? "section-" + item.index : item.type === "block" ? "block-" + item.id : item.type}
      item={item} position={position} total={layout.items.length} preview={preview} onMove={onMoveLayoutItem}
      onSelect={onSelectLayoutItem}>{child}</LayoutBlock>;
  }

  const hasNativeAudio = entryExperience && profile.links.some((item) => !item.hidden && safeLink(item.url) && Boolean(directAudioSource(item.url)));

  function enterProfile() {
    setEntered(true);
    const audio = profileAudioRef.current;
    if (audio) void audio.play().catch(() => undefined);
    window.setTimeout(() => setEntryOverlayVisible(false), 380);
  }

  return <>
    {entryExperience && entryOverlayVisible && <button type="button"
      className={"profile-entry-overlay" + (entered ? " is-entered" : "")}
      onClick={enterProfile} aria-label={"Click to enter " + profile.display_name + " profile"}>
      <span>click to enter...</span>
      <small>@{profile.username}</small>
    </button>}
    <section className={`profile-card theme-${profile.theme}${entryExperience ? " profile-card--bio-experience" : ""}`} aria-label={preview ? previewLabel : undefined} aria-hidden={entryExperience && !entered ? true : undefined} inert={entryExperience && !entered}
    data-entrance={profile.appearance.entrance} data-layout={profile.appearance.layout} data-density={profile.appearance.density} data-corners={profile.appearance.corners}
    data-background-image={backgroundImage ? "true" : undefined}
    data-gradient-enabled={profile.appearance.gradientEnabled ? "true" : undefined}
    data-monochrome-icons={profile.appearance.monochromeIcons ? "true" : undefined}
    data-animated-title={profile.appearance.animatedTitle ? "true" : undefined}
    data-username-glow={profile.appearance.usernameGlow ? "true" : undefined}
    data-social-glow={profile.appearance.socialGlow ? "true" : undefined}
    data-badge-glow={profile.appearance.badgeGlow ? "true" : undefined}
    style={appearanceStyle}
    data-effect-border={effects.enabled ? effects.border : "none"}
    data-effect-links={effects.enabled ? effects.links : "none"}
    data-effect-text={effects.enabled ? effects.text : "none"}
    data-effect-interaction={effects.enabled ? effects.interaction : "none"}
    data-effect-speed={effects.speed}>
    <ProfileEffectsLayer effects={effects} />
    {effects.enabled && !entryExperience && <label className="profile-effects-toggle">
      <input type="checkbox" aria-label="Disable profile effects" />
      <span className="effects-disable-text">Disable effects</span>
      <span className="effects-enable-text">Enable effects</span>
    </label>}
    <div className="profile-decoration" aria-hidden="true" />
    <div className="profile-inner">
      <header className="profile-identity">{identity}</header>
      <div className="profile-layout profile-sections" role="group" aria-label="Profile content">
        {entryExperience ? <>{renderLinks()}{renderMoreContent()}</> : layout.items.map((item, index) => renderItem(item, index))}
      </div>
    </div>
    </section>
    {entryExperience && entered && hasNativeAudio && <div className="profile-volume-control" aria-label="Music volume control">
      <button type="button" className="profile-volume-mute" aria-label={musicMuted ? "Unmute music" : "Mute music"}
        onClick={() => setMusicMuted((value) => !value)}>
        {musicMuted || musicVolume === 0
          ? <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4zM16 9l5 6M21 9l-5 6" /></svg>
          : <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4zM15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" /></svg>}
      </button>
      <input type="range" min="0" max="1" step="0.01" value={musicMuted ? 0 : musicVolume}
        aria-label="Profile music volume"
        onChange={(event) => { setMusicVolume(Number(event.currentTarget.value)); setMusicMuted(false); }} />
    </div>}
  </>;
}
