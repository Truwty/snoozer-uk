import Link from "next/link";
import { DiscoveryProfileCard } from "@/components/discovery-profile-card";
import type { z } from "zod";
import { discoveryCollection } from "@/lib/discovery";

type Collection = z.infer<typeof discoveryCollection>;

export function DiscoveryCollectionCard({ collection }: { collection: Collection }) {
  return <article className="discovery-collection-card">
    <header>
      <p className="eyebrow">{collection.collection_type === "featured" ? "FEATURED CREATORS" : collection.collection_type === "spotlight" ? "SNOOZER SPOTLIGHT" : "SNOOZER COLLECTION"}</p>
      <h3>{collection.title}</h3>
      {collection.description && <p>{collection.description}</p>}
    </header>
    <div className="discovery-collection-profiles">
      {collection.profiles.slice(0, 3).map((profile) =>
        <DiscoveryProfileCard key={profile.username} profile={{ ...profile, joined_at: "", rank_score: 0 }}/>)}
    </div>
    <Link className="text-link" href={"/discover/collections/" + collection.slug}>Explore collection ↗</Link>
  </article>;
}
