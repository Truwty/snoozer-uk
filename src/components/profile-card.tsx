import type { CSSProperties } from "react";
import { countdownDate, countdownTarget } from "@/lib/countdown";
import { Countdown } from "./countdown";
import { linkAccentColours } from "@/lib/link-accent";
import { kofiProfileUrl } from "@/lib/kofi-link";
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

export function ProfileCard({ profile, avatarSrc, galleryBase, preview = false, previewLabel = "Page preview", ownerBadge = false, discordPresence = null }: {
  profile: PublishedProfile;
  avatarSrc?: string;
  galleryBase?: string;
  preview?: boolean;
  previewLabel?: string;
  ownerBadge?: boolean;
  discordPresence?: DiscordPresencePublic | null;
}) {
  const effects = profile.appearance.effects ?? defaultEffects;
  const visibleSections = profile.sections.filter(({ heading, hidden }) => !hidden && heading.trim());
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
    ? { "--profile-background-image": backgroundImage } as CSSProperties
    : undefined;
  const discordBadge = !preview && discordPresence
    ? <DiscordPresenceWidget key={profile.username} username={profile.username} initialPresence={discordPresence} />
    : null;

  return <section className={`profile-card theme-${profile.theme}`} aria-label={preview ? previewLabel : undefined}
    data-entrance={profile.appearance.entrance} data-layout={profile.appearance.layout} data-density={profile.appearance.density} data-corners={profile.appearance.corners}
    data-background-image={backgroundImage ? "true" : undefined} style={backgroundStyle}
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
      {avatarSrc
        // The server route serves an already resized raster.
        // eslint-disable-next-line @next/next/no-img-element
        ? <img className="avatar" alt="" width={88} height={88} src={avatarSrc} />
        : <div className="avatar avatar-fallback" aria-hidden="true">{Array.from(profile.display_name)[0]?.toUpperCase()}</div>}
      <p className="profile-handle">@{profile.username}</p>
      {preview ? <h2 className="profile-name-heading">{profile.display_name}{discordBadge}{ownerBadge && <span className="profile-owner-badge" title="Verified Snoozer platform owner"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m2 8 5 4 5-8 5 8 5-4-2 11H4L2 8Z"/><path d="M7 22h10"/></svg> Owner</span>}</h2> : <h1 className="profile-name-heading">{profile.display_name}{discordBadge}{ownerBadge && <span className="profile-owner-badge" title="Verified Snoozer platform owner"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m2 8 5 4 5-8 5 8 5-4-2 11H4L2 8Z"/><path d="M7 22h10"/></svg> Owner</span>}</h1>}
      {profile.bio && <p className="profile-bio">{profile.bio}</p>}
      {visibleSections.length > 0 && <div className="profile-sections">
        {visibleSections.map((section, index) => {
          const target = section.kind === "countdown" ? countdownTarget(section.target ?? "") : null;
          if (section.kind === "quote") return <figure className="profile-text-section profile-quote" key={index}>
            <blockquote><p>{section.body}</p></blockquote>
            <figcaption>{section.heading}</figcaption>
          </figure>;
          return <section className={"profile-text-section" + (section.kind === "callout" ? " profile-callout" : section.kind === "project" ? " profile-project" : "")} key={index}>
            {preview ? <h3>{section.heading}</h3> : <h2>{section.heading}</h2>}
            <p>{section.body}</p>
            {section.kind === "project" && section.target && safeLink(section.target) && <a className="project-link" href={section.target} rel="ugc nofollow noreferrer">Explore {section.heading} <span aria-hidden="true">↗</span></a>}
            {section.kind === "countdown" && <div className="countdown">
              {target ? <>
                <p><time dateTime={target.toISOString()}>{countdownDate(target)}</time></p>
                <Countdown key={section.target} target={target.valueOf()} />
              </> : <p>Choose a target time to preview the countdown.</p>}
            </div>}
          </section>;
        })}
      </div>}
      {profile.links.length > 0 && <ul className="profile-links" style={linkStyle}>
        {profile.links.filter(({ url }) => safeLink(url)).map(({ label, url }, index) => {
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
      {galleryBase && profile.gallery.length > 0 && <section className="profile-gallery">
        {preview ? <h3>Gallery</h3> : <h2>Gallery</h2>}
        <ul className="profile-gallery-grid">
          {profile.gallery.filter((item) => item.id !== (backgroundImage ? background?.id : undefined)).map((item) => <li key={item.id}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="gallery-image" src={galleryBase + "/" + item.id} alt={item.alt}
              width={item.width} height={item.height} loading="lazy" />
          </li>)}
        </ul>
      </section>}
    </div>
  </section>;
}
