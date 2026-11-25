import Link from "next/link";
import { discoveryCategoryLabel } from "@/lib/discovery";

type Profile = {
  username: string;
  display_name: string;
  bio: string;
  avatar: string | null;
  category: string;
  tags: string[];
  has_verified_domain: boolean;
};

export function DiscoveryProfileCard({ profile }: { profile: Profile }) {
  const initial = Array.from(profile.display_name.trim())[0]?.toLocaleUpperCase("en-GB") ?? "?";
  return <article className="discovery-profile-card">
    <Link className="discovery-profile-link" href={"/" + profile.username} aria-label={"View " + profile.display_name + " profile"}>
      <div className="discovery-profile-avatar">
        {profile.avatar
          // Use Snoozer's validated avatar route rather than an arbitrary remote URL.
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={"/media/avatar/" + profile.username + "/" + profile.avatar} alt="" loading="lazy" width={64} height={64}/>
          : <span aria-hidden="true">{initial}</span>}
      </div>
      <div className="discovery-profile-identity">
        <div className="discovery-profile-name-row">
          <strong>{profile.display_name}</strong>
          {profile.has_verified_domain && <span className="discovery-domain-mark" title="Verified custom domain" aria-label="Verified custom domain">✓</span>}
        </div>
        <span className="discovery-profile-handle">@{profile.username}</span>
      </div>
      <span className="discovery-profile-category">{discoveryCategoryLabel(profile.category)}</span>
      {profile.bio && <p className="discovery-profile-bio">{profile.bio}</p>}
      {profile.tags.length > 0 && <ul className="discovery-profile-tags" aria-label="Creator interests">
        {profile.tags.slice(0, 3).map((tag) => <li key={tag}>{tag.replaceAll("-", " ")}</li>)}
      </ul>}
      <span className="discovery-profile-open">View profile <span aria-hidden="true">↗</span></span>
    </Link>
    <Link className="discovery-profile-report" href={"/report/" + profile.username}>Report profile</Link>
  </article>;
}
