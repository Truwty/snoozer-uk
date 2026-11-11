import type { CSSProperties } from "react";
import { linkAccentColours } from "@/lib/link-accent";
import { safeLink, type PublishedProfile } from "@/lib/profile";

export function ProfileCard({ profile, avatarSrc, galleryBase, preview = false, previewLabel = "Page preview" }: {
  profile: PublishedProfile;
  avatarSrc?: string;
  galleryBase?: string;
  preview?: boolean;
  previewLabel?: string;
}) {
  const linkColours = linkAccentColours(profile.appearance.accent);
  const linkStyle = linkColours ? {
    "--link-background": linkColours.background,
    "--link-foreground": linkColours.foreground,
  } as CSSProperties : undefined;

  return <section className={`profile-card theme-${profile.theme}`} aria-label={preview ? previewLabel : undefined}
    data-layout={profile.appearance.layout} data-density={profile.appearance.density} data-corners={profile.appearance.corners}>
    <div className="profile-decoration" aria-hidden="true" />
    <div className="profile-inner">
      {avatarSrc
        // The server route serves an already resized raster.
        // eslint-disable-next-line @next/next/no-img-element
        ? <img className="avatar" alt="" width={88} height={88} src={avatarSrc} />
        : <div className="avatar avatar-fallback" aria-hidden="true">{Array.from(profile.display_name)[0]?.toUpperCase()}</div>}
      <p className="profile-handle">@{profile.username}</p>
      {preview ? <h2>{profile.display_name}</h2> : <h1>{profile.display_name}</h1>}
      {profile.bio && <p className="profile-bio">{profile.bio}</p>}
      {profile.sections.length > 0 && <div className="profile-sections">
        {profile.sections.filter(({ heading }) => heading.trim()).map((section, index) => section.kind === "quote"
          ? <figure className="profile-text-section profile-quote" key={index}>
            <blockquote><p>{section.body}</p></blockquote>
            <figcaption>{section.heading}</figcaption>
          </figure>
          : <section className={section.kind === "callout" ? "profile-text-section profile-callout" : "profile-text-section"} key={index}>
            {preview ? <h3>{section.heading}</h3> : <h2>{section.heading}</h2>}
            <p>{section.body}</p>
          </section>)}
      </div>}
      {profile.links.length > 0 && <ul className="profile-links" style={linkStyle}>
        {profile.links.filter(({ url }) => safeLink(url)).map(({ label, url }, index) =>
          <li key={`${url}-${index}`}><a href={url} rel="ugc nofollow noreferrer">{label} <span aria-hidden="true">↗</span></a></li>
        )}
      </ul>}
      {galleryBase && profile.gallery.length > 0 && <section className="profile-gallery">
        {preview ? <h3>Gallery</h3> : <h2>Gallery</h2>}
        <ul className="profile-gallery-grid">
          {profile.gallery.map((item) => <li key={item.id}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="gallery-image" src={galleryBase + "/" + item.id} alt={item.alt}
              width={item.width} height={item.height} loading="lazy" />
          </li>)}
        </ul>
      </section>}
    </div>
  </section>;
}
