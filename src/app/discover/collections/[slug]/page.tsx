import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { DiscoveryProfileCard } from "@/components/discovery-profile-card";
import { discoveryCollection } from "@/lib/discovery";
import { discoveryRequestFingerprint, discoveryServerClient } from "@/lib/discovery-server";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return slug.length <= 48 && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)
    ? { title: "Creator collection · Snoozer Discover", alternates: { canonical: "/discover/collections/" + slug } }
    : { robots: { index: false, follow: false } };
}

export default async function DiscoveryCollectionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (slug.length > 48 || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) notFound();

  let data: unknown = null;
  let failed = false;
  try {
    const fingerprint = await discoveryRequestFingerprint();
    const client = await discoveryServerClient();
    const response = await client.rpc("get_public_discovery_collection", {
      p_slug: slug, p_request_fingerprint: fingerprint,
    });
    failed = Boolean(response.error);
    data = response.data;
  } catch {
    failed = true;
  }

  const collection = discoveryCollection.safeParse(data);
  if (failed || !collection.success) notFound();

  return <main className="shell discovery-page">
    <SiteHeader/>
    <header className="discovery-category-hero">
      <p className="eyebrow">{collection.data.collection_type === "featured" ? "FEATURED CREATORS" : collection.data.collection_type === "spotlight" ? "SNOOZER SPOTLIGHT" : "SNOOZER CURATED COLLECTION"}</p>
      <h1>{collection.data.title}</h1>
      <p>{collection.data.description}</p>
      <Link className="text-link" href="/discover">← Back to Discover</Link>
    </header>
    {collection.data.profiles.length === 0
      ? <div className="discovery-empty">This collection has no currently discoverable profiles.</div>
      : <div className="discovery-profile-grid">
          {collection.data.profiles.map((profile) => <DiscoveryProfileCard key={profile.username} profile={profile}/>)}
        </div>}
  </main>;
}
