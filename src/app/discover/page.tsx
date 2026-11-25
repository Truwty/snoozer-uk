import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { DiscoveryBrowser } from "@/components/discovery-browser";
import { DiscoveryCollectionCard } from "@/components/discovery-collection-card";
import { discoveryCollections, discoveryCollection, discoveryCategories } from "@/lib/discovery";
import type { z } from "zod";
import { discoveryRequestFingerprint, discoveryServerClient } from "@/lib/discovery-server";
import type { DiscoverySearchParams } from "@/components/discovery-browser";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Discover creators",
  description: "Find developers, designers, artists and communities on Snoozer.",
  alternates: { canonical: "/discover" },
};

type Collection = z.infer<typeof discoveryCollection>;

function CollectionShelf({
  id, eyebrow, title, entries,
}: {
  id: string;
  eyebrow: string;
  title: string;
  entries: Collection[];
}) {
  if (entries.length === 0) return null;
  return <section className="discovery-featured" aria-labelledby={id}>
    <div className="discovery-section-heading">
      <div><p className="eyebrow">{eyebrow}</p><h2 id={id}>{title}</h2></div>
    </div>
    <div className="discovery-collections-grid">
      {entries.map((collection) => <DiscoveryCollectionCard key={collection.slug} collection={collection}/>)}
    </div>
  </section>;
}

export default async function DiscoverPage({ searchParams }: { searchParams: Promise<DiscoverySearchParams> }) {
  const params = await searchParams;
  let response: { data: unknown; error: unknown } | null = null;
  try {
    const fingerprint = await discoveryRequestFingerprint();
    const client = await discoveryServerClient();
    response = await client.rpc("get_public_discovery_collections", {
      p_limit: 20, p_request_fingerprint: fingerprint,
    });
  } catch {
    response = null;
  }
  const parsed = discoveryCollections.safeParse(response?.data);
  const entries = parsed.success ? parsed.data : [];
  const featured = entries.filter((collection) => collection.collection_type === "featured");
  const spotlight = entries.filter((collection) => collection.collection_type === "spotlight");
  const regular = entries.filter((collection) => collection.collection_type === "collection");

  return <main className="shell discovery-page">
    <SiteHeader/>
    <header className="discovery-hero">
      <p className="eyebrow">SNOOZER COMMUNITY</p>
      <h1>Discover your next favourite creator.</h1>
      <p>Explore people, projects and communities that have chosen to be part of Snoozer Discover.</p>
      <div className="discovery-category-pills" aria-label="Browse categories">
        {discoveryCategories.map((item) => <Link key={item.value} href={"/discover/category/" + item.value}>{item.label}</Link>)}
      </div>
    </header>
    <CollectionShelf id="discovery-featured-title" eyebrow="HAND-PICKED" title="Featured creators" entries={featured}/>
    <CollectionShelf id="discovery-spotlight-title" eyebrow="IN THE SPOTLIGHT" title="Community spotlight" entries={spotlight}/>
    <CollectionShelf id="discovery-collections-title" eyebrow="EXPLORE MORE" title="Creator collections" entries={regular}/>
    <DiscoveryBrowser searchParams={params}/>
  </main>;
}
