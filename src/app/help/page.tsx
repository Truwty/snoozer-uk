import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { helpArticles, helpCategories } from "@/lib/help-content";

export const metadata = {
  title: "Help Center",
  description: "How-to guides and answers for Snoozer accounts, profile editing, custom domains, analytics and Premium.",
};

export default async function HelpPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const search = (await searchParams).q;
  const q = typeof search === "string" ? search.trim().slice(0, 100).toLowerCase() : "";
  const visible = helpArticles.filter((article) => !q ||
    [article.title, article.summary, article.category, ...article.sections.flatMap((section) => [section.heading, ...(section.paragraphs ?? [])])]
      .some((piece) => piece.toLowerCase().includes(q)));
  return <main className="shell help-page">
    <SiteHeader />
    <section className="help-hero">
      <p className="eyebrow">SNOOZER KNOWLEDGE BASE</p>
      <h1>How can we <em>help you?</em></h1>
      <p>Search guides, find answers and make the most of your Snoozer page.</p>
      <form action="/help" method="get" role="search" className="help-search">
        <label htmlFor="help-query" className="sr-only">Search documentation</label>
        <span aria-hidden="true">⌕</span>
        <input id="help-query" name="q" type="search" placeholder="Search documentation…" defaultValue={q} maxLength={100}/>
        <button className="button small" type="submit">Search</button>
      </form>
    </section>
    {q && <p className="help-result-count" role="status">{visible.length} {visible.length === 1 ? "article" : "articles"} found for “{q}”. <Link href="/help">Clear search</Link></p>}
    {visible.length === 0 ? <section className="help-empty panel"><h2>No results found</h2><p>Try another word or contact our team.</p><a href="mailto:SnoozerSupport@Snoozer.uk">Contact support</a></section> :
      <div className="help-categories">{helpCategories.map((category) => {
        const docs = visible.filter((item) => item.category === category);
        return docs.length > 0 && <section key={category} className="help-category">
          <h2>{category}</h2><ul>{docs.map((article) => <li key={article.slug}>
            <Link href={`/help/${article.slug}`}><strong>{article.title}</strong><span>{article.summary}</span><span aria-hidden="true" className="help-arrow">↗</span></Link>
          </li>)}</ul>
        </section>;
      })}</div>}
    <aside className="help-contact"><h2>Still need help?</h2><p>Can't find what you're looking for? Get in touch with Snoozer support.</p><a className="button primary" href="mailto:SnoozerSupport@Snoozer.uk">Contact support</a></aside>
  </main>;
}
