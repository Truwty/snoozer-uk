import Link from "next/link";
import { notFound } from "next/navigation";
import { HelpShell } from "@/components/help/help-shell";
import { HelpSearch } from "@/components/help/help-search";
import {
  findHelpArticle,
  findHelpCategory,
  getRelatedHelpArticles,
  helpArticleReadingTime,
  helpArticles,
  helpSectionId,
} from "@/lib/help-content";

export function generateStaticParams() {
  return helpArticles.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const article = findHelpArticle((await params).slug);
  return article
    ? { title: article.title, description: article.summary }
    : { title: "Help Centre" };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const article = findHelpArticle((await params).slug);
  if (!article) notFound();
  const category = findHelpCategory(article.category);
  const related = getRelatedHelpArticles(article);
  const readingTime = helpArticleReadingTime(article);

  return (
    <HelpShell activeCategory={article.category}>
      <div className="hc-content-toolbar">
        <nav aria-label="Breadcrumb" className="hc-breadcrumb">
          <Link href="/help">Help Centre</Link>
          <span aria-hidden="true">/</span>
          <Link href={`/help/category/${article.category}`}>{category?.title ?? "Guides"}</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{article.title}</span>
        </nav>
        <HelpSearch size="compact" />
      </div>

      <article className="hc-article">
        <header className="hc-article-header">
          <Link className="hc-article-category-link" href={`/help/category/${article.category}`}>
            <span aria-hidden="true">{category?.symbol}</span>
            {category?.title ?? "Snoozer guides"}
          </Link>
          <h1>{article.title}</h1>
          <p className="hc-article-summary">{article.summary}</p>
          <div className="hc-article-meta">
            <span>{article.sections.length} sections</span>
            <span aria-hidden="true">·</span>
            <span>{readingTime} min read</span>
          </div>
        </header>

        <div className="hc-article-layout">
          <div className="hc-article-body">
            {article.sections.map((section, index) => (
              <section className="hc-article-section" id={helpSectionId(section.heading)} key={section.heading}>
                <div className="hc-article-section-title">
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <h2>{section.heading}</h2>
                </div>
                {section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                {section.steps && (
                  <ol className="hc-steps">
                    {section.steps.map((step) => <li key={step}><span>{step}</span></li>)}
                  </ol>
                )}
                {section.bullets && (
                  <ul className="hc-bullets">
                    {section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
                  </ul>
                )}
              </section>
            ))}
            <div className="hc-article-end">
              <span className="hc-article-end-mark" aria-hidden="true">✓</span>
              <div>
                <strong>You’ve reached the end of this guide.</strong>
                <p>Still have a question? The Snoozer support team can point you in the right direction.</p>
              </div>
              <Link href="/help/contact" className="hc-text-link">Contact support <span aria-hidden="true">↗</span></Link>
            </div>
            <div className="hc-article-navigation">
              <Link href={`/help/category/${article.category}`} className="hc-button hc-button-quiet">
                <span aria-hidden="true">←</span> Back to {category?.title ?? "guides"}
              </Link>
              <Link href="/help" className="hc-button hc-button-primary">All help articles <span aria-hidden="true">→</span></Link>
            </div>
          </div>

          <aside className="hc-article-aside">
            <div className="hc-toc">
              <p className="hc-aside-title">ON THIS PAGE</p>
              <nav aria-label="On this page">
                {article.sections.map((section, index) => (
                  <a href={`#${helpSectionId(section.heading)}`} key={section.heading}>
                    <span>{String(index + 1).padStart(2, "0")}</span>{section.heading}
                  </a>
                ))}
              </nav>
            </div>
            {related.length > 0 && (
              <div className="hc-related">
                <p className="hc-aside-title">RELATED ARTICLES</p>
                {related.map((item) => (
                  <Link href={`/help/${item.slug}`} key={item.slug}>
                    <strong>{item.title}</strong>
                    <span aria-hidden="true">↗</span>
                  </Link>
                ))}
              </div>
            )}
            <div className="hc-aside-contact">
              <span aria-hidden="true">?</span>
              <strong>Need more help?</strong>
              <p>Get in touch and tell us what you’re stuck on.</p>
              <Link href="/help/contact">Contact support <span aria-hidden="true">→</span></Link>
            </div>
          </aside>
        </div>
      </article>
    </HelpShell>
  );
}
