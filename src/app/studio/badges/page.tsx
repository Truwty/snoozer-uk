import Link from "next/link";
import { redirect } from "next/navigation";
import { readStudioDraft, studioHref, requireAccount, type StudioProfileQuery } from "@/lib/profiles-server";
import { z } from "zod";
import { BadgeArtwork } from "@/components/badge-artwork";
import { saveBadgeVisibility } from "./actions";
import { StudioBadgeOrder } from "@/components/studio-badge-order";
import { StudioCustomBadges } from "@/components/studio-custom-badges";
import { createCustomBadge } from "./actions";
import { accountPlan } from "@/lib/entitlements";

export const metadata = { title: "Badges and milestones", robots: { index: false, follow: false } };

export default async function BadgesPage({ searchParams }: { searchParams: Promise<StudioProfileQuery & { visibility?: string; custom?: string }> }) {
  const params = await searchParams;
  const draft = await readStudioDraft(params.profile);
  if (!draft) redirect("/studio");
  const selected = params.profile === undefined ? undefined : draft.profile_id;

  const { client } = await requireAccount();
  const response = await client.rpc("get_my_profile_badges", { p_profile: draft.profile_id });
  const customResponse = await client.rpc("list_my_custom_badges", { p_profile: draft.profile_id });
  const planResponse = await client.rpc("get_my_plan");
  const customBadges = z.array(z.object({ id:z.uuid(),title:z.string(),description:z.string(),icon:z.string(),color:z.string(),image_id:z.uuid().nullable(),is_public:z.boolean(),display_order:z.number() })).safeParse(customResponse.data);
  const plan = accountPlan.safeParse(planResponse.data);
  const customLimit = plan.success ? plan.data.quotas.customBadges : 0;
  const badgeData = z.object({
    earned: z.array(z.object({ id:z.uuid(), slug:z.string(), name:z.string(), description:z.string(), icon:z.string(), category:z.string(), rarity:z.string(), source:z.string(), awarded_at:z.string(), award_reason:z.string().nullable(), is_public:z.boolean() })),
    catalogue: z.array(z.object({ slug:z.string(), name:z.string(), description:z.string(), icon:z.string(), category:z.string(), rarity:z.string(), award_mode:z.string(), enabled:z.boolean(), earned:z.boolean() })),
  }).safeParse(response.data);
  const milestones = [
    { title: "Profile claimed", description: "Your Snoozer username is reserved and ready to customise.", complete: true, action: "Open profile settings", href: studioHref("/studio/account", selected), icon: "@" },
    { title: "Profile published", description: "Publish your draft so visitors can open your public page.", complete: draft.published_revision !== null, action: "Customise your page", href: studioHref("/studio/customize", selected), icon: "↗" },
    { title: "First social link", description: "Add a social destination so visitors can find you elsewhere.", complete: draft.links.length > 0, action: "Add social links", href: studioHref("/studio/links", selected), icon: "⌁" },
    { title: "Profile story", description: "Add a description or a content section to introduce yourself.", complete: Boolean(draft.bio.trim() || draft.sections.length > 0), action: "Edit your profile", href: studioHref("/studio/customize", selected), icon: "Aa" },
    { title: "Gallery curator", description: "Add an image to your profile gallery.", complete: draft.gallery.length > 0, action: "Open Image Host", href: studioHref("/studio/image-host", selected), icon: "▧" },
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
      <div className="studio-panel-heading">
        <div><p className="eyebrow">SNOOZER RECOGNITION</p><h2>Official badges</h2>
          <p className="muted">Choose which earned badges appear publicly. Use the arrows to set their display order; hidden badges stay in your collection.</p></div>
        {badgeData.success && <strong className="studio-badge-count">{badgeData.data.earned.length} earned</strong>}
      </div>
      {params.visibility === "saved" && <p className="studio-badge-status" role="status">Your public badge display has been updated.</p>}
      {params.visibility === "failed" && <p className="message error" role="alert">We could not update your badge display. Refresh the page and try again.</p>}
      {params.visibility === "invalid" && <p className="message error" role="alert">The badge selection was invalid. Reload the page and try again.</p>}
      {!badgeData.success ? <p role="alert">Your official badge collection is temporarily unavailable.</p> : <>
        <form action={saveBadgeVisibility} className="studio-badge-visibility-form">
          <input type="hidden" name="profile" value={draft.profile_id}/>
          {badgeData.data.earned.length ? <StudioBadgeOrder badges={badgeData.data.earned}/> : <p>No official badges have been earned yet. Complete profile milestones to unlock your first one.</p>}
          {badgeData.data.earned.length > 0 && <div className="studio-badge-save-row">
            <button className="button primary" type="submit">Save public badge selection</button>
            <span className="muted">Hiding a badge never removes it from your collection. Only verified Snoozer awards can appear as official badges.</span>
          </div>}
        </form>
        <details className="studio-future-badge-catalogue">
          <summary>Badge catalogue · {badgeData.data.catalogue.length} badges</summary>
          <div className="studio-future-badge-grid">{badgeData.data.catalogue.map((badge) => <article className={"studio-future-badge" + (badge.earned ? " is-earned" : "")} key={badge.slug}>
            <BadgeArtwork slug={badge.slug} size={38}/>
            <div><strong>{badge.name}</strong><p>{badge.description}</p><small>{badge.earned ? "Earned" : badge.award_mode === "future" ? "Future reward" : "Automatic milestone"} · {badge.rarity}</small></div>
          </article>)}</div>
        </details>
      </>}
      <p className="muted">Only active awards made by verified Snoozer systems or staff are eligible for public display. Future catalogue entries are previews until their qualifying feature launches.</p>
      <div className="studio-badge-links">
        <Link className="button small" href="/help">Read the Help Centre</Link>
        <Link className="button small" href={studioHref("/studio/plan", selected)}>View Premium and usage</Link>
      </div>
    </section>
    <section className="studio-dashboard-panel studio-custom-badge-designer">
      <div className="studio-panel-heading"><div><p className="eyebrow">YOUR DESIGNS</p><h2>Custom badges</h2>
        <p className="muted">Create a personal badge using a text symbol and colour. Custom badges are visibly separate from official Snoozer awards.</p></div>
        <strong className="studio-badge-count">{customBadges.success ? customBadges.data.length : "—"} / {customLimit}</strong></div>
      {params.custom === "saved" && <p role="status" className="studio-badge-status">Custom badge changes saved.</p>}
      {params.custom === "limit" && <p role="alert" className="message error">Your current plan has reached its custom badge limit.</p>}
      {(params.custom === "failed" || params.custom === "invalid") && <p role="alert" className="message error">We could not save the custom badge. Check the fields and try again.</p>}
      {!customBadges.success ? <p role="alert">Custom badges could not be loaded right now.</p> : <>
        {customBadges.data.length > 0 && <StudioCustomBadges profile={draft.profile_id} badges={customBadges.data}/>}
        {customBadges.data.length >= customLimit ? <p className="muted">You have used all custom badge slots available on your plan.</p> : <form action={createCustomBadge} className="studio-custom-badge-create">
          <input type="hidden" name="profile" value={draft.profile_id}/>
          <label>Badge title<input name="title" required minLength={2} maxLength={40}/></label>
          <label>Description (optional)<input name="description" maxLength={160}/></label>
          <label>Symbol<input name="icon" required maxLength={8} defaultValue="✦" aria-describedby="custom-badge-symbol-help"/></label>
          <p id="custom-badge-symbol-help" className="muted">Use a short emoji or text symbol. Uploaded artwork is not supported in this first version.</p>
          <label>Badge colour<input name="color" type="color" defaultValue="#73e3bd"/></label>
          <label>Artwork (optional)<input name="artwork" type="file" accept="image/jpeg,image/png,image/webp"/></label>
          <p className="muted">Artwork is decoded and re-encoded as WebP, then stored privately. Maximum upload size: 2 MB.</p>
          <button className="button primary" type="submit">Create custom badge</button>
        </form>}
      </>}
    </section>
  </main>;
}
