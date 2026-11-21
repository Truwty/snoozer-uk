import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { findHelpArticle, helpArticles } from "@/lib/help-content";

export function generateStaticParams() {
  return helpArticles.map(({ slug }) => ({ slug }));
}
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const article = findHelpArticle((await params).slug);
  return article ? { title: `${article.title} — Help Center`, description: article.summary } : { title: "Help Center" };
}
export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const article = findHelpArticle((await params).slug);
  if (!article) notFound();
  return <main className="shell help-page">
    <SiteHeader />
    <article className="help-article">
      <nav aria-label="Breadcrumb" className="help-breadcrumb"><Link href="/help">Help Center</Link><span aria-hidden="true">/</span><span>{article.category}</span></nav>
      <p className="eyebrow">SNOOZER GUIDES</p>
      <h1>{article.title}</h1>
      <p className="help-article-summary">{article.summary}</p>
      <div className="help-article-body">{article.sections.map((section) => <section key={section.heading}>
        <h2>{section.heading}</h2>
        {section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        {section.steps && <ol>{section.steps.map((step) => <li key={step}>{step}</li>)}</ol>}
      </section>)}</div>
      <div className="help-article-bottom">
        <Link href="/help">← All guides</Link>
        <a href="mailto:SnoozerSupport@Snoozer.uk">Contact support</a>
      </div>
    </article>
  </main>;
}
