import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { helpArticles } from "@/lib/help-articles";

export function generateStaticParams() {
  return helpArticles.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = helpArticles.find((item) => item.slug === slug);
  return { title: article ? article.title + " · Help Center" : "Help article", description: article?.description };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = helpArticles.find((item) => item.slug === slug);
  if (!article) notFound();
  return <main className="shell help-page">
    <SiteHeader />
    <div className="help-breadcrumbs"><Link href="/help">Help Center</Link> <span aria-hidden="true">/</span> <span>{article.category}</span></div>
    <article className="help-article">
      <header className="help-article-head"><p className="eyebrow">{article.category.toUpperCase()}</p><h1>{article.title}</h1><p className="lead">{article.description}</p></header>
      {article.sections.map((section) => <section className="help-article-section" key={section.heading}>
        <h2>{section.heading}</h2>
        <ol>{section.guidance.map((paragraph) => <li key={paragraph}>{paragraph}</li>)}</ol>
      </section>)}
    </article>
    <nav className="help-article-end" aria-label="More help">
      <Link className="button" href="/help">← Back to all guides</Link>
      <a href="mailto:SnoozerSupport@Snoozer.uk">Contact support</a>
    </nav>
  </main>;
}
