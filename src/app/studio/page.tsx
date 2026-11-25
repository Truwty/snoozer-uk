import Link from "next/link";
import { redirect } from "next/navigation";
import { ClaimForm } from "@/components/claim-form";
import { AnalyticsChart } from "@/components/analytics-chart";
import { CopyLink } from "@/components/copy-link";
import { readStudioDraft, studioHref, type StudioProfileQuery } from "@/lib/profiles-server";
import { sessionClient } from "@/lib/supabase";
import { supabaseKey, supabaseUrl } from "@/lib/env";
import { aliasInventory } from "@/lib/aliases";
import { dailyAnalytics } from "@/lib/analytics";
import { accountPlan } from "@/lib/entitlements";

export const metadata = { title: "Studio Overview", robots: { index: false, follow: false } };

type Search = StudioProfileQuery & { logout?: string; deleted?: string; restored?: string };

export default async function Page({ searchParams }: { searchParams: Promise<Search> }) {
  if (!supabaseUrl || !supabaseKey) redirect("/sign-in");
  const params = await searchParams;
  const draft = await readStudioDraft(params.profile);

  if (!draft) return <main className="shell studio-shell studio-overview">
    {params.deleted === "1" && <p className="message" role="status">Your profile was deleted. Its images are queued for removal.</p>}
    <header className="studio-page-heading">
      <div><p className="eyebrow">YOUR WORKSPACE</p><h1>Account overview</h1><p className="muted">Claim your Snoozer address to start building your page.</p></div>
    </header>
    <section className="studio-dashboard-panel studio-claim-panel stack">
      <div className="studio-panel-icon" aria-hidden="true">✦</div>
      <h2>Claim your address</h2>
      <p className="muted">Choose the username people will use to find your page.</p>
      <ClaimForm/>
      <Link href="/studio/growth">Referral choices and Growth</Link>
    </section>
  </main>;

  const selected = params.profile === undefined ? undefined : draft.profile_id;
  const client = await sessionClient();
  const [planResponse, aliasesResponse, viewsResponse] = await Promise.all([
    client.rpc("get_my_plan"),
    client.rpc("list_my_aliases", { p_profile: draft.profile_id }),
    client.rpc("get_my_profile_view_days", { p_profile: draft.profile_id }),
  ]);
  const plan = accountPlan.safeParse(planResponse.data);
  const aliases = aliasInventory.safeParse(aliasesResponse.data);
  const views = dailyAnalytics.safeParse(viewsResponse.data);
  const viewTotal = views.success ? views.data.reduce((sum, row) => sum + row.views, 0) : null;
  const clickTotal = views.success ? views.data.reduce((sum, row) => sum + row.clicks, 0) : null;
  const profileId = draft.profile_id.replace(/-/g, "").slice(0, 8).toUpperCase();
  const completionItems = [
    { label: "Upload a profile avatar", done: Boolean(draft.avatar), href: studioHref("/studio/builder", selected) },
    { label: "Write a short description", done: Boolean(draft.bio.trim()), href: studioHref("/studio/builder", selected) },
    { label: "Add at least one social link", done: draft.links.length > 0, href: studioHref("/studio/links", selected) },
    { label: "Add a content section", done: draft.sections.length > 0, href: studioHref("/studio/builder", selected) },
    { label: "Publish your profile", done: draft.published_revision !== null, href: studioHref("/studio/builder", selected) },
  ];
  const completed = completionItems.filter((item) => item.done).length;
  const percentage = Math.round(completed / completionItems.length * 100);
  const status = draft.published_revision === null ? "Not published"
    : draft.revision === draft.published_revision ? "Live and up to date" : "Unpublished changes";

  return <main className="shell studio-shell studio-overview">
    {params.logout === "failed" && <p className="message error" role="alert">Could not sign out. Try again.</p>}
    {params.deleted === "1" && <p className="message" role="status">Your profile was deleted. Its images are queued for removal.</p>}
    {params.restored === "1" && <p className="message" role="status">Version restored to your draft.</p>}

    <header className="studio-page-heading">
      <div>
        <p className="eyebrow">ACCOUNT / OVERVIEW</p>
        <h1>Account overview</h1>
        <p className="muted">Your profile, account progress and recent activity in one place.</p>
      </div>
      <div className="actions studio-overview-actions">
        {draft.published_revision !== null && <CopyLink path={"/" + draft.username} label="Share profile"/>}
        {draft.published_revision !== null && <Link className="button small" href={"/" + draft.username} target="_blank" rel="noreferrer">View My Page ↗</Link>}
        <Link className="button primary" href={studioHref("/studio/builder", selected)}>Open Page Builder <span aria-hidden="true">→</span></Link>
      </div>
    </header>

    <section className="studio-overview-stats" aria-label="Account overview statistics">
      <article className="studio-stat-card studio-stat-username">
        <span className="studio-stat-icon" aria-hidden="true">@</span>
        <div><span className="studio-stat-label">Username</span><strong>@{draft.username}</strong><small>{status}</small></div>
      </article>
      <article className="studio-stat-card">
        <span className="studio-stat-icon" aria-hidden="true">⌑</span>
        <div><span className="studio-stat-label">Aliases</span><strong>{aliases.success ? aliases.data.used + " / " + aliases.data.limit : "—"}</strong>
          <small>{aliases.success ? Math.max(0, aliases.data.limit - aliases.data.used) + " slots remaining" : "Alias data unavailable"}</small></div>
      </article>
      <article className="studio-stat-card">
        <span className="studio-stat-icon" aria-hidden="true">#</span>
        <div><span className="studio-stat-label">UID</span><strong className="studio-stat-code">{profileId}</strong><small>Unique profile reference</small></div>
      </article>
      <article className="studio-stat-card">
        <span className="studio-stat-icon" aria-hidden="true">◉</span>
        <div><span className="studio-stat-label">Profile Views</span><strong>{viewTotal === null ? "—" : viewTotal.toLocaleString("en-GB")}</strong>
          <small>{clickTotal === null ? "Analytics unavailable" : clickTotal.toLocaleString("en-GB") + " recorded link clicks"}</small></div>
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
          <div><strong>{completed === completionItems.length ? "Your profile is complete!" : "You’re making progress."}</strong>
            <p>{completed === completionItems.length ? "Your profile is ready to share. Keep exploring Studio to make it your own." : "Complete the steps below to get your Snoozer page ready for visitors."}</p></div>
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
        <p className="muted">Shortcuts to the parts of Snoozer you use most.</p>
        <Link href={studioHref("/studio/account", selected)}><span>◎</span>Account settings <b>↗</b></Link>
        <Link href={studioHref("/studio/builder", selected)}><span>✎</span>Edit profile details <b>↗</b></Link>
        <Link href={studioHref("/studio/customize", selected)}><span>✦</span>Customize appearance <b>↗</b></Link>
        <Link href={studioHref("/studio/links", selected)}><span>⌁</span>Manage social links <b>↗</b></Link>
        <Link href={studioHref("/studio/settings", selected)}><span>⚙</span>Aliases & custom domains <b>↗</b></Link>
        <Link href={studioHref("/studio/plan", selected)}><span>◇</span>Plan and usage <b>↗</b></Link>
        <Link href={studioHref("/studio/badges", selected)}><span>✧</span>Manage profile badges <b>↗</b></Link>
        <div className="studio-connection-card">
          <div><strong>Connections</strong><span>Services connected to your profile</span></div>
          <Link href={studioHref("/studio/discord", selected)}>Discord Presence <b>↗</b></Link>
          <Link href={studioHref("/studio/spotify", selected)}>Spotify Embeds <b>↗</b></Link>
        </div>
      </aside>
    </div>

    <section className="studio-dashboard-panel studio-overview-analytics">
      <div className="studio-panel-heading">
        <div><p className="eyebrow">ACCOUNT ANALYTICS</p><h2>Profile activity</h2><p className="muted">A clear view of the activity visitors have agreed to share.</p></div>
        <Link className="button small" href={studioHref("/studio/analytics", selected)}>View full analytics <span aria-hidden="true">↗</span></Link>
      </div>
      <div className="studio-overview-analytics-grid">
        <section className="studio-analytics-chart-panel">
          <div className="studio-analytics-card-heading">
            <div><p className="eyebrow">RECENT ACTIVITY</p><h3>Views and link clicks</h3></div>
            <span className="studio-analytics-period">Recorded activity</span>
          </div>
          {views.success && views.data.length > 0
            ? <AnalyticsChart rows={views.data}/>
            : <div className="studio-empty-state"><strong>No chart data available yet</strong>
              <span>{viewsResponse.error ? "Analytics could not be loaded right now." : "Views will appear here when visitors with analytics consent open your page."}</span></div>}
        </section>
        <aside className="studio-analytics-insights">
          <p className="eyebrow">ENGAGEMENT SNAPSHOT</p>
          <h3>Your activity</h3>
          <div className="studio-analytics-insight">
            <span>Profile views</span>
            <strong>{viewTotal === null ? "—" : viewTotal.toLocaleString("en-GB")}</strong>
            <small>Consented profile visits</small>
          </div>
          <div className="studio-analytics-insight">
            <span>Link clicks</span>
            <strong>{clickTotal === null ? "—" : clickTotal.toLocaleString("en-GB")}</strong>
            <small>Recorded link interactions</small>
          </div>
          <p className="muted">Snoozer only reports activity that visitors have consented to share. No visitor-level tracking is shown here.</p>
        </aside>
      </div>
    </section>

    <section className="studio-bottom-note">
      <div><span>Current plan</span><strong>{plan.success ? plan.data.plan.toUpperCase() : "PLAN DETAILS UNAVAILABLE"}</strong></div>
      <Link href={studioHref("/studio/plan", selected)}>View plan and usage <span aria-hidden="true">↗</span></Link>
    </section>
  </main>;
}
