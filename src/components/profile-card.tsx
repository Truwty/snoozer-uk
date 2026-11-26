"use client";

import { useEffect, useRef, useState, type CSSProperties, type DragEvent, type MouseEvent, type PointerEvent, type ReactNode, type RefObject, type SyntheticEvent } from "react";
import { countdownDate, countdownTarget } from "@/lib/countdown";
import { Countdown } from "./countdown";
import { linkAccentColours } from "@/lib/link-accent";
import { socialProviderForUrl, type SocialProviderId } from "@/lib/social-providers";
import { normalizeProfilePageLayout, type ProfilePageLayoutItem } from "@/lib/profile-layout";
import { profileBackgroundImage, safeLink, type PublishedProfile } from "@/lib/profile";



import { ProfileEffectsLayer } from "./profile-effects";
import { defaultEffects } from "@/lib/profile-effects";
import { DiscordPresenceWidget } from "./discord-presence-widget";
import type { DiscordPresencePublic } from "@/lib/discord-presence";

import { SocialProviderIcon } from "./social-provider-icon";
import { BadgeArtwork } from "./badge-artwork";
import { InteractiveProfileWidgets } from "./interactive-profile-widgets";



type SocialLink = { label: string; url: string; index: number; providerId: SocialProviderId; providerLabel: string; iconImage?: string };

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

function TypewriterBio({ value, active }: { value: string; active: boolean }) {
  const [visible, setVisible] = useState("");
  useEffect(() => {
    if (!active) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const complete = window.setTimeout(() => setVisible(value), 0);
      return () => window.clearTimeout(complete);
    }
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
  }, [value, active]);

  return <p className="profile-bio profile-bio--typewriter" aria-live="off">
    <span>{visible}</span>
    <span className="profile-typewriter-caret" aria-hidden="true" />
  </p>;
}

