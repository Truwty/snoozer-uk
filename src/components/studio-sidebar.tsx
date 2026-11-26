"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { filterStudioNavigation } from "@/lib/studio-navigation";

type Props = { pageHref?: string; pagePublished: boolean; accountFooter?: ReactNode };

export function StudioSidebar({ pageHref, pagePublished, accountFooter }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedProfile = searchParams.get("profile");
  const [query, setQuery] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [accountExpanded, setAccountExpanded] = useState(true);
  const [moreExpanded, setMoreExpanded] = useState(false);
  const [copyMessage, setCopyMessage] = useState("");
  const groups = useMemo(() => filterStudioNavigation(query), [query]);
  const accountGroup = groups.find((group) => group.label === "Account");
  const mainGroup = groups.find((group) => group.label === "Main");
  const moreGroup = groups.find((group) => group.label === "More Snoozer tools");
  const accountItems = accountGroup?.items ?? [];
  const mainItems = mainGroup?.items ?? [];
  const moreItems = moreGroup?.items ?? [];
  const hasResults = Boolean(accountItems.length || mainItems.length || moreItems.length);
  const moreActive = moreItems.some((item) => pathname === item.href || pathname.startsWith(item.href + "/"));
  const showMore = moreExpanded || moreActive || Boolean(query.trim());

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const hrefFor = (href: string) => selectedProfile && href.startsWith("/studio")
    ? href + (href.includes("?") ? "&" : "?") + "profile=" + encodeURIComponent(selectedProfile)
    : href;
  const isActive = (href: string) => href === "/studio"
    ? pathname === "/studio"
    : pathname === href || pathname.startsWith(href + "/");
  const linkClass = (href: string) => "studio-sidebar-link" + (isActive(href) ? " is-active" : "");

  async function shareProfile() {
    if (!pageHref) return;
    try {
      await navigator.clipboard.writeText(new URL(pageHref, window.location.origin).href);
      setCopyMessage("Profile link copied.");
    } catch {
      setCopyMessage("Couldn’t copy the link. Open My Page and copy its address.");
    }
  }

  function renderLink(item: (typeof moreItems)[number] | (typeof mainItems)[number] | (typeof accountItems)[number]) {
    return <Link key={item.href} href={hrefFor(item.href)} title={item.label}
      className={linkClass(item.href)} aria-current={isActive(item.href) ? "page" : undefined}
      onClick={() => setMobileOpen(false)}>
      <span className="studio-sidebar-icon" aria-hidden="true">{item.icon}</span>
      <span className="studio-nav-copy">{item.label}</span>
    </Link>;
  }

  return <aside className={"studio-sidebar" + (mobileOpen ? " is-mobile-open" : "") + (collapsed ? " is-collapsed" : "")}
    aria-label="Studio navigation">
    <div className="studio-sidebar-brand-row">
      <Link href={hrefFor("/studio")} className="studio-sidebar-brand">
        <span className="studio-brand-mark" aria-hidden="true">☾</span>
        <span className="studio-brand-word">snoozer<small>STUDIO</small></span>
      </Link>
      <div className="studio-sidebar-tools">
        <button type="button" className="studio-collapse-menu" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-pressed={collapsed} onClick={() => setCollapsed((value) => !value)} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
          <span aria-hidden="true">{collapsed ? "›" : "‹"}</span>
        </button>
        <button type="button" className="studio-mobile-menu" aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={mobileOpen} onClick={() => setMobileOpen((open) => !open)}>
          {mobileOpen ? "×" : "☰"}
        </button>
      </div>
    </div>

    <label className="studio-sidebar-search">
      <span aria-hidden="true">⌕</span>
      <input type="search" value={query} onChange={(event) => setQuery(event.target.value)}
        placeholder="Search features…" aria-label="Search Studio features" />
      <kbd>Filter</kbd>
    </label>

    <nav className="studio-sidebar-nav" aria-label="Dashboard sections">
      {!hasResults && <p className="studio-search-empty">No matching features.</p>}
      {accountItems.length > 0 && <section className="studio-sidebar-group">
        <button type="button" className={"studio-sidebar-group-trigger" + (accountExpanded ? " is-open" : "")}
          aria-expanded={accountExpanded} onClick={() => setAccountExpanded((open) => !open)}>
          <span className="studio-sidebar-icon" aria-hidden="true">◉</span>
          <span className="studio-nav-copy">Account</span>
          <span className="studio-sidebar-chevron" aria-hidden="true">{accountExpanded ? "⌃" : "⌄"}</span>
        </button>
        {accountExpanded && <div className="studio-sidebar-subnav">{accountItems.map(renderLink)}</div>}
      </section>}

      {mainItems.map(renderLink)}

      {moreItems.length > 0 && <section className="studio-sidebar-group studio-sidebar-more-group">
        <button type="button" className="studio-sidebar-more-toggle" aria-expanded={showMore}
          onClick={() => setMoreExpanded((open) => !open)}>
          <span>More Snoozer tools</span><span aria-hidden="true">{showMore ? "⌃" : "⌄"}</span>
        </button>
        {showMore && <div className="studio-sidebar-more-list">{moreItems.map(renderLink)}</div>}
      </section>}
    </nav>

    <div className="studio-sidebar-footer">
      <div className="studio-help-card">
        <span className="studio-help-mark" aria-hidden="true">?</span>
        <div className="studio-nav-copy"><strong>Have a question or need support?</strong>
          <span>Guides, answers and support for Snoozer.</span></div>
        <Link href="/help" className="studio-help-action">Help Centre <span aria-hidden="true">↗</span></Link>
      </div>
      <div className="studio-sidebar-page-actions">
        <p className="studio-sidebar-group-label">Check out your page</p>
        {pageHref && pagePublished
          ? <Link className="studio-sidebar-page-button" href={pageHref} target="_blank" rel="noreferrer">
              <span aria-hidden="true">↗</span><span className="studio-nav-copy">My Page</span></Link>
          : <Link className="studio-sidebar-page-button" href={hrefFor("/studio/builder")}>
              <span aria-hidden="true">＋</span><span className="studio-nav-copy">Publish your page</span></Link>}
        {pageHref && pagePublished && <button type="button" className="studio-sidebar-share-button" onClick={shareProfile}>
          <span aria-hidden="true">⌯</span><span className="studio-nav-copy">Share Your Profile</span></button>}
        {copyMessage && <span className="studio-sidebar-copy-message" role="status">{copyMessage}</span>}
      </div>
      {accountFooter && <div className="studio-sidebar-account-footer">{accountFooter}</div>}
    </div>
  </aside>;
}
