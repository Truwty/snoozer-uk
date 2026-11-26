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
import { discordPresenceInviteUrl } from "@/lib/env";
import { StudioCustomBadgePreview } from "@/components/studio-custom-badge-preview";

export const metadata = { title: "Badges", robots: { index: false, follow: false } };

type CatalogueBadge = { slug: string; earned: boolean; enabled: boolean; award_mode: string };

function catalogueAction(badge: CatalogueBadge, profile: string | undefined, discordInvite: string | null) {
  if (badge.earned) return { kind: "status" as const, label: "Earned" };
  if (!badge.enabled) return { kind: "status" as const, label: "Unavailable" };
  if (badge.award_mode === "future") return { kind: "status" as const, label: "Coming soon" };

  const route = (path: string) => studioHref(path, profile);
  if (badge.award_mode === "manual") {
    if (badge.slug === "premium-supporter") return { kind: "link" as const, label: "Purchase", href: route("/studio/plan") };
    if (badge.slug === "bug-hunter") return { kind: "link" as const, label: "Report", href: "/help/contact" };
    if (badge.slug === "gift-giver") return { kind: "link" as const, label: "Ask about gifts", href: "/help/contact" };
    if (discordInvite && ["staff-member", "moderator", "support-team", "community-helper", "community-champion", "partner"].includes(badge.slug)) {
      return { kind: "external" as const, label: "Join Discord", href: discordInvite };
    }
    return { kind: "link" as const, label: "Contact support", href: "/help/contact" };
  }

  if (["first-link", "link-builder", "networker", "people-click"].includes(badge.slug)) {
    return { kind: "link" as const, label: "Add Links", href: route("/studio/links") };
  }
  if (["gallery-opener", "gallery-curator", "gallery-master"].includes(badge.slug)) {
    return { kind: "link" as const, label: "Image Host", href: route("/studio/image-host") };
  }
  if (["getting-noticed", "rising-star", "crowd-favourite", "profile-icon", "million-views", "half-thousand", "on-the-map", "half-million"].includes(badge.slug)
    || badge.slug.includes("click")) {
    return { kind: "link" as const, label: "View Analytics", href: route("/studio/analytics") };
  }
  if (["two-factor", "google-connected"].includes(badge.slug)) {
    return { kind: "link" as const, label: "Account Settings", href: route("/studio/account") };
  }
  if (badge.slug === "discord-connected") {
    return { kind: "link" as const, label: "Connect Discord", href: route("/studio/discord") };
  }
  if (["own-domain", "domain-pioneer"].includes(badge.slug)) {
    return { kind: "link" as const, label: "Add Domain", href: route("/studio/builder") };
  }
  if (badge.slug === "gifted-premium") {
    return { kind: "link" as const, label: "Claim Gift", href: "/gift" };
  }
  return { kind: "link" as const, label: "Customize", href: route("/studio/customize") };
}

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
  const discordInvite = discordPresenceInviteUrl();
  const badgeData = z.object({
    earned: z.array(z.object({ id:z.uuid(), slug:z.string(), name:z.string(), description:z.string(), icon:z.string(), category:z.string(), rarity:z.string(), source:z.string(), awarded_at:z.string(), award_reason:z.string().nullable(), is_public:z.boolean() })),
    catalogue: z.array(z.object({ slug:z.string(), name:z.string(), description:z.string(), icon:z.string(), category:z.string(), rarity:z.string(), award_mode:z.string(), enabled:z.boolean(), earned:z.boolean() })),
  }).safeParse(response.data);
  return <main className="shell studio-shell studio-badges-page">
    <header className="studio-page-heading">
      <div><p className="eyebrow">ACCOUNT / BADGES</p><h1>Badges</h1>
        <p className="muted">Browse official Snoozer awards and manage the personal badges shown on your profile.</p></div>
    </header>

    <section className="studio-dashboard-panel studio-official-badges">
      <div className="studio-panel-heading">
        <div><p className="eyebrow">SNOOZER RECOGNITION</p><h2>All badges</h2>
          <p className="muted">Choose which earned badges appear publicly. Use the arrows to set their display order; hidden badges stay in your collection.</p></div>
        {badgeData.success && <strong className="studio-badge-count">{badgeData.data.earned.length} earned</strong>}
      </div>
      {params.visibility === "saved" && <p className="studio-badge-status" role="status">Your public badge display has been updated.</p>}
      {params.visibility === "failed" && <p className="message error" role="alert">We could not update your badge display. Refresh the page and try again.</p>}
      {params.visibility === "invalid" && <p className="message error" role="alert">The badge selection was invalid. Reload the page and try again.</p>}
      {!badgeData.success ? <p role="alert">Your badge collection is temporarily unavailable.</p> : <>
        <form action={saveBadgeVisibility} className="studio-badge-visibility-form">
          <input type="hidden" name="profile" value={draft.profile_id}/>
          {badgeData.data.earned.length ? <StudioBadgeOrder badges={badgeData.data.earned}/> : <p>No badges have been earned yet. Earn badges through Snoozer activity or an award from the Snoozer team.</p>}
          {badgeData.data.earned.length > 0 && <div className="studio-badge-save-row">
            <button className="button primary" type="submit">Save public badge selection</button>
            <span className="muted">Hiding a badge never removes it from your collection. Only verified Snoozer awards can appear as official badges.</span>
          </div>}
        </form>
        <section className="studio-future-badge-catalogue">
          <div className="studio-panel-heading"><h3>Badge catalogue</h3><span>{badgeData.data.catalogue.length} badges</span></div>
          <div className="studio-future-badge-grid">{badgeData.data.catalogue.map((badge) => {
            const action = catalogueAction(badge, selected, discordInvite);
            return <article className={"studio-future-badge" + (badge.earned ? " is-earned" : "")} key={badge.slug}>
              <BadgeArtwork slug={badge.slug} size={38}/>
              <div className="studio-badge-card-copy"><strong>{badge.name}</strong><p>{badge.description}</p><small>{badge.earned ? "Earned" : badge.award_mode === "future" ? "Future reward" : badge.award_mode === "manual" ? "Staff awarded" : "Automatic reward"} · {badge.rarity}</small></div>
              {action.kind === "link" && <Link className="button small studio-badge-action" href={action.href}>{action.label}</Link>}
              {action.kind === "external" && <a className="button small studio-badge-action" href={action.href} target="_blank" rel="noopener noreferrer">{action.label}</a>}
              {action.kind === "status" && <span className={"studio-badge-action-status" + (action.label === "Earned" ? " is-earned" : "")}>{action.label}</span>}
            </article>;
          })}</div>
        </section>
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
        <div className="studio-custom-badge-actions">
          <Link className="button small" href={studioHref("/studio/plan", selected)}>Purchase</Link>
          <StudioCustomBadgePreview/>
        </div>
        {customBadges.data.length >= customLimit ? <p className="muted">Custom badge slots are included with selected Snoozer Premium plans. The Purchase link opens your available plans; it does not charge for an individual badge.</p> : <form action={createCustomBadge} className="studio-custom-badge-create">
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
