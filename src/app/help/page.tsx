import Link from "next/link";
import { HelpShell } from "@/components/help/help-shell";
import { HelpSearch } from "@/components/help/help-search";
import {
  helpArticles,
  helpCategories,
  popularHelpArticleSlugs,
} from "@/lib/help-content";

export const metadata = {
  title: "Help Centre",
  description: "Search Snoozer guides and find answers about profiles, Studio, accounts, billing and privacy.",
};

function matchesQuery(article: (typeof helpArticles)[number], query: string) {
  const searchable = [
    article.title,
    article.summary,
    article.category,
    ...article.keywords,
    ...article.sections.flatMap((section) => [
      section.heading,
      ...(section.paragraphs ?? []),
      ...(section.steps ?? []),
      ...(section.bullets ?? []),
    ]),
  ].join(" ").toLowerCase();
  return searchable.includes(query);
}

export default async function HelpPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const rawQuery = (await searchParams).q;
  const query = typeof rawQuery === "string" ? rawQuery.trim().slice(0, 100) : "";
  const normalisedQuery = query.toLowerCase();
  const results = normalisedQuery
    ? helpArticles.filter((article) => matchesQuery(article, normalisedQuery))
    : [];
  const popular = popularHelpArticleSlugs
    .map((slug) => helpArticles.find((article) => article.slug === slug))
    .filter((article): article is (typeof helpArticles)[number] => Boolean(article));

  return (
    <HelpShell>
      <div className="hc-page-heading">
        <nav aria-label="Breadcrumb" className="hc-breadcrumb">
          <span>Help Centre</span>
        </nav>
        <div className="hc-hero">
          <p className="hc-eyebrow">SNOOZER DOCUMENTATION</p>
          <h1>How can we <em>help you?</em></h1>
          <p className="hc-hero-copy">Find a quick answer, follow a guide or learn more about what you can do with Snoozer.</p>
          <HelpSearch size="large" initialQuery={query} />
          <p className="hc-search-tip">Search all guides and articles. Press <kbd>Ctrl K</kbd> to jump to search.</p>
        </div>
      </div>

      {normalisedQuery ? (
        <section className="hc-section hc-search-results" aria-labelledby="hc-results-title">
          <div className="hc-section-heading">
            <div>
              <p className="hc-eyebrow">DOCUMENTATION SEARCH</p>
              <h2 id="hc-results-title">Results for “{query}”</h2>
              <p>{results.length} {results.length === 1 ? "article" : "articles"} match your search.</p>
            </div>
            <Link href="/help" className="hc-text-link">Clear search <span aria-hidden="true">↗</span></Link>
          </div>
          {results.length ? (
            <div className="hc-article-list">
              {results.map((article) => (
                <Link className="hc-article-row" href={`/help/${article.slug}`} key={article.slug}>
                  <span className="hc-article-row-mark" aria-hidden="true">↗</span>
                  <span className="hc-article-row-copy">
                    <span className="hc-article-category">{helpCategories.find((item) => item.slug === article.category)?.title}</span>
                    <strong>{article.title}</strong>
                    <span>{article.summary}</span>
                  </span>
                  <span className="hc-row-arrow" aria-hidden="true">→</span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="hc-empty-state">
              <span className="hc-empty-mark" aria-hidden="true">⌕</span>
              <h3>No matching articles</h3>
              <p>Try a different phrase or browse a topic below. You can also contact Snoozer support.</p>
              <div className="hc-inline-actions">
                <Link href="/help" className="hc-button hc-button-quiet">Browse topics</Link>
                <Link href="/help/contact" className="hc-button hc-button-primary">Contact support</Link>
              </div>
            </div>
          )}
        </section>
      ) : (
        <>
          <section className="hc-section" aria-labelledby="hc-topics-title">
            <div className="hc-section-heading">
              <div>
                <p className="hc-eyebrow">BROWSE BY TOPIC</p>
                <h2 id="hc-topics-title">Find what you need</h2>
                <p>Explore the help centre by subject.</p>
              </div>
              <span className="hc-section-count">{helpCategories.length} TOPICS</span>
            </div>
            <div className="hc-category-grid">
              {helpCategories.map((category) => {
                const count = helpArticles.filter((article) => article.category === category.slug).length;
                return (
                  <Link href={`/help/category/${category.slug}`} className="hc-category-card" key={category.slug}>
                    <span className="hc-category-symbol" aria-hidden="true">{category.symbol}</span>
                    <span className="hc-category-card-copy">
                      <strong>{category.title}</strong>
                      <span>{category.description}</span>
                      <small>{count} {count === 1 ? "guide" : "guides"}</small>
                    </span>
                    <span className="hc-category-arrow" aria-hidden="true">↗</span>
                  </Link>
                );
              })}
            </div>
          </section>

          <section className="hc-section" aria-labelledby="hc-popular-title">
            <div className="hc-section-heading">
              <div>
                <p className="hc-eyebrow">A GOOD PLACE TO START</p>
                <h2 id="hc-popular-title">Popular articles</h2>
                <p>Answers Snoozer users often need.</p>
              </div>
              <Link href="/help/category/getting-started" className="hc-text-link">All guides <span aria-hidden="true">↗</span></Link>
            </div>
            <div className="hc-popular-grid">
              {popular.map((article, index) => (
                <Link href={`/help/${article.slug}`} className="hc-popular-card" key={article.slug}>
                  <span className="hc-popular-index">{String(index + 1).padStart(2, "0")}</span>
                  <span className="hc-popular-content">
                    <strong>{article.title}</strong>
                    <span>{article.summary}</span>
                  </span>
                  <span className="hc-popular-arrow" aria-hidden="true">↗</span>
                </Link>
              ))}
            </div>
          </section>

          <section className="hc-update-strip" aria-label="Latest Snoozer updates">
            <div className="hc-update-icon" aria-hidden="true">✳</div>
            <div>
              <p className="hc-eyebrow">WHAT'S NEW</p>
              <h2>See what’s changed in Snoozer</h2>
              <p>New features, improvements and fixes from across the platform.</p>
            </div>
            <Link href="/help/changelog" className="hc-button hc-button-quiet">View changelog <span aria-hidden="true">→</span></Link>
          </section>
        </>
      )}

      <section className="hc-support-panel">
        <div className="hc-support-orb" aria-hidden="true">?</div>
        <div>
          <p className="hc-eyebrow">STILL NEED A HAND?</p>
          <h2>We’re here to help.</h2>
          <p>Can’t find the answer? Get in touch with the Snoozer support team.</p>
        </div>
        <Link href="/help/contact" className="hc-button hc-button-primary">Contact support <span aria-hidden="true">↗</span></Link>
      </section>
    </HelpShell>
  );
}
