import Link from "next/link";
import { AnalyticsChart } from "@/components/analytics-chart";
import { AnalyticsCampaigns } from "@/components/analytics-campaigns";
import { TableScroll, Disclosure } from "@/components/ui";
import {
  dailyAnalytics, linkAnalytics, analyticsCampaigns, trafficAnalytics,
  browserAnalytics, browserCtr,
} from "@/lib/analytics";
import { siteUrl } from "@/lib/env";
import { readStudioDraft, type StudioProfileQuery } from "@/lib/profiles-server";
import { sessionClient } from "@/lib/supabase";

export const metadata = { title: "Analytics", robots: { index: false, follow: false } };

type Range = "7d" | "30d" | "all";
type Query = StudioProfileQuery & { range?: string | string[] };

function selectedRange(value: Query["range"]): Range {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate === "7d" || candidate === "30d" || candidate === "all" ? candidate : "7d";
}

function inRange<T extends { day: string }>(rows: T[], range: Range) {
  if (range === "all" || rows.length === 0) return rows;
  const today = new Date();
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - (range === "7d" ? 6 : 29)));
  const startDay = start.toISOString().slice(0, 10);
  return rows.filter((row) => row.day >= startDay);
}

function compact(value: number) {
  return value.toLocaleString("en-GB");
}

function Empty({ title, description }: { title: string; description: string }) {
  return <div className="analytics-empty"><strong>{title}</strong><span>{description}</span></div>;
}

