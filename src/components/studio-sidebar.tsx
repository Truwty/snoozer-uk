"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { filterStudioNavigation } from "@/lib/studio-navigation";

type Props = { pageHref?: string; pagePublished: boolean; accountFooter?: ReactNode };

export function StudioSidebar({ pageHref, pagePublished, accountFooter }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedProfile = searchParams.get("profile");
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [accountExpanded, setAccountExpanded] = useState(true);
  const [copyMessage, setCopyMessage] = useState("");
  const groups = useMemo(() => filterStudioNavigation(query), [query]);
  const accountGroup = groups.find((group) => group.label === "Account");
  const otherGroups = groups.filter((group) => group.label !== "Account");
  const hasResults = Boolean(accountGroup?.items.length || otherGroups.some((group) => group.items.length));

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCollapsed(false);
        setMobileOpen(true);
        window.requestAnimationFrame(() => searchRef.current?.focus());
      }
      if (event.key === "Escape") {
        setMobileOpen(false);
        searchRef.current?.blur();
      }
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

  async function shareProfile() {
    if (!pageHref) return;
    try {
      await navigator.clipboard.writeText(new URL(pageHref, window.location.origin).href);
      setCopyMessage("Profile link copied.");
    } catch {
      setCopyMessage("Couldn’t copy the link. Open My Page and copy its address.");
    }
  }

  const linkClass = (href: string) => "studio-sidebar-link" + (isActive(href) ? " is-active" : "");
  const accountItems = accountGroup?.items ?? [];

  return <aside className={"studio-sidebar" + (mobileOpen ? " is-mobile-open" : "") + (collapsed ? " is-collapsed" : "")}
    aria-label="Studio navigation">
    <div className="studio-sidebar-brand-row">
      <Link href={hrefFor("/studio")} className="studio-sidebar-brand" aria-label="Snoozer Studio home">
        <span className="studio-brand-mark" aria-hidden="true">S</span>
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
      <input ref={searchRef} type="search" value={query} onChange={(event) => setQuery(event.target.value)}
        placeholder="Search features…" aria-label="Search Studio features" />
      <kbd>⌘ K</kbd>
    </label>

    <nav className="studio-sidebar-nav" aria-label="Dashboard sections">
      {!hasResults && <p className="studio-search-empty">No matching features.</p>}
      {accountItems.length > 0 && <section className="studio-sidebar-group">
        <button type="button" className={"studio-sidebar-group-trigger" + (accountExpanded ? " is-open" : "")}
          aria-expanded={accountExpanded} onClick={() => setAccountExpanded((open) => !open)}>
          <span className="studio-sidebar-icon" aria-hidden="true">◉</span>
          <span className="studio-nav-copy">Account</span>
          <span className="studio-sidebar-chevron" aria-hidden="true">{accountExpanded ? "⌄" : "›"}</span>
        </button>
        {accountExpanded && <div className="studio-sidebar-subnav">
          {accountItems.map((item) => <Link key={item.href} href={hrefFor(item.href)} title={item.label}
            className={linkClass(item.href)} aria-current={isActive(item.href) ? "page" : undefined}
            onClick={() => setMobileOpen(false)}>
            <span className="studio-sidebar-icon" aria-hidden="true">{item.icon}</span>
            <span className="studio-nav-copy">{item.label}</span>
          </Link>)}
        </div>}
      </section>}

      {otherGroups.map((group) => <section className="studio-sidebar-group" key={group.label}>
        <p className="studio-sidebar-group-label">{group.label}</p>
        {group.items.map((item) => <Link key={item.href} href={hrefFor(item.href)} title={item.label}
          className={linkClass(item.href)} aria-current={isActive(item.href) ? "page" : undefined}
          onClick={() => setMobileOpen(false)}>
          <span className="studio-sidebar-icon" aria-hidden="true">{item.icon}</span>
          <span className="studio-nav-copy">{item.label}</span>
        </Link>)}
      </section>)}
    </nav>

    <div className="studio-sidebar-footer">
      <div className="studio-help-card">
        <span className="studio-help-mark" aria-hidden="true">?</span>
        <div className="studio-nav-copy">
          <strong>Need a hand?</strong>
          <span>Guides, answers and support for Snoozer.</span>
        </div>
        <Link href="/help" className="studio-help-action">Help Centre <span aria-hidden="true">↗</span></Link>
      </div>
      <div className="studio-sidebar-page-actions">
        <p className="studio-sidebar-group-label">Check out your page</p>
        {pageHref && pagePublished
          ? <Link className="studio-sidebar-page-button" href={pageHref} target="_blank" rel="noreferrer">
              <span aria-hidden="true">↗</span><span className="studio-nav-copy">My Page</span>
            </Link>
          : <Link className="studio-sidebar-page-button" href={hrefFor("/studio/builder")}>
              <span aria-hidden="true">＋</span><span className="studio-nav-copy">Publish your page</span>
            </Link>}
        {pageHref && pagePublished && <button type="button" className="studio-sidebar-share-button" onClick={shareProfile}>
          <span aria-hidden="true">⌯</span><span className="studio-nav-copy">Share Your Profile</span>
        </button>}
        {copyMessage && <span className="studio-sidebar-copy-message" role="status">{copyMessage}</span>}
      </div>
      {accountFooter && <div className="studio-sidebar-account-footer">{accountFooter}</div>}
    </div>
  </aside>;
}
