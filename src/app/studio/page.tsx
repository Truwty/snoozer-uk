import Link from "next/link";
import { redirect } from "next/navigation";
import { ClaimForm } from "@/components/claim-form";
import { AnalyticsChart } from "@/components/analytics-chart";
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
    <header className="studio-page-heading">
      <div><p className="eyebrow">YOUR WORKSPACE</p><h1>Account overview</h1><p className="muted">Claim your Snoozer address to start building your page.</p></div>
    </header>
    <section className="panel claim-panel stack">
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
      <div><p className="eyebrow">ACCOUNT / OVERVIEW</p><h1>Account overview</h1><p className="muted">Your profile, account progress and recent activity.</p></div>
      <div className="actions">
        {draft.published_revision !== null && <Link className="button small" href={"/" + draft.username}>View my page ↗</Link>}
        <Link className="button primary" href={studioHref("/studio/builder", selected)}>Open Page Builder</Link>
      </div>
    </header>

    <section className="studio-overview-stats" aria-label="Account overview">
      <article className="studio-stat-card"><span>Username</span><strong>@{draft.username}</strong><small>{status}</small></article>
      <article className="studio-stat-card"><span>Aliases used</span><strong>{aliases.success ? aliases.data.used + " / " + aliases.data.limit : "—"}</strong><small>Reserved profile addresses</small></article>
      <article className="studio-stat-card"><span>Profile views</span><strong>{viewTotal === null ? "—" : viewTotal.toLocaleString("en-GB")}</strong><small>Recorded during your analytics retention period</small></article>
      <article className="studio-stat-card"><span>Link clicks</span><strong>{clickTotal === null ? "—" : clickTotal.toLocaleString("en-GB")}</strong><small>Recorded link interactions</small></article>
    </section>

    <div className="studio-overview-grid">
      <section className="studio-dashboard-panel studio-completion-panel">
        <div className="studio-panel-heading"><div><p className="eyebrow">PROFILE HEALTH</p><h2>Profile completion</h2></div><strong>{percentage}%</strong></div>
        <div className="studio-progress-track" role="progressbar" aria-label="Profile completion" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentage}><span style={{ width: percentage + "%" }}/></div>
        <p className="muted">{completed === completionItems.length ? "Your profile is ready to share." : completed + " of " + completionItems.length + " suggested steps completed."}</p>
        <ul className="studio-completion-list">
          {completionItems.map((item) => <li key={item.label}>
            <span className={item.done ? "is-complete" : ""} aria-hidden="true">{item.done ? "✓" : "○"}</span>
            <span>{item.label}</span>
            {!item.done && <Link href={item.href}>Complete ↗</Link>}
          </li>)}
        </ul>
      </section>

      <aside className="studio-dashboard-panel studio-manage-panel">
        <p className="eyebrow">QUICK ACTIONS</p><h2>Manage your account</h2>
        <Link href={studioHref("/studio/builder", selected)}>Edit profile details ↗</Link>
        <Link href={studioHref("/studio/customize", selected)}>Customize appearance ↗</Link>
        <Link href={studioHref("/studio/settings", selected)}>Aliases and custom domains ↗</Link>
        <Link href={studioHref("/studio/gallery", selected)}>Manage gallery and assets ↗</Link>
        <Link href={studioHref("/studio/plan", selected)}>Subscription and usage ↗</Link>
        <div className="studio-connection-card"><strong>Connections</strong><span>Configure connected services and live status.</span>
          <Link href={studioHref("/studio/discord", selected)}>Discord Presence settings ↗</Link>
          <Link href="/studio/spotify">Spotify embeds ↗</Link>
        </div>
      </aside>
    </div>

    <section className="studio-dashboard-panel studio-overview-analytics">
      <div className="studio-panel-heading"><div><p className="eyebrow">ACCOUNT ANALYTICS</p><h2>Profile activity</h2><p className="muted">Consent-based aggregate activity reported for your profile.</p></div><Link className="button small" href={studioHref("/studio/analytics", selected)}>View full analytics ↗</Link></div>
      {views.success && views.data.length > 0
        ? <AnalyticsChart rows={views.data}/>
        : <div className="studio-empty-state"><strong>No chart data available yet</strong><span>{viewsResponse.error ? "Analytics could not be loaded right now." : "Views will appear here when visitors with analytics consent open your page."}</span></div>}
    </section>

    <section className="studio-bottom-note">
      <span>Current plan</span><strong>{plan.success ? plan.data.plan.toUpperCase() : "PLAN DETAILS UNAVAILABLE"}</strong>
      <Link href={studioHref("/studio/plan", selected)}>View plan and usage ↗</Link>
    </section>
  </main>;
}
