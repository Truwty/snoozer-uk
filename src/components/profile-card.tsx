import { safeLink, type PublishedProfile } from "@/lib/profile";

export function ProfileCard({ profile, avatarSrc, preview = false }: {
  profile: PublishedProfile;
  avatarSrc?: string;
  preview?: boolean;
}) {
  return <section className={`profile-card theme-${profile.theme}`} aria-label={preview ? "Page preview" : undefined}>
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
      {profile.links.length > 0 && <ul className="profile-links">
        {profile.links.filter(({ url }) => safeLink(url)).map(({ label, url }, index) =>
          <li key={`${url}-${index}`}><a href={url} rel="ugc nofollow noreferrer">{label} <span aria-hidden="true">↗</span></a></li>
        )}
      </ul>}
    </div>
  </section>;
}
