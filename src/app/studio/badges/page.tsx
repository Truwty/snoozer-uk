import Link from "next/link";
import { redirect } from "next/navigation";
import { readStudioDraft, studioHref, type StudioProfileQuery } from "@/lib/profiles-server";
import { requireAccount } from "@/lib/profiles-server";
import { z } from "zod";

export const metadata = { title: "Badges and milestones", robots: { index: false, follow: false } };

export default async function BadgesPage({ searchParams }: { searchParams: Promise<StudioProfileQuery> }) {
  const params = await searchParams;
  const draft = await readStudioDraft(params.profile);
  if (!draft) redirect("/studio");
  const selected = params.profile === undefined ? undefined : draft.profile_id;

  const { client } = await requireAccount();
  const response = await client.rpc("get_my_profile_badges", { p_profile: draft.profile_id });
  const badgeData = z.object({
    earned: z.array(z.object({ id:z.uuid(), slug:z.string(), name:z.string(), description:z.string(), icon:z.string(), category:z.string(), rarity:z.string(), source:z.string(), awarded_at:z.string(), award_reason:z.string().nullable() })),
    catalogue: z.array(z.object({ slug:z.string(), name:z.string(), description:z.string(), icon:z.string(), category:z.string(), rarity:z.string(), award_mode:z.string(), enabled:z.boolean(), earned:z.boolean() })),
  }).safeParse(response.data);
  const milestones = [
    { title: "Profile claimed", description: "Your Snoozer username is reserved and ready to customise.", complete: true, action: "Open profile settings", href: studioHref("/studio/settings", selected), icon: "@" },
    { title: "Profile published", description: "Publish your draft so visitors can open your public page.", complete: draft.published_revision !== null, action: "Open Page Builder", href: studioHref("/studio/builder", selected), icon: "↗" },
    { title: "First social link", description: "Add a social destination so visitors can find you elsewhere.", complete: draft.links.length > 0, action: "Add social links", href: studioHref("/studio/links", selected), icon: "⌁" },
    { title: "Profile story", description: "Add a description or a content section to introduce yourself.", complete: Boolean(draft.bio.trim() || draft.sections.length > 0), action: "Edit your profile", href: studioHref("/studio/builder", selected), icon: "Aa" },
    { title: "Gallery curator", description: "Add an image to your profile gallery.", complete: draft.gallery.length > 0, action: "Open image gallery", href: studioHref("/studio/gallery", selected), icon: "▧" },
  ];

  return <main className="shell studio-shell studio-badges-page">
    <header className="studio-page-heading">
      <div><p className="eyebrow">ACCOUNT / RECOGNITION</p><h1>Badges & milestones</h1>
        <p className="muted">Track the profile milestones you have completed and discover how recognition works on Snoozer.</p></div>
    </header>

    <section className="studio-dashboard-panel">
      <div className="studio-panel-heading">
        <div><p className="eyebrow">YOUR PROGRESS</p><h2>Profile milestones</h2>
          <p className="muted">These milestones are calculated from your current profile. They are progress indicators, not public account badges.</p></div>
        <strong className="studio-badge-count">{milestones.filter((item) => item.complete).length} / {milestones.length}</strong>
      </div>
      <div className="studio-milestone-grid">
        {milestones.map((item) => <article className={"studio-milestone-card" + (item.complete ? " is-complete" : "")} key={item.title}>
          <span className="studio-milestone-icon" aria-hidden="true">{item.complete ? "✓" : item.icon}</span>
          <div><div className="studio-milestone-title"><h3>{item.title}</h3><span>{item.complete ? "Complete" : "In progress"}</span></div>
            <p>{item.description}</p>
            {!item.complete && <Link href={item.href}>{item.action} <span aria-hidden="true">↗</span></Link>}
          </div>
        </article>)}
      </div>
    </section>

    <section className="studio-dashboard-panel studio-official-badges">
      <div className="studio-panel-heading"><div><p className="eyebrow">SNOOZER RECOGNITION</p><h2>Official badges</h2><p className="muted">Earned badges appear on your public profile automatically. Future event awards will be activated when those events launch.</p></div>
        {badgeData.success && <strong className="studio-badge-count">{badgeData.data.earned.length} earned</strong>}</div>
      {!badgeData.success ? <p role="alert">Your official badge collection is temporarily unavailable.</p> : <>
        <div className="studio-official-badge-grid" aria-label="Earned badges">
          {badgeData.data.earned.length ? badgeData.data.earned.map((badge) => <article className={"studio-official-badge rarity-"+badge.rarity} key={badge.id}>
            <span aria-hidden="true">{badge.icon}</span><div><strong>{badge.name}</strong><p>{badge.description}</p><small>{badge.rarity.toUpperCase()} · {badge.source==="owner"?"Owner awarded":"Automatically earned"}</small></div>
          </article>) : <p>No official badges have been earned yet. Complete profile milestones to unlock your first one.</p>}
        </div>
        <details className="studio-future-badge-catalogue"><summary>Badge catalogue · {badgeData.data.catalogue.length} badges</summary>
          <div className="studio-future-badge-grid">{badgeData.data.catalogue.map((badge)=><article className={"studio-future-badge"+(badge.earned?" is-earned":"")} key={badge.slug}>
            <span aria-hidden="true">{badge.icon}</span><div><strong>{badge.name}</strong><p>{badge.description}</p><small>{badge.earned?"Earned":badge.award_mode==="future"?"Future reward":"Automatic milestone"} · {badge.rarity}</small></div>
          </article>)}</div>
        </details>
      </>}
      <p className="muted">Only verified automatic milestones and awards made by Snoozer staff are public. Future catalogue entries are previews, not claimable rewards.</p>
      <div className="studio-badge-links">
        <Link className="button small" href="/help">Read the Help Centre</Link>
        <Link className="button small" href={studioHref("/studio/plan", selected)}>View Premium and usage</Link>
      </div>
    </section>
  </main>;
}