export default async function Page({ searchParams }: { searchParams: Promise<Query> }) {
  const params = await searchParams;
  const range = selectedRange(params.range);
  const draft = await readStudioDraft(params.profile);
  const client = await sessionClient();

  const [response, linksResponse, campaignResponse, trafficResponse, browserResponse] = draft
    ? await Promise.all([
      client.rpc("get_my_profile_view_days", { p_profile: draft.profile_id }),
      client.rpc("get_my_profile_link_totals", { p_profile: draft.profile_id }),
      client.rpc("get_my_analytics_campaigns", { p_profile: draft.profile_id }),
      client.rpc("get_my_profile_traffic_totals", { p_profile: draft.profile_id }),
      client.rpc("get_my_profile_browser_days", { p_profile: draft.profile_id }),
    ])
    : [];

  const allRows = dailyAnalytics.safeParse(response?.data);
  const allLinks = linkAnalytics.safeParse(linksResponse?.data);
  const campaigns = analyticsCampaigns.safeParse(campaignResponse?.data);
  const allTraffic = trafficAnalytics.safeParse(trafficResponse?.data);
  const allBrowsers = browserAnalytics.safeParse(browserResponse?.data);

  const rows = allRows.success ? [...inRange(allRows.data, range)].sort((a, b) => a.day.localeCompare(b.day)) : [];
  const links = allLinks.success ? allLinks.data : [];
  const traffic = allTraffic.success ? allTraffic.data : [];
  const browsers = allBrowsers.success ? inRange(allBrowsers.data, range) : [];
  const views = rows.reduce((sum, row) => sum + row.views, 0);
  const clicks = rows.reduce((sum, row) => sum + row.clicks, 0);
  const average = rows.length ? Math.round(views / rows.length) : 0;
  const browserTotal = browsers.reduce((sum, row) => sum + row.unique_browsers, 0);
  const browserClicked = browsers.reduce((sum, row) => sum + row.clicked_browsers, 0);
  const rangeLabel = range === "7d" ? "Last 7 days" : range === "30d" ? "Last 30 days" : "All available time";
  const periodHint = range === "all" ? "Within your plan’s analytics retention window" : "In the " + rangeLabel.toLowerCase();

  // The traffic and per-link RPCs currently return retention-window aggregates,
  // not dated daily rows. Keep them truthful and label their wider time window.
  const devices = traffic.reduce<Record<string, number>>((result, row) => {
    result[row.device] = (result[row.device] ?? 0) + row.views;
    return result;
  }, {});
  const deviceTotal = Object.values(devices).reduce((sum, count) => sum + count, 0);
  const deviceRows = Object.entries(devices).sort((a, b) => b[1] - a[1]);
  const topLinks = [...links].sort((a, b) => b.clicks - a.clicks).slice(0, 6);
  const sources = traffic.reduce<Record<string, number>>((result, row) => {
    result[row.source] = (result[row.source] ?? 0) + row.views;
    return result;
  }, {});
  const topSources = Object.entries(sources).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return <main className="shell studio-shell analytics-page">
    <header className="studio-page-heading">
      <div><p className="eyebrow">ACCOUNT / ANALYTICS</p><h1>Account Analytics</h1>
        <p className="muted">Track profile views, link activity and broad sources sending visitors to your page.</p></div>
      {draft && <Link className="button small" href={"/" + draft.username} target="_blank" rel="noreferrer">View My Page ↗</Link>}
    </header>

    {!draft ? <section className="studio-dashboard-panel stack">
      <h2>Your profile is not ready yet</h2><p className="muted">Claim a Snoozer profile to start seeing consent-based activity reports.</p>
      <Link className="button primary" href="/studio">Claim a profile</Link>
    </section> : <>
      <section className="analytics-range-bar" aria-label="Analytics time range">
        <form action="/studio/analytics" method="get">
          <input type="hidden" name="profile" value={draft.profile_id}/>
          <label>Time range
            <select name="range" defaultValue={range} aria-label="Analytics time range">
              <option value="7d">Last 7 days</option><option value="30d">Last 30 days</option><option value="all">All available time</option>
            </select>
          </label>
          <button className="button small" type="submit">Apply</button>
        </form>
        <span>Daily data: {rangeLabel.toLowerCase()} · refreshed when this page loads</span>
      </section>

      {response?.error && <p className="message error" role="alert">Profile analytics could not be loaded right now. Please reload to try again.</p>}
      <section className="analytics-metrics" aria-label="Analytics summary">
        <article className="analytics-metric"><span>Total Link Clicks</span><strong>{compact(clicks)}</strong><small>{periodHint} · recorded events</small></article>
        <article className="analytics-metric"><span>Browser-day Click Rate</span><strong>{browserCtr(browserTotal, browserClicked)}</strong><small>Browser observations with a click, not people</small></article>
        <article className="analytics-metric"><span>Profile Views</span><strong>{compact(views)}</strong><small>{periodHint} · consented views</small></article>
        <article className="analytics-metric"><span>Average Daily Views</span><strong>{compact(average)}</strong><small>Average across days with recorded data</small></article>
      </section>

      {campaigns.success && !campaignResponse?.error && <section className="studio-dashboard-panel stack">
        <div className="analytics-card-heading"><div><h2>Campaign links</h2><p>Create share links to compare broad traffic sources.</p></div></div>
        <AnalyticsCampaigns campaigns={campaigns.data} profile={draft.profile_id} pageUrl={new URL("/" + draft.username, siteUrl()).href}/>
      </section>}
      {(campaignResponse?.error || !campaigns.success) && <p className="message error" role="alert">Campaign links are unavailable. Reload to try again.</p>}

      <section className="analytics-main-grid">
        <article className="analytics-card">
          <div className="analytics-card-heading"><div><h2>Profile Views</h2><p>{periodHint} · UTC dates</p></div>
            <a className="button small" download="snoozer-analytics.csv" href={"/api/v1/analytics/export?profile=" + encodeURIComponent(draft.profile_id)}>Export CSV</a>
          </div>
          {rows.length ? <AnalyticsChart rows={rows}/> :
            <Empty title="No profile views yet" description="Views appear here when visitors allow analytics on your published Snoozer page."/>}
          <Disclosure title="How profile analytics work">
            <p className="muted">These are event counts, not unique people. Reloads may count again. Known bots are filtered, but automation can still inflate counts. Analytics are recorded only where visitors allow optional collection. Signed-in owner visits are excluded. Dates are UTC and totals follow your plan’s retention window.</p>
          </Disclosure>
        </article>

        <article className="analytics-card">
          <div className="analytics-card-heading"><div><h2>Visitor Devices</h2><p>Retention-window totals by approximate device category</p></div></div>
          {deviceRows.length ? <ul className="analytics-device-list">
            {deviceRows.map(([device, count]) => <li key={device}><span>{device}</span>
              <span className="analytics-device-track"><span style={{ width: (deviceTotal ? count / deviceTotal * 100 : 0) + "%" }}/></span>
              <strong>{compact(count)}</strong></li>)}
          </ul> : <Empty title="No device data yet" description="Share your Snoozer page to build an aggregated traffic breakdown. Device details are approximate, not unique visitor counts."/>}
          <p className="muted">This breakdown covers the available analytics retention window, not just the selected daily chart range.</p>
        </article>
      </section>

      <section className="analytics-breakdown-grid">
        <article className="analytics-card">
          <div className="analytics-card-heading"><div><h2>Most Clicked Links</h2><p>Retention-window totals</p></div></div>
          {topLinks.length ? <ul className="analytics-ranking-list">
            {topLinks.map((item) => <li key={item.url + item.label}><span>{item.label}</span><strong>{compact(item.clicks)}</strong></li>)}
          </ul> : <Empty title="No links clicked yet" description="Add links to your profile and share your page to see click totals here."/>}
        </article>
        <article className="analytics-card">
          <div className="analytics-card-heading"><div><h2>Top Traffic Sources</h2><p>Approximate source categories</p></div></div>
          {topSources.length ? <ul className="analytics-ranking-list">
            {topSources.map(([source, count]) => <li key={source}><span>{source.replaceAll("_", " ")}</span><strong>{compact(count)}</strong></li>)}
          </ul> : <Empty title="No sources yet" description="Source summaries appear when consented page activity is recorded."/>}
        </article>
        <article className="analytics-card">
          <div className="analytics-card-heading"><div><h2>Browser Activity</h2><p>Browser-day observations in the selected range</p></div></div>
          {browsers.length ? <ul className="analytics-ranking-list">
            <li><span>Browser-day observations</span><strong>{compact(browserTotal)}</strong></li>
            <li><span>Browsers with a click</span><strong>{compact(browserClicked)}</strong></li>
            <li><span>Browser-day click rate</span><strong>{browserCtr(browserTotal, browserClicked)}</strong></li>
          </ul> : <Empty title="No browser data yet" description="Only visitors who allow the latest analytics scope and have browser storage available are included."/>}
          {browserResponse?.error && <p className="message error">Browser reports are temporarily unavailable.</p>}
        </article>
      </section>

      <section className="analytics-card analytics-country-panel">
        <div className="analytics-card-heading"><div><h2>Top Countries by Views</h2><p>Geographic reporting</p></div></div>
        <div className="analytics-country-art"><span aria-hidden="true">◎</span>
          <p>Country-level visitor location is not collected by Snoozer analytics. No country ranking or world map is available.</p></div>
      </section>

      <section className="analytics-card stack">
        <div className="analytics-card-heading"><div><h2>Daily Activity</h2><p>Recorded views and link clicks by UTC date</p></div></div>
        {rows.length ? <TableScroll label="Daily profile activity report">
          <table className="analytics-data-table">
            <caption>Consent-based event totals inside the selected date range</caption>
            <thead><tr><th scope="col">Date (UTC)</th><th scope="col">Profile views</th><th scope="col">Link clicks</th></tr></thead>
            <tbody>{[...rows].reverse().map((row) => <tr key={row.day}><th scope="row"><time dateTime={row.day}>{row.day}</time></th><td>{compact(row.views)}</td><td>{compact(row.clicks)}</td></tr>)}</tbody>
          </table>
        </TableScroll> : <Empty title="No daily activity" description="There are no recorded events in this time range."/>}
      </section>

      {linksResponse?.error && <p className="message error" role="alert">Per-link reports are unavailable. Please reload to try again.</p>}
      {trafficResponse?.error && <p className="message error" role="alert">Traffic-source reports are unavailable. Please reload to try again.</p>}
      <p className="muted">Analytics are optional and privacy-conscious. They are not guaranteed to represent unique people, full visitor totals or precise device identities. “All available time” still means the retention window set by your current plan.</p>
    </>}
  </main>;
}
