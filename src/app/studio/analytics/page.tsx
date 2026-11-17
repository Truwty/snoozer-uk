import Link from "next/link";
import { dailyAnalytics } from "@/lib/analytics";
import { Brand } from "@/components/shell";
import { readStudioDraft, studioHref, type StudioProfileQuery } from "@/lib/profiles-server";
import { sessionClient } from "@/lib/supabase";

export const metadata = { title: "Analytics", robots: { index: false, follow: false } };

export default async function Page({ searchParams }: { searchParams: Promise<StudioProfileQuery> }) {
  const draft = await readStudioDraft((await searchParams).profile);
  const response = draft && await (await sessionClient()).rpc("get_my_profile_view_days", { p_profile: draft.profile_id });
  const rows = dailyAnalytics.safeParse(response?.data);
  const peak = rows.success ? Math.max(1, ...rows.data.map((row) => Math.max(row.views, row.clicks))) : 1;
  return <main className="shell narrow">
    <header className="nav"><Brand /><Link className="button small" href={studioHref("/studio", draft?.profile_id)}>Back to Studio</Link></header>
    <section className="panel stack">
      <h1>Profile analytics</h1>
      {draft ? <p className="muted">@{draft.username} · Views and clicks from visitors who allowed analytics. Dates are UTC. Signed-in owner visits are excluded.</p>
        : <p>Claim a profile in Studio to see analytics.</p>}
      {draft && (response?.error || !rows.success) && <p role="alert">Analytics are unavailable. Please try again later.</p>}
      {rows.success && (rows.data.length === 0 ? <p>No recorded views yet.</p> : <>
        <p><strong>{rows.data.reduce((sum, row) => sum + row.views, 0).toLocaleString("en-GB")}</strong> recorded views</p>
        <p><strong>{rows.data.reduce((sum, row) => sum + row.clicks, 0).toLocaleString("en-GB")}</strong> recorded link clicks</p>
        <p className="muted">These are event counts, not unique people. Reloads may count again. Known bots are filtered, but automation can still inflate counts. Counts stop at 10,000 views and 10,000 clicks per profile per UTC day.</p>
        <Link className="button small" prefetch={false} href={studioHref("/api/v1/analytics/export", draft?.profile_id)}>Download CSV</Link>
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
    </section>
  </main>;
}
