"use client";

import { useEffect, useId, useRef } from "react";

type HelpSearchProps = {
  initialQuery?: string;
  size?: "large" | "compact";
};

export function HelpSearch({ initialQuery = "", size = "compact" }: HelpSearchProps) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function focusHelpSearch(event: KeyboardEvent) {
      const isShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k";
      if (!isShortcut) return;
      event.preventDefault();
      inputRef.current?.focus();
      inputRef.current?.select();
    }
    window.addEventListener("keydown", focusHelpSearch);
    return () => window.removeEventListener("keydown", focusHelpSearch);
  }, []);

  return (
    <form action="/help" method="get" role="search" className={`hc-search hc-search-${size}`}>
      <label htmlFor={id} className="sr-only">Search documentation</label>
      <span className="hc-search-icon" aria-hidden="true">⌕</span>
      <input
        ref={inputRef}
        id={id}
        name="q"
        type="search"
        aria-label="Search documentation"
        aria-keyshortcuts="Control+K Meta+K"
        placeholder="Search guides, articles and answers…"
        defaultValue={initialQuery}
        maxLength={100}
        autoComplete="off"
      />
      <kbd aria-hidden="true">Ctrl K</kbd>
      <button type="submit">Search</button>
    </form>
  );
}
