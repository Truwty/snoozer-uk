import Link from "next/link";
import type { ReactNode } from "react";
import { Brand } from "@/components/shell";

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return <main className="shell narrow legal-page">
    <header className="nav">
      <Brand />
      <nav className="actions" aria-label="Site">
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
        <Link href="/">Home</Link>
      </nav>
    </header>
    <article className="panel stack">
      <p className="eyebrow">SNOOZER · SITE INFORMATION</p>
      <h1>{title}</h1>
      {children}
    </article>
    <footer className="legal-footer">
      <Link href="/">Back to Snoozer</Link>
      <a href="mailto:SnoozerSupport@Snoozer.uk">Contact support</a>
    </footer>
  </main>;
}
