"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { filterStudioNavigation } from "@/lib/studio-navigation";

export function StudioSidebar() {
  const pathname = usePathname();
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const groups = useMemo(() => filterStudioNavigation(query), [query]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
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

  return <aside className={"studio-sidebar" + (mobileOpen ? " is-mobile-open" : "")} aria-label="Studio navigation">
    <div className="studio-sidebar-brand-row">
      <Link href="/studio" className="studio-sidebar-brand" aria-label="Snoozer Studio home">
        <span className="studio-brand-mark" aria-hidden="true">S</span>
        <span className="studio-brand-word">snoozer<small>STUDIO</small></span>
      </Link>
      <button type="button" className="studio-mobile-menu" aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
        aria-expanded={mobileOpen} onClick={() => setMobileOpen((open) => !open)}>
        {mobileOpen ? "×" : "☰"}
      </button>
    </div>
    <label className="studio-sidebar-search">
      <span aria-hidden="true">⌕</span>
      <input ref={searchRef} type="search" value={query} onChange={(event) => setQuery(event.target.value)}
        placeholder="Search features…" aria-label="Search Studio features" />
      <kbd>Ctrl K</kbd>
    </label>
    <nav className="studio-sidebar-nav">
      {groups.length === 0 ? <p className="studio-search-empty">No matching features.</p> : groups.map((group) => <section className="studio-sidebar-group" key={group.label}>
        <p className="studio-sidebar-group-label">{group.label}</p>
        {group.items.map((item) => {
          const active = item.href === "/studio" ? pathname === "/studio"
            : pathname === item.href || pathname.startsWith(item.href + "/");
          return <Link key={item.href} href={item.href} className={"studio-sidebar-link" + (active ? " is-active" : "")}
            aria-current={active ? "page" : undefined} onClick={() => setMobileOpen(false)}>
            <span className="studio-sidebar-icon" aria-hidden="true">{item.icon}</span>
            <span>{item.label}</span>
          </Link>;
        })}
      </section>)}
    </nav>
    <div className="studio-sidebar-footer">
      <div className="studio-help-card">
        <strong>Need a hand?</strong>
        <span>Browse guides and answers in the Help Centre.</span>
        <Link href="/help">Open Help Centre ↗</Link>
      </div>
      <Link className="studio-sidebar-site-link" href="/">← Snoozer home</Link>
    </div>
  </aside>;
}
