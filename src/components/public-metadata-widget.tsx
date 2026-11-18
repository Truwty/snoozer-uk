"use client";

import { Disclosure } from "./ui";
import { useEffect, useState } from "react";
import { widgetMetadata, type MetadataProvider, type WidgetMetadata } from "@/lib/widgets";

export function PublicMetadataWidget({ username, position, provider, resource }: {
  username: string; position: number; provider: MetadataProvider; resource: string;
}) {
  const [visible, setVisible] = useState(false);
  const [result, setResult] = useState<WidgetMetadata | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const name = provider === "github" ? "GitHub" : "Discord";
  useEffect(() => {
    if (!visible) return;
    const controller = new AbortController();
    void fetch("/api/v1/widgets/public", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, position, provider, consent: true }),
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
    }).then(async (response) => {
      if (!response.ok) throw new Error("Provider unavailable.");
      const parsed = widgetMetadata.parse(await response.json());
      if (parsed.provider !== provider || parsed.resource !== resource) throw new Error("Link changed.");
      if (!controller.signal.aborted) setResult(parsed);
    }).catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [visible, username, position, provider, resource, attempt]);

  function toggle() {
    setVisible(!visible); setResult(null); setFailed(false);
  }
  return <div className="public-widget">
    <p className="muted">Optional public summary · requested through Snoozer.</p>
    <Disclosure title="Learn more about public summaries"><p className="muted">Optional {name} summary. Load requests cached public information through Snoozer; your browser does not contact {name} directly. This choice is separate from profile analytics.</p></Disclosure>
    <button className="button small" type="button" aria-expanded={visible} onClick={toggle}>
      {visible ? `Hide ${name} summary` : `Load ${name} summary`}
    </button>
    {visible && !result && !failed && <p role="status">Loading public summary…</p>}
    {visible && failed && <div className="stack">
      <p role="status">Summary unavailable or temporarily rate limited. Use the original link above, or try again later.</p>
      <button className="button small" type="button" onClick={() => { setFailed(false); setAttempt(attempt + 1); }}>Try summary again</button>
    </div>}
    {visible && result && <div className="provider-summary">
      <p><strong>{result.title}</strong></p>
      {result.description && <p>{result.description}</p>}
      <dl>{result.stats.map((stat) => <div key={stat.label}><dt>{stat.label}</dt><dd>{stat.value.toLocaleString("en-GB")}</dd></div>)}</dl>
      {provider === "discord" && <p className="muted">Discord member and online counts are approximate.</p>}
      <p className="muted">Public snapshot as of <time dateTime={result.fetchedAt}>{new Date(result.fetchedAt).toLocaleString("en-GB", { timeZone: "UTC" })} UTC</time>. Counts may lag provider changes by up to an hour.</p>
    </div>}
  </div>;
}
