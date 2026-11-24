import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { DiscoveryBrowser } from "@/components/discovery-browser";
import { DiscoveryCollectionCard } from "@/components/discovery-collection-card";
import { discoveryCollections, discoveryCategories } from "@/lib/discovery";
import { discoveryRequestFingerprint, discoveryServerClient } from "@/lib/discovery-server";
import type { DiscoverySearchParams } from "@/components/discovery-browser";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Discover creators",
  description: "Find developers, designers, artists and communities on Snoozer.",
  alternates: { canonical: "/discover" },
};

export default async function DiscoverPage({ searchParams }: { searchParams: Promise<DiscoverySearchParams> }) {
  const params = await searchParams;
  let response: { data: unknown; error: unknown } | null = null;
  try {
    const fingerprint = await discoveryRequestFingerprint();
    const client = await discoveryServerClient();
    response = await client.rpc("get_public_discovery_collections", {
      p_limit: 8, p_request_fingerprint: fingerprint,
    });
  } catch {
    response = null;
  }
  const collections = discoveryCollections.safeParse(response?.data);
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
    {collections.success && collections.data.length > 0 && <section className="discovery-featured" aria-labelledby="discovery-featured-title">
      <div className="discovery-section-heading"><div><p className="eyebrow">HAND-PICKED</p><h2 id="discovery-featured-title">Featured collections</h2></div></div>
      <div className="discovery-collections-grid">{collections.data.map((collection) => <DiscoveryCollectionCard key={collection.slug} collection={collection}/>)}</div>
    </section>}
    <DiscoveryBrowser searchParams={params}/>
  </main>;
}
