"use client";

import { useActionState, useState } from "react";
import { createCampaign, setCampaignActive } from "@/app/studio/analytics/actions";
import { initialState } from "@/lib/actions";

type Campaign = { id: string; label: string; active: boolean };

function CampaignRow({ campaign, profile, pageUrl }: { campaign: Campaign; profile: string; pageUrl: string }) {
  const [state, action, pending] = useActionState(setCampaignActive, initialState);
  const url = new URL(pageUrl);
  url.searchParams.set("utm_campaign", campaign.id);
  return <li className="stack">
    <p><strong>{campaign.label}</strong> · {campaign.active ? "Active" : "Paused"}</p>
    <label>Campaign link: {campaign.label}<input type="url" readOnly value={url.href} onFocus={(event) => event.target.select()} /></label>
    <a href={url.href}>Open campaign link</a>
    <form action={action}>
      <input type="hidden" name="profile" value={profile} />
      <input type="hidden" name="campaign" value={campaign.id} />
      <input type="hidden" name="active" value={String(!campaign.active)} />
      <button className="button small" disabled={pending}>{pending ? "Updating…" : campaign.active ? "Pause campaign" : "Resume campaign"}</button>
    </form>
    <p className="message" role={state.status === "error" ? "alert" : "status"}>{state.message}</p>
  </li>;
}

export function AnalyticsCampaigns({ campaigns, profile, pageUrl }: { campaigns: Campaign[]; profile: string; pageUrl: string }) {
  const [state, action, pending] = useActionState(createCampaign, initialState);
  const [label, setLabel] = useState("");
  return <details className="stack">
    <summary>Campaign links ({campaigns.length}/20)</summary>
    <p className="muted">Create an address for a newsletter or launch. Only consenting visitor events count. Pausing stops new campaign attribution; the page and older totals remain available. Campaign names stay in your Studio.</p>
    <form className="stack" action={action}>
      <input type="hidden" name="profile" value={profile} />
      <label>Campaign name<input name="label" required maxLength={80} value={label} onChange={(event) => setLabel(event.target.value)} /></label>
      <button className="button small" disabled={pending || campaigns.length >= 20}>{pending ? "Creating…" : "Create campaign link"}</button>
      <p className="message" role={state.status === "error" ? "alert" : "status"}>{state.message}</p>
    </form>
    {campaigns.length > 0 && <ul className="stack">{campaigns.map((campaign) =>
      <CampaignRow key={campaign.id} campaign={campaign} profile={profile} pageUrl={pageUrl} />)}</ul>}
  </details>;
}
