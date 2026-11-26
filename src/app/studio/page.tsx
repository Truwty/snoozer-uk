import Link from "next/link";
import { redirect } from "next/navigation";
import { linkGoogleIdentity } from "@/app/auth/actions";
import { ClaimForm } from "@/components/claim-form";
import { readStudioDraft, studioHref, type StudioProfileQuery } from "@/lib/profiles-server";
import { sessionClient } from "@/lib/supabase";
import { supabaseKey, supabaseUrl } from "@/lib/env";
import { aliasInventory } from "@/lib/aliases";
import { analyticsRangeStart, dailyAnalytics, overviewDeviceAnalytics } from "@/lib/analytics";
import { accountPlan } from "@/lib/entitlements";
import { discordPresenceSettings } from "@/lib/discord-presence";

export const metadata = { title: "Account Overview", robots: { index: false, follow: false } };

type Search = StudioProfileQuery & { logout?: string; deleted?: string; restored?: string };

const DEVICE_COLOURS = ["#d8fb86", "#a4b987", "#738c69", "#596a52", "#a5aaa1"];

function profileChart(rows: { day: string; views: number; clicks: number }[]) {
  if (rows.length === 0) return null;
  const points = rows.map((row, index) => ({
    x: rows.length === 1 ? 500 : 18 + (index / (rows.length - 1)) * 964,
    y: 170 - row.views / Math.max(1, ...rows.map((item) => item.views)) * 145,
  }));
  const line = points.map((point, index) =>
    (index === 0 ? "M" : "L") + " " + point.x.toFixed(1) + " " + point.y.toFixed(1)
  ).join(" ");
  return {
    line,
    area: line + " L 982 184 L 18 184 Z",
    first: rows[0].day,
    last: rows[rows.length - 1].day,
  };
}

