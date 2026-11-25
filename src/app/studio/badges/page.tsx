import Link from "next/link";
import { redirect } from "next/navigation";
import { readStudioDraft, studioHref, type StudioProfileQuery } from "@/lib/profiles-server";

export const metadata = { title: "Badges and milestones", robots: { index: false, follow: false } };

export default async function BadgesPage({ searchParams }: { searchParams: Promise<StudioProfileQuery> }) {
  const params = await searchParams;
  const draft = await readStudioDraft(params.profile);
  if (!draft) redirect("/studio");
  const selected = params.profile === undefined ? undefined : draft.profile_id;

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
      <div className="studio-panel-heading"><div><p className="eyebrow">SNOOZER RECOGNITION</p><h2>Official badges</h2></div><span className="studio-coming-soon">In development</span></div>
      <p className="muted">The staff, helper, verified, donor, gifter, partner and seasonal badge programme is not yet connected to a live award or verification system. We have not added pretend purchase, claim or application buttons. Official badge availability will appear here when those rewards can be issued and managed reliably.</p>
      <div className="studio-badge-links">
        <Link className="button small" href="/help">Read the Help Centre</Link>
        <Link className="button small" href={studioHref("/studio/plan", selected)}>View Premium and usage</Link>
      </div>
    </section>
  </main>;
}
