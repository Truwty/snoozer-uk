import Link from "next/link";
import type { ReactNode } from "react";

export function Brand() {
  return <Link className="brand" href="/" aria-label="snoozer.uk home"><svg className="brand-mark" viewBox="0 0 64 64" aria-hidden="true" focusable="false"><rect width="64" height="64" rx="17" fill="#d8fb86"/><path d="M19 21C10 26 9 37 12 45c3 8 11 12 20 10 7-2 12-7 14-14-5 4-13 4-19 0s-9-12-8-20Z" fill="#15121b"/><circle cx="43" cy="22" r="4" fill="#15121b"/></svg><span>snoozer<span className="brand-domain">.uk</span></span></Link>;
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
