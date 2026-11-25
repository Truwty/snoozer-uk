import Link from "next/link";
import { HelpShell } from "@/components/help/help-shell";
import { HelpSearch } from "@/components/help/help-search";
import { helpUpdates } from "@/lib/help-changelog";

export const metadata = {
  title: "Changelog",
  description: "Recent Snoozer features, improvements and product updates.",
};

export default function HelpChangelogPage() {
  return (
    <HelpShell>
      <div className="hc-content-toolbar">
        <nav aria-label="Breadcrumb" className="hc-breadcrumb">
          <Link href="/help">Help Centre</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Changelog</span>
        </nav>
        <HelpSearch size="compact" />
      </div>
      <header className="hc-simple-hero">
        <p className="hc-eyebrow">PRODUCT UPDATES</p>
        <h1>What’s new in <em>Snoozer</em></h1>
        <p>New features, improvements and changes across your Snoozer experience.</p>
      </header>
      <section className="hc-changelog" aria-label="Snoozer updates">
        {helpUpdates.map((update, index) => (
          <article className="hc-changelog-item" key={`${update.date}-${update.title}`}>
            <div className="hc-changelog-date">
              <span>{update.date}</span>
              <span className="hc-changelog-marker" aria-hidden="true" />
            </div>
            <div className="hc-changelog-card">
              <div className="hc-changelog-card-top">
                <span className="hc-tag">{update.label}</span>
                <span className="hc-changelog-number">UPDATE {String(helpUpdates.length - index).padStart(2, "0")}</span>
              </div>
              <h2>{update.title}</h2>
              <p>{update.summary}</p>
              <Link href={update.href} className="hc-text-link">Read the guide <span aria-hidden="true">↗</span></Link>
            </div>
          </article>
        ))}
      </section>
      <div className="hc-changelog-bottom">
        <p>Looking for help with a feature?</p>
        <Link href="/help" className="hc-button hc-button-quiet">Browse all guides <span aria-hidden="true">→</span></Link>
      </div>
    </HelpShell>
  );
}
