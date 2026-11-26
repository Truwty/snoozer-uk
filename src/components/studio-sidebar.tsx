"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { StudioCommandPalette } from "@/components/studio-command-palette";
import { studioNavigationGroups } from "@/lib/studio-navigation";
import { ProfileQrShare } from "@/components/profile-qr-share";
import { accountLabel, type AccountLocale } from "@/lib/account-locale";

type Props = { pageHref?: string; pagePublished: boolean; accountFooter?: ReactNode; locale?: AccountLocale };

export function StudioSidebar({ pageHref, pagePublished, accountFooter, locale = "en-US" }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedProfile = searchParams.get("profile");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountExpanded, setAccountExpanded] = useState(true);
  const t=(key:string)=>accountLabel(locale,key);

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
  const accountItems = studioNavigationGroups[0].items;
  const mainItems = studioNavigationGroups[1].items;



  function renderLink(item: (typeof mainItems)[number] | (typeof accountItems)[number]) {
    return <Link key={item.href} href={hrefFor(item.href)} title={item.label}
      className={linkClass(item.href)} aria-current={isActive(item.href) ? "page" : undefined}
      onClick={() => setMobileOpen(false)}>
      <span className="studio-sidebar-icon" aria-hidden="true">{item.icon}</span>
      <span className="studio-nav-copy">{t(item.label)}</span>
    </Link>;
  }

  return <aside className={"studio-sidebar" + (mobileOpen ? " is-mobile-open" : "")}
    aria-label="Studio navigation">
    <div className="studio-sidebar-brand-row">
      <Link href={hrefFor("/studio")} className="studio-sidebar-brand">
        <span className="studio-brand-mark" aria-hidden="true">☾</span>
        <span className="studio-brand-word">snoozer<small>STUDIO</small></span>
      </Link>
      <button type="button" className="studio-mobile-menu" aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
        aria-expanded={mobileOpen} onClick={() => setMobileOpen((open) => !open)}>
        {mobileOpen ? "×" : "☰"}
      </button>
    </div>

    <div className="studio-sidebar-search"><StudioCommandPalette/></div>

    <nav className="studio-sidebar-nav" aria-label="Dashboard sections">
      <section className="studio-sidebar-group">
        <button type="button" className={"studio-sidebar-group-trigger" + (accountExpanded ? " is-open" : "")}
          aria-expanded={accountExpanded} onClick={() => setAccountExpanded((open) => !open)}>
          <span className="studio-sidebar-icon" aria-hidden="true">◉</span>
          <span className="studio-nav-copy">{t("Account")}</span>
          <span className="studio-sidebar-chevron" aria-hidden="true">{accountExpanded ? "⌃" : "⌄"}</span>
        </button>
        {accountExpanded && <div className="studio-sidebar-subnav">{accountItems.map(renderLink)}</div>}
      </section>
      {mainItems.map(renderLink)}
    </nav>

    <div className="studio-sidebar-footer">
      <div className="studio-help-card">
        <span className="studio-help-mark" aria-hidden="true">?</span>
        <div className="studio-nav-copy"><strong>{t("Have a question or need support?")}</strong>
          <span>{t("Guides, answers and support for Snoozer.")}</span></div>
        <Link href="/help" className="studio-help-action">{t("Help Centre")} <span aria-hidden="true">↗</span></Link>
      </div>
      <div className="studio-sidebar-page-actions">
        <p className="studio-sidebar-group-label">{t("Check out your page")}</p>
        {pageHref && pagePublished
          ? <Link className="studio-sidebar-page-button" href={pageHref} target="_blank" rel="noreferrer">
              <span aria-hidden="true">↗</span><span className="studio-nav-copy">{t("My Page")}</span></Link>
          : <Link className="studio-sidebar-page-button" href={hrefFor("/studio/customize")}>
              <span aria-hidden="true">＋</span><span className="studio-nav-copy">{t("Customise your page")}</span></Link>}
        {pageHref && pagePublished && <ProfileQrShare profilePath={pageHref}/ >}
      </div>
      {accountFooter && <div className="studio-sidebar-account-footer">{accountFooter}</div>}
    </div>
  </aside>;
}
