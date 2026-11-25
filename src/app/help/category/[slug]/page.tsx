import Link from "next/link";
import { notFound } from "next/navigation";
import { HelpShell } from "@/components/help/help-shell";
import { HelpSearch } from "@/components/help/help-search";
import { articlesInCategory, findHelpCategory, helpCategories } from "@/lib/help-content";

export function generateStaticParams() {
  return helpCategories.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const category = findHelpCategory((await params).slug);
  return category
    ? { title: category.title, description: category.description }
    : { title: "Help Centre" };
}

export default async function HelpCategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const category = findHelpCategory(slug);
  if (!category) notFound();
  const articles = articlesInCategory(slug);

  return (
    <HelpShell activeCategory={category.slug}>
      <div className="hc-content-toolbar">
        <nav aria-label="Breadcrumb" className="hc-breadcrumb">
          <Link href="/help">Help Centre</Link>
          <span aria-hidden="true">/</span>
          <span>{category.title}</span>
        </nav>
        <HelpSearch size="compact" />
      </div>
      <header className="hc-category-hero">
        <span className="hc-category-symbol hc-category-symbol-large" aria-hidden="true">{category.symbol}</span>
        <p className="hc-eyebrow">DOCUMENTATION CATEGORY</p>
        <h1>{category.title}</h1>
        <p>{category.description}</p>
        <span className="hc-category-total">{articles.length} {articles.length === 1 ? "ARTICLE" : "ARTICLES"}</span>
      </header>
      <section className="hc-section hc-category-articles" aria-labelledby="hc-category-articles-title">
        <div className="hc-section-heading">
          <div>
            <p className="hc-eyebrow">GUIDES & ANSWERS</p>
            <h2 id="hc-category-articles-title">Browse this topic</h2>
            <p>Choose an article to open the full guide.</p>
          </div>
        </div>
        <div className="hc-article-list">
          {articles.map((article, index) => (
            <Link className="hc-article-row" href={`/help/${article.slug}`} key={article.slug}>
              <span className="hc-article-row-mark" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
              <span className="hc-article-row-copy">
                <strong>{article.title}</strong>
                <span>{article.summary}</span>
              </span>
              <span className="hc-row-arrow" aria-hidden="true">→</span>
            </Link>
          ))}
        </div>
      </section>
      <section className="hc-other-topics" aria-labelledby="hc-other-topics-title">
        <div className="hc-section-heading">
          <div>
            <p className="hc-eyebrow">KEEP EXPLORING</p>
            <h2 id="hc-other-topics-title">Other topics</h2>
          </div>
        </div>
        <div className="hc-other-topic-links">
          {helpCategories.filter((item) => item.slug !== category.slug).map((item) => (
            <Link key={item.slug} href={`/help/category/${item.slug}`}>{item.title}<span aria-hidden="true">↗</span></Link>
          ))}
        </div>
      </section>
    </HelpShell>
  );
}