function shuffled(value: string) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(value, (character) => character === " " ? " " : alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

function ProfileNameText({ value, effect }: { value: string; effect: string }) {
  const [frameText, setFrameText] = useState({ value, text: value });
  useEffect(() => {
    if (effect !== "shuffle" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frames: number | undefined;
    let frame = 0;
    const cycle = window.setInterval(() => {
      frame = 0;
      if (frames !== undefined) window.clearInterval(frames);
      frames = window.setInterval(() => {
        frame += 1;
        setFrameText({ value, text: frame < 5 ? shuffled(value) : value });
        if (frame >= 5 && frames !== undefined) window.clearInterval(frames);
      }, 70);
    }, 6000);
    return () => {
      window.clearInterval(cycle);
      if (frames !== undefined) window.clearInterval(frames);
    };
  }, [effect, value]);

  const visible = effect === "shuffle" && frameText.value === value ? frameText.text : value;
  return <><span className={"profile-name-copy" + (effect === "none" ? "" : " profile-name-copy--" + effect)}
    style={{ "--profile-name-steps": String(Array.from(value).length) } as CSSProperties} aria-hidden="true">{visible}</span>
    <span className="sr-only">{value}</span></>;
}

function formatAudioTime(value: number) {
  if (!Number.isFinite(value) || value < 0) return "0:00";
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  return minutes + ":" + String(seconds).padStart(2, "0");
}

type ProfileAudioTrack = { src: string; title: string; artist: string };

function ProfileAudioPlayer({ tracks, cover, volume, audioRef }: {
  tracks: ProfileAudioTrack[];
  cover?: string;
  volume: number;
  audioRef: RefObject<HTMLAudioElement | null>;
}) {
  const [trackIndex, setTrackIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [shuffle, setShuffle] = useState(false);
  const resumeAfterChange = useRef(false);
  const track = tracks[trackIndex] ?? tracks[0];

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [audioRef, volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    audio.load();
    setPosition(0);
    setDuration(0);
    if (resumeAfterChange.current) {
      resumeAfterChange.current = false;
      void audio.play().catch(() => setPlaying(false));
    }
  }, [audioRef, trackIndex]);

  function changeTrack(next: number, resume = playing) {
    if (tracks.length < 2) return;
    resumeAfterChange.current = resume;
    setTrackIndex((next + tracks.length) % tracks.length);
  }

  function nextTrack(resume = true) {
    if (tracks.length < 2) return;
    const next = shuffle
      ? (() => {
          const choices = tracks.map((_, index) => index).filter((index) => index !== trackIndex);
          return choices[Math.floor(Math.random() * choices.length)] ?? trackIndex;
        })()
      : trackIndex + 1;
    changeTrack(next, resume);
  }

  function previousTrack() {
    const audio = audioRef.current;
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      setPosition(0);
      return;
    }
    changeTrack(trackIndex - 1, playing);
  }

  async function togglePlayback() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      try { await audio.play(); } catch { setPlaying(false); }
    } else audio.pause();
  }

  return <section className="profile-audio-player" aria-label="Profile music player">
    <audio ref={audioRef} src={track.src} preload="metadata"
      onPlay={() => setPlaying(true)}
      onPause={() => setPlaying(false)}
      onTimeUpdate={(event) => setPosition(event.currentTarget.currentTime)}
      onLoadedMetadata={(event) => setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)}
      onDurationChange={(event) => setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)}
      onEnded={() => {
        if (tracks.length > 1) nextTrack(true);
        else { setPlaying(false); setPosition(0); }
      }} />
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
      <strong title={track.title}>{track.title}</strong>
      <span title={track.artist}>{track.artist}</span>
      <input className="profile-audio-progress" type="range" min={0} max={Math.max(duration, 1)}
        step={0.1} value={Math.min(position, duration || 0)} disabled={!duration}
        aria-label="Track progress"
        onChange={(event) => {
          if (audioRef.current) {
            audioRef.current.currentTime = Number(event.currentTarget.value);
            setPosition(audioRef.current.currentTime);
          }
        }} />
      <span className="profile-audio-time" aria-live="off">{formatAudioTime(position)} / {formatAudioTime(duration)} · {trackIndex + 1}/{tracks.length}</span>
    </div>
    <div className="profile-audio-transport">
      <button className="profile-audio-step" type="button" onClick={previousTrack} disabled={tracks.length < 2}
        aria-label="Previous track" title="Previous track">|◀</button>
      <button className="profile-audio-toggle" type="button" onClick={() => void togglePlayback()}
        aria-label={playing ? "Pause music" : "Play music"}>
        {playing
          ? <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M7 5h4v14H7zM15 5h4v14h-4z" /></svg>
          : <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l10-6.5z" /></svg>}
      </button>
      <button className="profile-audio-step" type="button" onClick={() => nextTrack()} disabled={tracks.length < 2}
        aria-label="Next track" title="Next track">▶|</button>
      <button className={"profile-audio-step profile-audio-shuffle" + (shuffle ? " is-active" : "")}
        type="button" onClick={() => setShuffle((value) => !value)} disabled={tracks.length < 2}
        aria-label={shuffle ? "Disable shuffle" : "Enable shuffle"} title="Shuffle">{shuffle ? "SHUF" : "SHUF"}</button>
    </div>
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
  const entryDetailsRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    // A native <details> disclosure can open before React hydrates. Sync the
    // typewriter state after hydration so an early click is never discarded.
    if (entryExperience && entryDetailsRef.current?.open) setEntered(true);
  }, [entryExperience]);
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
  const cursorImage = profile.appearance.customCursorImage
    ? profile.gallery.find((image) => image.id === profile.appearance.customCursorImage)
    : undefined;
  const customCursor = cursorImage && galleryBase
    ? `url("${galleryBase}/${encodeURIComponent(cursorImage.id)}") 16 16, auto`
    : undefined;
  const colors = profile.appearance.colors;
  const fontFamilies = {
    system: "system-ui, sans-serif",
    sans: "Arial, Helvetica, sans-serif",
    serif: "Georgia, serif",
    mono: "ui-monospace, SFMono-Regular, monospace",
  } as const;
  const appearanceStyle = {
    ...backgroundStyle,
    "--profile-custom-cursor": customCursor ?? "auto",
    ...(colors?.background ? { "--profile-base-page": colors.background } : {}),
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
  const nameTextEffect = effects.enabled ? effects.text : "none";
  const nameContent = <><ProfileNameText value={profile.display_name} effect={nameTextEffect}/>{discordBadge}{ownerBadge && <span className="profile-owner-badge" title="Verified Snoozer platform owner"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m2 8 5 4 5-8 5 8 5-4-2 11H4L2 8Z"/><path d="M7 22h10"/></svg> Owner</span>}</>;

  const identity = <>
    {avatarSrc
      // The server route serves an already resized raster.
      // eslint-disable-next-line @next/next/no-img-element
      ? <img className="avatar" alt="" width={88} height={88} src={avatarSrc} />
      : <div className="avatar avatar-fallback" aria-hidden="true">{Array.from(profile.display_name)[0]?.toUpperCase()}</div>}
    {!entryExperience && <p className="profile-handle">@{profile.username}</p>}
    {preview ? <h2 className="profile-name-heading">{nameContent}</h2> : <h1 className="profile-name-heading">{nameContent}</h1>}
    {entryExperience && <p className="profile-handle">@{profile.username}</p>}
    {!preview && profile.badges.length>0 && <nav className="profile-official-badges" aria-label="Official Snoozer badges">
      {profile.badges.slice(0,8).map((badge)=><span className={"profile-official-badge rarity-"+badge.rarity} key={badge.slug} role="img" title={badge.name+": "+badge.description} aria-label={badge.name}>
        <span aria-hidden="true">{badge.category === "custom" ? badge.image_id
          // eslint-disable-next-line @next/next/no-img-element
          ? <img className="profile-custom-badge-art" src={`/media/badges/${badge.image_id}`} alt="" width={24} height={24}/>
          : <span className="profile-custom-badge-icon" style={{ color: badge.color }}>{badge.icon}</span>
          : <BadgeArtwork slug={badge.slug} size={24}/>}</span>
      </span>)}
      {profile.badges.length>8 && <span className="profile-official-badge-more" role="img" aria-label={profile.badges.length-8+" more badges"}>+{profile.badges.length-8}</span>}
    </nav>}
    {profile.appearance.showLocation && profile.appearance.location && <p className="profile-location"><span aria-hidden="true">⌖</span>{profile.appearance.location}</p>}
    {profile.bio && (entryExperience ? <TypewriterBio value={profile.bio} active={entered} /> : <p className="profile-bio">{profile.bio}</p>)}
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

  function renderLinks() {
    const valid = profile.links.map((item, index) => ({ ...item, index }))
      .filter(({ url, hidden }) => safeLink(url) && !hidden);

    const social: SocialLink[] = valid.flatMap((item) => {
      if (item.mode === "text") return [];
      const provider = socialProviderForUrl(item.url);
      const customIcon = item.iconImage && profile.gallery.some((image) => image.id === item.iconImage);
      if (!provider && !customIcon) return [];
      return [{
        label: item.label,
        url: item.url,
        index: item.index,
        providerId: provider?.id ?? "website",
        providerLabel: provider?.label ?? "Website",
        ...(customIcon ? { iconImage: item.iconImage } : {}),
      }];
    });
    const iconIndexes = new Set(social.map((item) => item.index));
    const textLinks = valid.filter((item) => item.mode === "text" || !iconIndexes.has(item.index));
    const audioTracks = entryExperience ? valid.flatMap(({ label, url }) => {
      const src = directAudioSource(url);
      if (!src) return [];
      const info = audioMetadata(label, profile.display_name);
      return [{ src, title: info.title, artist: info.artist }];
    }) : [];
    const cover = profile.gallery[0] && galleryBase
      ? galleryBase + "/" + profile.gallery[0].id
      : avatarSrc;

    return <>
      {social.length > 0 && <nav className="profile-social-links" aria-label="Social profiles">
        {social.map(({ label, url, index, providerId, providerLabel, iconImage }) => {
          const image = iconImage ? profile.gallery.find((item) => item.id === iconImage) : undefined;
          const imageSrc = image && galleryBase ? galleryBase + "/" + encodeURIComponent(image.id) : undefined;
          return <a key={url + index} className="profile-social-link" href={url}
            rel="ugc nofollow noreferrer" title={`${label} · ${providerLabel}`} aria-label={`${label} · ${providerLabel}`}
            data-analytics-profile={preview ? undefined : profile.username}
            data-analytics-position={preview ? undefined : index + 1}>
            {imageSrc
              // Gallery images are already processed and served through the public profile media route.
              // eslint-disable-next-line @next/next/no-img-element
              ? <img className="profile-social-custom-icon" src={imageSrc} alt="" width={26} height={26} loading="lazy"/>
              : <span aria-hidden="true" className="profile-social-mark"><SocialProviderIcon providerId={providerId} /></span>}
          </a>;
        })}
      </nav>}
      {textLinks.length > 0 && <ul className="profile-links profile-text-links" style={linkStyle}>
        {textLinks.map(({ label, url, index }) => <li key={url + "-" + index}>
          <a href={url} rel="ugc nofollow noreferrer"
            data-analytics-profile={preview ? undefined : profile.username}
            data-analytics-position={preview ? undefined : index + 1}>{label} <span aria-hidden="true">↗</span></a>
        </li>)}
      </ul>}
      {audioTracks.length > 0 && <ProfileAudioPlayer tracks={audioTracks} cover={cover}
        volume={musicMuted ? 0 : musicVolume} audioRef={profileAudioRef} />}
    </>;
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
    // Reveal the profile immediately in the same click that opens the native
    // disclosure. The hydration effect below covers clicks before React loads.
    setEntered(true);
    const audio = profileAudioRef.current;
    if (audio) void audio.play().catch(() => undefined);
  }

  function handleEntryToggle(event: SyntheticEvent<HTMLDetailsElement>) {
    if (event.currentTarget.open) setEntered(true);
  }

  const profileCard = <section className={`profile-card theme-${profile.theme}${entryExperience ? " profile-card--bio-experience" : ""}`} aria-label={preview ? previewLabel : undefined}
    data-entrance={profile.appearance.entrance} data-layout={profile.appearance.layout} data-density={profile.appearance.density} data-corners={profile.appearance.corners}
    data-template-style={profile.appearance.templateStyle ?? "classic"}
    data-background-image={backgroundImage ? "true" : undefined}
    data-custom-cursor={customCursor ? "true" : undefined}
    data-gradient-enabled={profile.appearance.gradientEnabled ? "true" : undefined}
    data-swap-box-colors={profile.appearance.swapBoxColors ? "true" : undefined}
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
        {entryExperience ? renderLinks() : layout.items.map((item, index) => renderItem(item, index))}
      </div>
    </div>
    </section>;

  return <>
    {entryExperience ? <details ref={entryDetailsRef} className="profile-entry-shell" onToggle={handleEntryToggle}>
      <summary className="profile-entry-overlay" role="button"
        onClick={enterProfile} aria-label={"click to enter... @" + profile.username}>
        <span>click to enter...</span>
        <small>@{profile.username}</small>
      </summary>
      {profileCard}
    </details> : profileCard}
    {entryExperience && hasNativeAudio && <div className="profile-volume-control" role="group" aria-label="Music volume control">
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
