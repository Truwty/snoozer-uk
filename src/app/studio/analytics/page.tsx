import { AnalyticsChart } from "@/components/analytics-chart";
import { Disclosure, StatCard, TableScroll } from "@/components/ui";
import Link from "next/link";
import { dailyAnalytics, linkAnalytics, analyticsCampaigns, trafficAnalytics, browserAnalytics, browserCtr } from "@/lib/analytics";
import { AnalyticsCampaigns } from "@/components/analytics-campaigns";
import { siteUrl } from "@/lib/env";
import { readStudioDraft, studioHref, type StudioProfileQuery } from "@/lib/profiles-server";
import { sessionClient } from "@/lib/supabase";

export const metadata = { title: "Analytics", robots: { index: false, follow: false } };

export default async function Page({ searchParams }: { searchParams: Promise<StudioProfileQuery> }) {
  const draft = await readStudioDraft((await searchParams).profile);
  const client = await sessionClient();
  const [response, linksResponse, campaignResponse, trafficResponse, browserResponse] = draft ? await Promise.all([
    client.rpc("get_my_profile_view_days", { p_profile: draft.profile_id }),
    client.rpc("get_my_profile_link_totals", { p_profile: draft.profile_id }),
    client.rpc("get_my_analytics_campaigns", { p_profile: draft.profile_id }),
    client.rpc("get_my_profile_traffic_totals", { p_profile: draft.profile_id }),
    client.rpc("get_my_profile_browser_days", { p_profile: draft.profile_id }),
  ]) : [];
  const rows = dailyAnalytics.safeParse(response?.data);
  const links = linkAnalytics.safeParse(linksResponse?.data);
  const campaigns = analyticsCampaigns.safeParse(campaignResponse?.data);
  const traffic = trafficAnalytics.safeParse(trafficResponse?.data);
  const browsers = browserAnalytics.safeParse(browserResponse?.data);

  return <main className="shell analytics-shell">
    <header className="nav studio-subnav"><Link className="button small" href={studioHref("/studio", draft?.profile_id)}>Back to Studio</Link></header>
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
          <StatCard label="Recorded views" value={rows.data.reduce((sum, row) => sum + row.views, 0).toLocaleString("en-GB")} />
          <StatCard label="Recorded link clicks" value={rows.data.reduce((sum, row) => sum + row.clicks, 0).toLocaleString("en-GB")} />
          <StatCard label="Browser-day CTR" value={browsers.success ? browserCtr(browsers.data.reduce((sum, row) => sum + row.unique_browsers, 0), browsers.data.reduce((sum, row) => sum + row.clicked_browsers, 0)) : "—"}
            description="Weighted across recorded UTC days; not unique people." />
        </div>
        <details className="muted"><summary>How counts work</summary><p>These are event counts, not unique people. Reloads may count again. Known bots are filtered, but automation can still inflate counts. Counts stop at 10,000 views and 10,000 clicks per profile per UTC day.</p></details>
        <header className="section-header"><h2>Daily activity</h2><a className="button small" download="snoozer-analytics.csv" href={studioHref("/api/v1/analytics/export", draft?.profile_id)}>Download CSV</a></header>
        <AnalyticsChart rows={rows.data} />
        <Disclosure title="Daily activity table"><TableScroll label="Daily activity report">
        <table>
          <caption>Recorded activity by UTC day within your plan’s retention window</caption>
          <thead><tr><th scope="col">Date</th><th scope="col">Views</th><th scope="col">Clicks</th></tr></thead>
          <tbody>{rows.data.map(({ day, views, clicks }) => <tr key={day}><th scope="row"><time dateTime={day}>{day}</time></th><td>{views}</td><td>{clicks}</td></tr>)}</tbody>
        </table>
        </TableScroll></Disclosure>
      </>)}
      {draft && (browserResponse?.error || !browsers.success) && <p role="alert">Daily browser reports are unavailable. Please try again later.</p>}
      {browsers.success && browsers.data.length > 0 && <>
        <header className="section-header"><h2>Daily browsers and click-through rate</h2><a className="button small" download="snoozer-browser-analytics.csv" href={studioHref("/api/v1/analytics/export?breakdown=browsers", draft?.profile_id)}>Download browser CSV</a></header>
        <Disclosure title="How daily browser counts work"><p className="muted">Only visitors who allowed the latest analytics scope and have writable browser storage are included here. A browser counts once per profile and UTC day; browsers with at least one recorded view and link click count as clicked browsers. CTR is clicked browsers divided by daily browsers. These are approximate browser counts, not people. Clearing storage or withdrawing and allowing again can count a browser again. Counts before this feature are zero. Daily counts must not be added together as unique visitors across days.</p></Disclosure>

        <TableScroll label="Daily browser report">
          <table>
            <caption>Daily browser observations within your plan’s retention window</caption>
            <thead><tr><th scope="col">UTC date</th><th scope="col">Daily browsers</th><th scope="col">Clicked browsers</th><th scope="col">Browser CTR</th></tr></thead>
            <tbody>{browsers.data.map((row) => <tr key={row.day}><th scope="row">{row.day}</th><td>{row.unique_browsers}</td><td>{row.clicked_browsers}</td><td>{browserCtr(row.unique_browsers, row.clicked_browsers)}</td></tr>)}</tbody>
          </table>
        </TableScroll>
      </>}
      {draft && (linksResponse?.error || !links.success) && <p role="alert">Per-link analytics are unavailable. Please try again later.</p>}
      {links.success && links.data.length > 0 && <>
        <header className="section-header"><h2>Most clicked links</h2><a className="button small" download="snoozer-link-analytics.csv" href={studioHref("/api/v1/analytics/export?breakdown=links", draft?.profile_id)}>Download link CSV</a></header>
        <p className="muted">Top 100 published label and destination pairs within your retention window. Counts started when per-link reporting was enabled; earlier clicks appear only in the daily totals.</p>

        <TableScroll label="Per-link report"><table className="analytics-links">
          <caption>Clicks attributed to published destinations</caption>
          <thead><tr><th scope="col">Link</th><th scope="col">Clicks</th></tr></thead>
          <tbody>{links.data.map(({ label, url, clicks }) => <tr key={JSON.stringify([label, url])}>
            <th scope="row"><a href={url} rel="nofollow noreferrer">{label}</a><small>{url}</small></th><td>{clicks}</td>
          </tr>)}</tbody>
        </table></TableScroll>
      </>}
      {draft && (trafficResponse?.error || !traffic.success) && <p role="alert">Traffic reports are unavailable. Please try again later.</p>}
      {traffic.success && traffic.data.length > 0 && <>
        <header className="section-header"><h2>Traffic sources and campaigns</h2><a className="button small" download="snoozer-traffic-analytics.csv" href={studioHref("/api/v1/analytics/export?breakdown=traffic", draft?.profile_id)}>Download traffic CSV</a></header>
        <p className="muted">Descriptive comparisons over the same retention window. Source and device groups are approximate; missing referrers appear as direct traffic. No visitor identities or statistical significance are inferred. Up to 1,000 groups are shown.</p>

        <TableScroll label="Traffic source report">
          <table>
            <caption>Campaign, source and device event totals</caption>
            <thead><tr><th scope="col">Campaign</th><th scope="col">Source</th><th scope="col">Device</th><th scope="col">Views</th><th scope="col">Clicks</th></tr></thead>
            <tbody>{traffic.data.map((row) => <tr key={JSON.stringify([row.campaign, row.source, row.device])}>
              <th scope="row">{row.label}</th><td>{row.source}</td><td>{row.device}</td><td>{row.views}</td><td>{row.clicks}</td>
            </tr>)}</tbody>
          </table>
        </TableScroll>
      </>}
    </section>
  </main>;
}
