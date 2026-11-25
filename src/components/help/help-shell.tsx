import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { helpCategories } from "@/lib/help-content";

type HelpShellProps = {
  children: React.ReactNode;
  activeCategory?: string;
};

export function HelpShell({ children, activeCategory }: HelpShellProps) {
  return (
    <main className="hc-page">
      <SiteHeader />
      <div className="hc-layout">
        <aside className="hc-sidebar" aria-label="Help centre">
          <div className="hc-sidebar-heading">
            <Link href="/help" className="hc-sidebar-title">Help centre</Link>
            <span className="hc-sidebar-caption">SNOOZER SUPPORT</span>
          </div>
          <nav className="hc-sidebar-nav" aria-label="Help centre navigation">
            <Link className="hc-nav-link hc-nav-overview" href="/help">
              <span className="hc-nav-symbol" aria-hidden="true">⌂</span>
              <span>Overview</span>
            </Link>
            <p className="hc-sidebar-label">DOCUMENTATION</p>
            {helpCategories.map((category) => (
              <Link
                key={category.slug}
                className="hc-nav-link"
                href={`/help/category/${category.slug}`}
                aria-current={activeCategory === category.slug ? "page" : undefined}
              >
                <span className="hc-nav-symbol" aria-hidden="true">{category.symbol}</span>
                <span>{category.title}</span>
              </Link>
            ))}
            <div className="hc-sidebar-divider" />
            <Link className="hc-nav-link" href="/help/changelog">
              <span className="hc-nav-symbol" aria-hidden="true">↗</span>
              <span>Changelog</span>
            </Link>
            <Link className="hc-nav-link" href="/help/contact">
              <span className="hc-nav-symbol" aria-hidden="true">✉</span>
              <span>Contact support</span>
            </Link>
          </nav>
          <div className="hc-sidebar-bottom">
            <span className="hc-status-dot" aria-hidden="true" />
            <span>Need a hand?</span>
            <Link href="/help/contact">Talk to Snoozer support</Link>
          </div>
        </aside>
        <div className="hc-main">
          {children}
          <footer className="hc-footer">
            <div>
              <Link href="/help" className="hc-footer-brand">Snoozer Help Centre</Link>
              <p>Guides and answers to help you get more from your page.</p>
            </div>
            <nav aria-label="Help centre footer links">
              <Link href="/help/changelog">Changelog</Link>
              <Link href="/help/contact">Contact</Link>
              <Link href="/terms">Terms</Link>
              <Link href="/privacy">Privacy</Link>
            </nav>
            <span className="hc-footer-copy">© {new Date().getFullYear()} Snoozer</span>
          </footer>
        </div>
      </div>
    </main>
  );
}
