import Link from "next/link";
import { dailyAnalytics, linkAnalytics, analyticsCampaigns, trafficAnalytics } from "@/lib/analytics";
import { AnalyticsCampaigns } from "@/components/analytics-campaigns";
import { siteUrl } from "@/lib/env";
import { Brand } from "@/components/shell";
import { readStudioDraft, studioHref, type StudioProfileQuery } from "@/lib/profiles-server";
import { sessionClient } from "@/lib/supabase";

export const metadata = { title: "Analytics", robots: { index: false, follow: false } };

export default async function Page({ searchParams }: { searchParams: Promise<StudioProfileQuery> }) {
  const draft = await readStudioDraft((await searchParams).profile);
  const client = await sessionClient();
  const [response, linksResponse, campaignResponse, trafficResponse] = draft ? await Promise.all([
    client.rpc("get_my_profile_view_days", { p_profile: draft.profile_id }),
    client.rpc("get_my_profile_link_totals", { p_profile: draft.profile_id }),
    client.rpc("get_my_analytics_campaigns", { p_profile: draft.profile_id }),
    client.rpc("get_my_profile_traffic_totals", { p_profile: draft.profile_id }),
  ]) : [];
  const rows = dailyAnalytics.safeParse(response?.data);
  const links = linkAnalytics.safeParse(linksResponse?.data);
  const campaigns = analyticsCampaigns.safeParse(campaignResponse?.data);
  const traffic = trafficAnalytics.safeParse(trafficResponse?.data);
  const peak = rows.success ? Math.max(1, ...rows.data.map((row) => Math.max(row.views, row.clicks))) : 1;
  return <main className="shell narrow">
    <header className="nav"><Brand /><Link className="button small" href={studioHref("/studio", draft?.profile_id)}>Back to Studio</Link></header>
    <section className="panel stack">
      <h1>Profile analytics</h1>
      {draft ? <p className="muted">@{draft.username} · Views and clicks from visitors who allowed analytics. Dates are UTC. Signed-in owner visits are excluded.</p>
        : <p>Claim a profile in Studio to see analytics.</p>}
      {draft && (response?.error || !rows.success) && <p role="alert">Analytics are unavailable. Please try again later.</p>}
      {draft && campaigns.success && !campaignResponse?.error &&
        <AnalyticsCampaigns campaigns={campaigns.data} profile={draft.profile_id} pageUrl={new URL("/" + draft.username, siteUrl()).href} />}
      {draft && (campaignResponse?.error || !campaigns.success) && <p role="alert">Campaign links are unavailable. Please try again later.</p>}
      {rows.success && (rows.data.length === 0 ? <p>No recorded views yet.</p> : <>
        <div className="analytics-summary">
          <p><strong>{rows.data.reduce((sum, row) => sum + row.views, 0).toLocaleString("en-GB")}</strong><span>recorded views</span></p>
          <p><strong>{rows.data.reduce((sum, row) => sum + row.clicks, 0).toLocaleString("en-GB")}</strong><span>recorded link clicks</span></p>
        </div>
        <details className="muted"><summary>How counts work</summary><p>These are event counts, not unique people. Reloads may count again. Known bots are filtered, but automation can still inflate counts. Counts stop at 10,000 views and 10,000 clicks per profile per UTC day.</p></details>
        <a className="button small" download="snoozer-analytics.csv" href={studioHref("/api/v1/analytics/export", draft?.profile_id)}>Download CSV</a>
        <div className="analytics-chart" role="img" aria-label="Daily views and link clicks. Exact values follow in the table.">
          {[...rows.data].reverse().map(({ day, views, clicks }) => <div className="analytics-chart-day" key={day}>
            <span className="analytics-bar views" style={{ height: `${views / peak * 100}%` }} />
            <span className="analytics-bar clicks" style={{ height: `${clicks / peak * 100}%` }} />
          </div>)}
        </div>
        <p className="muted">Daily activity, oldest to newest. Silver: views · green: clicks. Days without recorded activity are omitted. The table contains the exact UTC dates.</p>
        <table>
          <caption>Recorded activity by UTC day within your plan’s retention window</caption>
          <thead><tr><th scope="col">Date</th><th scope="col">Views</th><th scope="col">Clicks</th></tr></thead>
          <tbody>{rows.data.map(({ day, views, clicks }) => <tr key={day}><th scope="row"><time dateTime={day}>{day}</time></th><td>{views}</td><td>{clicks}</td></tr>)}</tbody>
        </table>
      </>)}
      {draft && (linksResponse?.error || !links.success) && <p role="alert">Per-link analytics are unavailable. Please try again later.</p>}
      {links.success && links.data.length > 0 && <>
        <h2>Most clicked links</h2>
        <p className="muted">Top 100 published label and destination pairs within your retention window. Counts started when per-link reporting was enabled; earlier clicks appear only in the daily totals.</p>
        <a className="button small" download="snoozer-link-analytics.csv" href={studioHref("/api/v1/analytics/export?breakdown=links", draft?.profile_id)}>Download link CSV</a>
        <table className="analytics-links">
          <caption>Clicks attributed to published destinations</caption>
          <thead><tr><th scope="col">Link</th><th scope="col">Clicks</th></tr></thead>
          <tbody>{links.data.map(({ label, url, clicks }) => <tr key={JSON.stringify([label, url])}>
            <th scope="row"><a href={url} rel="nofollow noreferrer">{label}</a><small>{url}</small></th><td>{clicks}</td>
          </tr>)}</tbody>
        </table>
      </>}
      {draft && (trafficResponse?.error || !traffic.success) && <p role="alert">Traffic reports are unavailable. Please try again later.</p>}
      {traffic.success && traffic.data.length > 0 && <>
        <h2>Traffic sources and campaigns</h2>
        <p className="muted">Descriptive comparisons over the same retention window. Source and device groups are approximate; missing referrers appear as direct traffic. No visitor identities or statistical significance are inferred. Up to 1,000 groups are shown.</p>
        <a className="button small" download="snoozer-traffic-analytics.csv" href={studioHref("/api/v1/analytics/export?breakdown=traffic", draft?.profile_id)}>Download traffic CSV</a>
        <div className="analytics-context-wrap" role="region" aria-label="Traffic source report" tabIndex={0}>
          <table>
            <caption>Campaign, source and device event totals</caption>
            <thead><tr><th scope="col">Campaign</th><th scope="col">Source</th><th scope="col">Device</th><th scope="col">Views</th><th scope="col">Clicks</th></tr></thead>
            <tbody>{traffic.data.map((row) => <tr key={JSON.stringify([row.campaign, row.source, row.device])}>
              <th scope="row">{row.label}</th><td>{row.source}</td><td>{row.device}</td><td>{row.views}</td><td>{row.clicks}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </>}
    </section>
  </main>;
}
