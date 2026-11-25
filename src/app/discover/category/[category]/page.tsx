import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { DiscoveryBrowser, type DiscoverySearchParams } from "@/components/discovery-browser";
import { discoveryCategories } from "@/lib/discovery";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  const item = discoveryCategories.find((entry) => entry.value === category);
  return item ? {
    title: item.label + " on Snoozer Discover",
    description: item.description + ". Discover public Snoozer profiles.",
    alternates: { canonical: "/discover/category/" + item.value },
  } : { robots: { index: false, follow: false } };
}

export default async function DiscoveryCategoryPage({
  params, searchParams,
}: { params: Promise<{ category: string }>; searchParams: Promise<DiscoverySearchParams> }) {
  const [{ category }, filters] = await Promise.all([params, searchParams]);
  const item = discoveryCategories.find((entry) => entry.value === category);
  if (!item) notFound();
  return <main className="shell discovery-page">
    <SiteHeader/>
    <header className="discovery-category-hero">
      <p className="eyebrow">SNOOZER / DISCOVER</p>
      <h1>{item.label}</h1>
      <p>{item.description}.</p>
    </header>
    <DiscoveryBrowser searchParams={filters} fixedCategory={category}/>
  </main>;
}
