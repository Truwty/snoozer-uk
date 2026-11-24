import Link from "next/link";
import {
  decodeDiscoveryCursor, discoveryCategories, discoveryProfiles, discoveryTags,
  discoveryCategoryLabel, encodeDiscoveryCursor, firstSearchValue,
} from "@/lib/discovery";
import { discoveryRequestFingerprint, discoveryServerClient } from "@/lib/discovery-server";
import { DiscoveryProfileCard } from "@/components/discovery-profile-card";

export type DiscoverySearchParams = {
  q?: string | string[];
  category?: string | string[];
  tag?: string | string[];
  sort?: string | string[];
  cursor?: string | string[];
};

export async function DiscoveryBrowser({
  searchParams, fixedCategory,
}: { searchParams: DiscoverySearchParams; fixedCategory?: string }) {
  const query = firstSearchValue(searchParams.q).trim().slice(0, 80);
  const requestedCategory = fixedCategory ?? firstSearchValue(searchParams.category);
  const category = discoveryCategories.some((item) => item.value === requestedCategory) ? requestedCategory : "";
  const requestedTag = firstSearchValue(searchParams.tag);
  const tag = (discoveryTags as readonly string[]).includes(requestedTag) ? requestedTag : "";
  const requestedSort = firstSearchValue(searchParams.sort);
  const sort = requestedSort === "recent" || requestedSort === "name" ? requestedSort : "relevance";
  const cursor = decodeDiscoveryCursor(firstSearchValue(searchParams.cursor) || undefined, sort);
  let response: { data: unknown; error: unknown } | null = null;
  try {
    const fingerprint = await discoveryRequestFingerprint();
    const client = await discoveryServerClient();
    response = await client.rpc("get_profile_directory", {
      p_query: query,
      p_category: category || null,
      p_tags: tag ? [tag] : [],
      p_sort: sort,
      p_after_score: cursor?.score ?? null,
      p_after_timestamp: cursor?.timestamp ?? null,
      p_after_username: cursor?.username ?? null,
      p_limit: 25,
      p_request_fingerprint: fingerprint,
    });
  } catch {
    response = null;
  }
  const parsed = discoveryProfiles.safeParse(response?.data);
  const unavailable = !response || Boolean(response.error) || !parsed.success;
  const entries = parsed.success ? parsed.data : [];
  const hasMore = entries.length > 24;
  const visible = entries.slice(0, 24);
  const nextCursor = hasMore && visible.length
    ? encodeDiscoveryCursor(visible[visible.length - 1], sort) : null;
  const queryString = (next?: string) => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (category && !fixedCategory) params.set("category", category);
    if (tag) params.set("tag", tag);
    if (sort !== "relevance") params.set("sort", sort);
    if (next) params.set("cursor", next);
    const suffix = params.toString();
    return (fixedCategory ? "/discover/category/" + fixedCategory : "/discover") + (suffix ? "?" + suffix : "");
  };

  return <section className="discovery-browser" aria-labelledby="discovery-results-title">
    <form action={fixedCategory ? "/discover/category/" + fixedCategory : "/discover"} method="get" className="discovery-search-form">
      {fixedCategory && <input type="hidden" name="category" value={fixedCategory}/>}
      <label className="discovery-search-input">
        <span aria-hidden="true">⌕</span>
        <input type="search" name="q" maxLength={80} defaultValue={query} placeholder="Search creators, usernames or interests" aria-label="Search creators"/>
      </label>
      {!fixedCategory && <label><span className="sr-only">Category</span>
        <select name="category" defaultValue={category}>
          <option value="">All categories</option>
          {discoveryCategories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </label>}
      <label><span className="sr-only">Interest</span>
        <select name="tag" defaultValue={tag}>
          <option value="">Any interest</option>
          {discoveryTags.map((item) => <option key={item} value={item}>{item.replaceAll("-", " ")}</option>)}
        </select>
      </label>
      <label><span className="sr-only">Sort creators</span>
        <select name="sort" defaultValue={sort}>
          <option value="relevance">Most relevant</option><option value="recent">Recently joined</option><option value="name">Name A–Z</option>
        </select>
      </label>
      <button className="button primary" type="submit">Search</button>
    </form>

    <div className="discovery-results-heading">
      <div><p className="eyebrow">{category ? discoveryCategoryLabel(category).toUpperCase() : "PUBLIC CREATOR DIRECTORY"}</p>
        <h2 id="discovery-results-title">{query ? "Search results" : category ? discoveryCategoryLabel(category) : "Explore creators"}</h2></div>
      <span className="discovery-results-count">{unavailable ? "Unavailable" : entries.length ? (hasMore ? "24+" : String(entries.length)) + " profiles" : "No profiles"}</span>
    </div>

    {unavailable ? <div className="discovery-empty" role="alert">
      Creator discovery is temporarily unavailable. Please try again shortly.
    </div> : visible.length === 0 ? <div className="discovery-empty">
      <strong>No creators found</strong><span>Try a different search or remove one of the filters.</span>
      <Link className="text-link" href={fixedCategory ? "/discover/category/" + fixedCategory : "/discover"}>Clear search and filters</Link>
    </div> : <>
      <div className="discovery-profile-grid">{visible.map((profile) => <DiscoveryProfileCard key={profile.username} profile={profile}/>)}</div>
      <nav className="discovery-pagination" aria-label="Creator directory pages">
        {cursor && <Link className="button small" href={queryString()}>Back to first page</Link>}
        {nextCursor && <Link className="button small primary" href={queryString(nextCursor)}>Load next creators →</Link>}
      </nav>
    </>}
  </section>;
}
