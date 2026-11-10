import Link from "next/link";
import type { ReactNode } from "react";

export function Brand() {
  return <Link className="brand" href="/" aria-label="snoozer.uk home"><span className="brand-mark" aria-hidden="true">◒</span><span>snoozer<span className="brand-domain">.uk</span></span></Link>;
}

export function AuthShell({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <main className="shell narrow">
    <Brand />
    <section className="panel auth-panel">
      <p className="eyebrow">SNOOZER ACCOUNT</p>
      <h1>{title}</h1>
      <p className="muted">{description}</p>
      {children}
    </section>
  </main>;
}