function deviceLabel(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default async function Page({ searchParams }: { searchParams: Promise<Search> }) {
  if (!supabaseUrl || !supabaseKey) redirect("/sign-in");
  const params = await searchParams;
  const draft = await readStudioDraft(params.profile);

  if (!draft) return <main className="shell studio-shell studio-overview">
    {params.deleted === "1" && <p className="message" role="status">Your profile was deleted. Its images are queued for removal.</p>}
    <header className="studio-page-heading">
      <div><p className="eyebrow">ACCOUNT OVERVIEW</p><h1>Account Overview</h1>
        <p className="muted">Claim your Snoozer address to start building your page.</p></div>
    </header>
    <section className="studio-dashboard-panel studio-claim-panel stack">
      <div className="studio-panel-icon" aria-hidden="true">☾</div>
      <h2>Claim your address</h2>
      <p className="muted">Choose the username people will use to find your page.</p>
      <ClaimForm/>
      <Link href="/studio/growth">Manage your Snoozer account</Link>
    </section>
  </main>;

  const selected = params.profile === undefined ? undefined : draft.profile_id;
  const client = await sessionClient();
  const [planResponse, aliasesResponse, viewsResponse, deviceResponse, userResponse, uidResponse, discordResponse] = await Promise.all([
    client.rpc("get_my_plan"),
    client.rpc("list_my_aliases", { p_profile: draft.profile_id }),
    client.rpc("get_my_profile_view_days", { p_profile: draft.profile_id }),
    client.rpc("get_my_profile_device_views_7d", { p_profile: draft.profile_id }),
    client.auth.getUser(),
    client.rpc("get_my_profile_uid", { p_profile: draft.profile_id }),
    client.rpc("discord_presence_get_my_settings", { p_profile: draft.profile_id }),
  ]);

  const plan = accountPlan.safeParse(planResponse.data);
  const aliases = aliasInventory.safeParse(aliasesResponse.data);
  const views = dailyAnalytics.safeParse(viewsResponse.data);
  const deviceAnalytics = overviewDeviceAnalytics.safeParse(deviceResponse.data);
  const discord = discordPresenceSettings.safeParse(discordResponse.data);
  const viewRows = views.success ? views.data : [];
  const viewTotal = viewRows.reduce((sum, row) => sum + row.views, 0);
  const clickTotal = viewRows.reduce((sum, row) => sum + row.clicks, 0);
  const sevenDayStart = analyticsRangeStart("7d");
  const previousSevenDayStart = new Date(Date.parse(sevenDayStart + "T00:00:00.000Z") - 7 * 86400000).toISOString().slice(0, 10);
  const sevenDayViews = viewRows.filter((row) => row.day >= sevenDayStart).reduce((sum, row) => sum + row.views, 0);
  const previousSevenDayViews = viewRows.filter((row) => row.day >= previousSevenDayStart && row.day < sevenDayStart)
    .reduce((sum, row) => sum + row.views, 0);
  const canCompareSevenDays = plan.success && plan.data.quotas.analyticsDays >= 14;
  const sevenDayDelta = sevenDayViews - previousSevenDayViews;
  const uid = typeof uidResponse.data === "number" && Number.isSafeInteger(uidResponse.data)
    ? uidResponse.data.toLocaleString("en-GB") : "—";

  const user = userResponse.data.user;
  const providers = Array.isArray(user?.app_metadata?.providers)
    ? user.app_metadata.providers.filter((provider): provider is string => typeof provider === "string")
    : typeof user?.app_metadata?.provider === "string" ? [user.app_metadata.provider] : [];
  const googleConnected = providers.includes("google")
    || Boolean(user?.identities?.some((identity) => identity.provider === "google"));

  const completionItems = [
    { label: "Upload Avatar", done: Boolean(draft.avatar), href: studioHref("/studio/customize", selected) },
    { label: "Add Description", done: Boolean(draft.bio.trim()), href: studioHref("/studio/customize", selected) },
    { label: "Link Discord Account", done: discord.success && discord.data.connected, href: studioHref("/studio/account", selected) },
    { label: "Add Socials", done: draft.links.length > 0, href: studioHref("/studio/links", selected) },
    { label: "Reach 10 profile views", done: viewTotal >= 10, href: studioHref("/studio/analytics", selected) },
  ];
  const completed = completionItems.filter((item) => item.done).length;
  const percentage = Math.round(completed / completionItems.length * 100);
  const status = draft.published_revision === null ? "Not published"
    : draft.revision === draft.published_revision ? "Live and up to date" : "Unpublished changes";

  const devices = deviceAnalytics.success ? deviceAnalytics.data.map((row) => [row.device, row.views] as const) : [];
  const deviceTotal = devices.reduce((sum, [, count]) => sum + count, 0);
  let deviceCursor = 0;
  const deviceGradient = deviceTotal > 0
    ? devices.map(([, count], index) => {
      const start = deviceCursor;
      deviceCursor += count / deviceTotal * 100;
      return DEVICE_COLOURS[index % DEVICE_COLOURS.length] + " " + start.toFixed(2) + "% " + deviceCursor.toFixed(2) + "%";
    }).join(", ")
    : "#252a25";
  const viewsByDay = new Map(viewRows.filter((row) => row.day >= analyticsRangeStart("7d")).map((row) => [row.day, row]));
  const chartRows = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(Date.parse(analyticsRangeStart("7d") + "T00:00:00.000Z") + index * 86400000).toISOString().slice(0, 10);
    return viewsByDay.get(date) ?? { day: date, views: 0, clicks: 0 };
  });
  const hasRecentViews = viewRows.some((row) => row.day >= analyticsRangeStart("7d"));
  const chart = hasRecentViews ? profileChart(chartRows) : null;

  return <main className="shell studio-shell studio-overview">
    {params.logout === "failed" && <p className="message error" role="alert">Could not sign out. Try again.</p>}
    {params.deleted === "1" && <p className="message" role="status">Your profile was deleted. Its images are queued for removal.</p>}
    {params.restored === "1" && <p className="message" role="status">Version restored to your draft.</p>}

    <header className="studio-page-heading">
      <div>
        <p className="eyebrow">ACCOUNT OVERVIEW</p>
        <h1>Account Overview</h1>
        <p className="muted">Your account at a glance.</p>
      </div>

    </header>

    <section className="studio-overview-stats" aria-label="Account overview statistics">
      <article className="studio-stat-card studio-stat-username">
        <span className="studio-stat-icon" aria-hidden="true">@</span>
        <div><span className="studio-stat-label">Username</span><strong>@{draft.username}</strong><small>{status}</small></div>
      </article>
      <article className="studio-stat-card">
        <span className="studio-stat-icon" aria-hidden="true">⌑</span>
        <div><span className="studio-stat-label">Alias</span><strong>{aliases.success ? aliases.data.used + " / " + aliases.data.limit : "—"}</strong>
          <small>{aliases.success ? Math.max(0, aliases.data.limit - aliases.data.used) + " available" : "Alias data unavailable"}</small></div>
      </article>
      <article className="studio-stat-card">
        <span className="studio-stat-icon" aria-hidden="true">#</span>
        <div><span className="studio-stat-label">UID</span><strong className="studio-stat-code">{uid}</strong><small>Stable numeric profile reference</small></div>
      </article>
      <article className="studio-stat-card">
        <span className="studio-stat-icon" aria-hidden="true">◉</span>
        <div><span className="studio-stat-label">Profile Views</span><strong>{viewTotal.toLocaleString("en-GB")}</strong>
          <small>{clickTotal.toLocaleString("en-GB")} link clicks within your analytics retention period</small>
          <small>{canCompareSevenDays
            ? `${sevenDayViews.toLocaleString("en-GB")} in 7 days · ${sevenDayDelta >= 0 ? "+" : ""}${sevenDayDelta.toLocaleString("en-GB")} vs prior 7 days`
            : `${sevenDayViews.toLocaleString("en-GB")} in 7 days · prior week is outside your analytics retention`}</small></div>
      </article>
    </section>

    <div className="studio-overview-grid">
      <section className="studio-dashboard-panel studio-completion-panel">
        <div className="studio-panel-heading">
          <div><p className="eyebrow">PROFILE HEALTH</p><h2>Account Statistics</h2><p className="muted">Profile completion</p></div>
          <strong className="studio-completion-percent">{percentage}% <small>complete</small></strong>
        </div>
        <div className="studio-progress-track" role="progressbar" aria-label="Profile completion" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentage}>
          <span style={{ width: percentage + "%" }}/>
        </div>
        <div className="studio-completion-callout">
          <span aria-hidden="true">✓</span>
          <div><strong>{completed === completionItems.length ? "Your profile is complete!" : "Complete your profile."}</strong>
            <p>{completed === completionItems.length ? "Your Snoozer page is ready to share. You can keep refining it at any time." : "Finish these steps to get your Snoozer page ready for visitors."}</p></div>
        </div>
        <ul className="studio-completion-list">
          {completionItems.map((item) => <li key={item.label}>
            <span className={item.done ? "is-complete" : ""} aria-hidden="true">{item.done ? "✓" : "○"}</span>
            <span>{item.label}</span>
            {!item.done && <Link href={item.href}>Complete <span aria-hidden="true">↗</span></Link>}
          </li>)}
        </ul>
      </section>

      <aside className="studio-dashboard-panel studio-manage-panel">
        <p className="eyebrow">QUICK ACTIONS</p>
        <h2>Manage your account</h2>
        <Link href={studioHref("/studio/account", selected)}><span>✎</span>Change Username <b>↗</b></Link>
        <Link href={studioHref("/studio/customize", selected)}><span>✧</span>Change Display Name <b>↗</b></Link>
        <Link href={studioHref("/studio/account", selected)}><span>⌑</span>Manage Aliases <b>↗</b></Link>
        <Link href={studioHref("/studio/account", selected)}><span>⚙</span>Account Settings <b>↗</b></Link>
        <div className="studio-connection-card">
          <div><strong>Connections</strong><span>Connected accounts and integrations</span></div>
          <div className="studio-connection-status">
            <span>Discord account</span><strong>{discord.success && discord.data.connected ? "Connected" : "Not connected"}</strong>
            <Link href={studioHref("/studio/account",selected)} aria-label="Discord connection settings">⚙</Link>
          </div>
          <div className="studio-connection-status">
            <span>Google account</span><strong>{googleConnected ? "Connected" : "Not connected"}</strong>
            {googleConnected ? <Link href={studioHref("/studio/account",selected)} aria-label="Google connection settings">⚙</Link>
              : <form action={linkGoogleIdentity}><button type="submit">Connect Google</button></form>}
          </div>
          <Link href={studioHref("/studio/discord",selected)}>Discord Presence settings <b>↗</b></Link>
        </div>
      </aside>
    </div>

    <section className="studio-dashboard-panel studio-overview-analytics">
      <div className="studio-panel-heading">
        <div><p className="eyebrow">ACCOUNT ANALYTICS</p><h2>Account Analytics</h2></div>
        <Link className="button small" href={studioHref("/studio/analytics", selected)}>View More <span aria-hidden="true">↗</span></Link>
      </div>
      <div className="studio-video-analytics-grid">
        <section className="studio-video-analytics-card">
          <h3>Visitor Devices</h3>
          <div className="studio-device-chart-wrap">
            <div className="studio-device-donut" role="img"
              aria-label={deviceTotal > 0 ? devices.map(([device, count]) => deviceLabel(device) + " " + count).join(", ") : "No visitor device data yet"}
              style={{ background: "conic-gradient(" + deviceGradient + ")" }}>
              <div className="studio-device-donut-copy"><strong>{deviceTotal.toLocaleString("en-GB")}</strong><span>Recorded views</span></div>
            </div>
          </div>
          <div className="studio-device-legend">
            {devices.length ? devices.map(([device, count], index) => <span key={device}>
              <i style={{ background: DEVICE_COLOURS[index % DEVICE_COLOURS.length] }}/>{deviceLabel(device)} {count.toLocaleString("en-GB")}
            </span>) : <span>No device data available yet</span>}
          </div>
          {deviceResponse.error && <p className="message error" role="alert">Visitor device data could not be loaded right now.</p>}
          <p className="muted">Recorded profile views across the last 7 UTC calendar days.</p>
        </section>
        <section className="studio-video-analytics-card">
          <h3>Profile Views</h3>
          {viewsResponse.error && <p className="message error" role="alert">Profile views could not be loaded right now.</p>}
          {chart ? <div className="studio-profile-chart">
            <svg viewBox="0 0 1000 200" role="img" aria-label={"Profile views from " + chart.first + " to " + chart.last}>
              {[25, 95, 165].map((y) => <line key={y} className="chart-grid" x1="18" y1={y} x2="982" y2={y}/>)}
              <path className="chart-area" d={chart.area}/>
              <path className="chart-line" d={chart.line}/>
            </svg>
            <div className="studio-profile-chart-dates"><span>{chart.first}</span><span>{chart.last}</span></div>
          </div> : <div className="studio-device-chart-wrap"><div className="studio-empty-state">
            <strong>No profile views yet</strong><span>Views will appear here when visitors allow analytics on your published profile.</span>
          </div></div>}
          <p className="muted">Consented profile views across the last 7 UTC calendar days; dates without views show as zero.</p>
        </section>
      </div>
    </section>

  </main>;
}
