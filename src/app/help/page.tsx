import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { helpArticles, type HelpArticle } from "@/lib/help-articles";

export const metadata = {
  title: "Help Center",
  description: "Guides to creating, customising and managing a Snoozer profile.",
};

const categories: HelpArticle["category"][] = ["Getting started", "Your profile", "Account and security", "Premium"];

export default async function HelpHome({ searchParams }: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const { q } = await searchParams;
  const query = (typeof q === "string" ? q : "").trim().slice(0, 80);
  const visible = helpArticles.filter((article) =>
    !query || [article.title, article.description, article.category, ...article.sections.map(section => section.heading)]
      .join(" ").toLowerCase().includes(query.toLowerCase()));
  return <main className="shell help-page">
    <SiteHeader />
    <section className="help-hero">
      <p className="eyebrow">SNOOZER HELP CENTER</p>
      <h1>How can we <em>help you?</em></h1>
      <p className="lead">Straightforward guides for getting your profile online, making it yours and keeping your account secure.</p>
      <form role="search" action="/help" method="get" className="help-search">
        <label htmlFor="help-search-input" className="sr-only">Search help guides</label>
        <input id="help-search-input" type="search" name="q" defaultValue={query} placeholder="Search help articles…" maxLength={80} />
        <button type="submit" className="button primary">Search</button>
      </form>
    </section>
    {query && <p role="status" className="help-search-result">{visible.length} articles found for “{query}”. <Link href="/help">Clear search</Link></p>}
    <section className="help-categories" aria-label="Help topics">
      {categories.map((category) => {
        const articles = visible.filter((article) => article.category === category);
        if (!articles.length) return null;
        return <div className="help-category" key={category}>
          <h2>{category}</h2>
          <div className="help-article-grid">
            {articles.map((article) => <Link href={`/help/${article.slug}`} className="help-article-link" key={article.slug}>
              <strong>{article.title}</strong>
              <span>{article.description}</span>
              <span className="help-link-arrow" aria-hidden="true">↗</span>
            </Link>)}
          </div>
        </div>;
      })}
      {!visible.length && <div className="panel stack"><h2>No matching guides</h2><p>Try a shorter search or browse all guides.</p><Link href="/help">View all help articles</Link></div>}
    </section>
    <footer className="help-footer">Still need a hand? <a href="mailto:SnoozerSupport@Snoozer.uk">Contact Snoozer support</a> · <Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link></footer>
  </main>;
}
