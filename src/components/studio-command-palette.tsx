"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { studioNavigationGroups } from "@/lib/studio-navigation";

const accountActions = [
  { label:"Change display name", href:"/studio/builder", icon:"✎", keywords:"profile name edit", description:"Change the display name shown on your profile.", group:"Profile" },
  { label:"Open Alias Manager", href:"/studio/account#account-aliases", icon:"⌁", keywords:"alias manager username alternate names", description:"Manage alternate profile aliases.", group:"Account" },
  { label:"Email", href:"/studio/account#account-email", icon:"✉", keywords:"email address change mail", description:"View or change your account email.", group:"Account" },
  { label:"Multi-factor authentication", href:"/studio/account#account-mfa", icon:"◇", keywords:"MFA authenticator two factor security", description:"Enable or disable multi-factor authentication.", group:"Security Settings" },
  { label:"Session Management", href:"/studio/account#account-sessions", icon:"▣", keywords:"devices sign out revoke sessions security", description:"Review active sessions and invalidate devices you do not recognise.", group:"Security Settings" },
  { label:"Login with Google", href:"/studio/account#account-google", icon:"G", keywords:"connect link unlink identity provider", description:"Control whether Google can be used to log in.", group:"Connections" },
  { label:"Login with Discord", href:"/studio/account#account-discord", icon:"◉", keywords:"connect link unlink identity provider discord", description:"Control whether Discord can be used to log in.", group:"Connections" },
  { label:"Email Marketing", href:"/studio/account#account-email-marketing", icon:"✉", keywords:"marketing newsletter product updates preference", description:"Manage product updates and email preferences.", group:"Email Marketing" },
] as const;

export function StudioCommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const profile = searchParams.get("profile");
  function closePalette() {
    setOpen(false);
    setQuery("");
    setActive(0);
  }
  const items = useMemo(() => {
    const words = query.trim().toLocaleLowerCase("en-GB").split(/\s+/).filter(Boolean);
    const destinations=studioNavigationGroups.flatMap((group) => group.items.map((item) => ({ ...item, group: group.label })));
    return [...destinations,...accountActions]
      .filter((item) => {
        const content = `${item.label} ${item.href} ${item.keywords} ${item.group}`.toLocaleLowerCase("en-GB");
        return words.every((word) => content.includes(word));
      });
  }, [query]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (!open) returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        if (open) closePalette();
        else { setQuery(""); setActive(0); setOpen(true); }
      } else if (event.key === "Escape" && open) {
        event.preventDefault();
        closePalette();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    if (!open) {
      (returnFocusRef.current?.isConnected ? returnFocusRef.current : document.querySelector<HTMLElement>(".studio-command-trigger"))?.focus();
      return;
    }
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  function onDialogKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowDown" && items.length) {
      event.preventDefault(); setActive((value) => (value + 1) % items.length);
    } else if (event.key === "ArrowUp" && items.length) {
      event.preventDefault(); setActive((value) => (value - 1 + items.length) % items.length);
    } else if (event.key === "Tab" && dialogRef.current) {
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>('input, button, a[href]')]
        .filter((element) => !element.hasAttribute("disabled"));
      if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  }

  const hrefFor = (href: string) => {
    if(!profile||!href.startsWith("/studio"))return href;
    const hashIndex=href.indexOf("#");
    const base=hashIndex>=0?href.slice(0,hashIndex):href;
    const hash=hashIndex>=0?href.slice(hashIndex):"";
    const query=base.includes("?")?"&":"?";
    return `${base}${query}profile=${encodeURIComponent(profile)}${hash}`;
  };

  if (!open) return <button type="button" className="studio-command-trigger" onClick={() => {
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setOpen(true);
  }} title="Search Studio (Ctrl K)"><span aria-hidden="true">⌕</span> <span>Search Studio</span><kbd>Ctrl K</kbd></button>;

  return <div className="studio-command-backdrop" onMouseDown={(event) => {
    if (event.target === event.currentTarget) closePalette();
  }}>
    <div ref={dialogRef} className="studio-command-dialog" role="dialog" aria-modal="true" aria-labelledby="studio-command-title" onKeyDown={onDialogKeyDown}>
      <h2 id="studio-command-title" className="sr-only">Search Studio</h2>
      <label className="studio-command-search"><span aria-hidden="true">⌕</span>
        <input ref={inputRef} value={query} onChange={(event) => { setQuery(event.target.value); setActive(0); }} placeholder="Search features, pages, and actions…" aria-label="Search Studio features, pages, and actions" aria-controls="studio-command-results" aria-activedescendant={items[active] ? `studio-command-${active}` : undefined}
          onKeyDown={(event) => { if (event.key === "Enter" && items[active]) (document.getElementById(`studio-command-${active}`) as HTMLAnchorElement | null)?.click(); }}/>
        <button type="button" onClick={closePalette} aria-label="Close search">Esc</button>
      </label>
      <div id="studio-command-results" className="studio-command-results" role="listbox" aria-label="Studio pages">
        {items.length ? items.map((item, index) => <Link id={`studio-command-${index}`} key={item.href} href={hrefFor(item.href)} role="option" aria-selected={index === active} className={"studio-command-result" + (index === active ? " is-active" : "")}
          onMouseEnter={() => setActive(index)} onClick={closePalette}>
          <span className="studio-command-icon" aria-hidden="true">{item.icon}</span><span><strong>{item.label}</strong><small>{"description" in item ? item.description : `${item.group} · ${item.href === pathname ? "Current page" : item.href}`}</small></span><kbd>↵</kbd>
        </Link>) : <p className="studio-command-empty">No matching Studio pages.</p>}
      </div>
      <footer><span>Navigate <kbd>↑</kbd><kbd>↓</kbd></span><span>Open <kbd>↵</kbd></span><span>Close <kbd>Esc</kbd></span></footer>
    </div>
  </div>;
}
