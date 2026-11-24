"use client";

import { useRef, type CSSProperties, type DragEvent, type MouseEvent, type PointerEvent, type ReactNode } from "react";
import { countdownDate, countdownTarget } from "@/lib/countdown";
import { Countdown } from "./countdown";
import { linkAccentColours } from "@/lib/link-accent";
import { socialMarkForUrl } from "@/lib/social-providers";
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

type SocialLink = { label: string; url: string; index: number; mark: string };

const socialMark = socialMarkForUrl;

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

export function ProfileCard({ profile, avatarSrc, galleryBase, preview = false, previewLabel = "Page preview", ownerBadge = false, discordPresence = null, discordPresenceRetry = false, reportBaseUrl, onMoveLayoutItem, onSelectLayoutItem }: {
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
}) {
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
    {profile.bio && <p className="profile-bio">{profile.bio}</p>}
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
    if (valid.length === 0) return null;
    const hasProviderEmbed = (url: string) => Boolean(
      spotifyResource(url) || youtubeVideoId(url) || metadataWidget(url) || twitchChannel(url) || robloxPlace(url)
    );
    const social: SocialLink[] = valid.flatMap(({ label, url, index }) => {
      const mark = socialMark(url);
      return mark && !hasProviderEmbed(url) ? [{ label, url, index, mark }] : [];
    });
    const regular = valid.filter(({ url }) => !socialMark(url) || hasProviderEmbed(url));
    return <>
      {social.length > 0 && <nav className="profile-social-links" aria-label="Social profiles">
        {social.map(({ label, url, index, mark }) => <a key={url + index} className="profile-social-link" href={url}
          rel="ugc nofollow noreferrer" title={label} aria-label={`${mark} ${label}`}
          data-analytics-profile={preview ? undefined : profile.username}
          data-analytics-position={preview ? undefined : index + 1}>
          <span aria-hidden="true" className="profile-social-mark">{mark}</span>
        </a>)}
      </nav>}
      {regular.length > 0 && <ul className="profile-links" style={linkStyle}>
        {regular.map(({ label, url, index }) => {
          const video = youtubeVideoId(url);
          const metadata = metadataWidget(url);
          const channel = twitchChannel(url);
          const place = robloxPlace(url);
          const spotify = spotifyResource(url);
          return <li key={`${url}-${index}`} className={spotify ? "spotify-link-slot" : undefined}>
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
      </ul>}
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
    return <InteractiveProfileWidgets widgets={profile.widgets} username={profile.username} preview={preview} reportBaseUrl={reportBaseUrl} />;
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

  return <section className={`profile-card theme-${profile.theme}`} aria-label={preview ? previewLabel : undefined}
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
    {effects.enabled && <label className="profile-effects-toggle">
      <input type="checkbox" aria-label="Disable profile effects" />
      <span className="effects-disable-text">Disable effects</span>
      <span className="effects-enable-text">Enable effects</span>
    </label>}
    <div className="profile-decoration" aria-hidden="true" />
    <div className="profile-inner">
      <header className="profile-identity">{identity}</header>
      <div className="profile-layout profile-sections" role="group" aria-label="Profile content">
        {layout.items.map((item, index) => renderItem(item, index))}
      </div>
    </div>
  </section>;
}
