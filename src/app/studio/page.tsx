import { domainInventory } from "@/lib/domains";
import { domainProviderConfig } from "@/lib/domain-verification";
import { ProfileDomains } from "@/components/profile-domains";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ClaimForm } from "@/components/claim-form";
import { publicationScheduleStatus } from "@/lib/publication-schedule";
import { aliasInventory } from "@/lib/aliases";
import { ProfileAliases } from "@/components/profile-aliases";
import { DeleteProfile } from "@/components/delete-profile";
import { Editor } from "@/components/editor";
import { AvatarUpload } from "@/components/avatar-upload";
import { supabaseUrl, supabaseKey } from "@/lib/env";
import { readStudioDraft, studioHref, type StudioProfileQuery } from "@/lib/profiles-server";
import { sessionClient } from "@/lib/supabase";
import { accountPlan } from "@/lib/entitlements";
import { freeProfileLinkLimit, maximumProfileLinkLimit } from "@/lib/profile";
import { studioTemplates } from "@/lib/studio-templates";

export const metadata = { title: "Studio", robots: { index: false, follow: false } };

export default async function Page({ searchParams }: { searchParams: Promise<StudioProfileQuery & { logout?: string; deleted?: string; restored?: string; template?: string }> }) {
  if (!supabaseUrl || !supabaseKey) redirect("/sign-in");
  const { profile, logout, deleted, restored, template } = await searchParams;
  const draft = await readStudioDraft(profile);
  const selected = profile === undefined ? undefined : draft?.profile_id;
  const client = draft && await sessionClient();
  const [response, aliasResponse, scheduleResponse, domainResponse] = client && draft ? await Promise.all([client.rpc("get_my_plan"), client.rpc("list_my_aliases", { p_profile: draft.profile_id }), client.rpc("get_my_publication_schedule", { p_profile: draft.profile_id }), client.rpc("list_my_domains", { p_profile: draft.profile_id })]) : [];
  const domains = domainInventory.safeParse(domainResponse?.data);
  const domainConfig = domainProviderConfig();
  const aliases = aliasInventory.safeParse(aliasResponse?.data);
  const schedule = publicationScheduleStatus.safeParse(scheduleResponse?.data);
  const plan = accountPlan.safeParse(response?.data);
  const linkLimit = plan.success ? Math.min(plan.data.quotas.links, maximumProfileLinkLimit) : freeProfileLinkLimit;
  return <main className="shell">
    {logout === "failed" && <p role="alert">Couldn’t sign out. Try again.</p>}
    {deleted === "1" && <p role="status">Your profile was deleted. Its images are queued for removal.</p>}
    {!draft ? <section className="panel claim-panel stack">
      <p className="eyebrow">STUDIO / ONBOARDING</p>
      <h1>Claim your address</h1>
      <p className="muted">Pick the username people will use to find your page.</p>
      <ClaimForm />
      <Link href="/studio/growth">Referral choices and Growth</Link>
    </section> : <>
      <header className="studio-heading"><div><p className="eyebrow">YOUR WORKSPACE</p><h1>Studio</h1></div></header>
      <nav className="studio-nav" aria-label="Studio navigation">
        <Link href={studioHref("/studio", selected)} aria-current="page">Editor</Link>
        <Link href={studioHref("/studio/gallery", selected)}>Image gallery</Link>
        <Link href={studioHref("/studio/history", selected)}>Publish history</Link>
        <Link href={studioHref("/studio/analytics", selected)}>Analytics</Link>
        <Link href={studioHref("/studio/plan", selected)}>Plan and usage</Link>
        <Link href="/studio/spotify">Spotify embeds</Link>
        <Link href="/studio/growth">Growth</Link><Link href="/account/notifications">Notices</Link><Link href="/account/data">Your data</Link>
      </nav>
      {restored === "1" && <p role="status">Version restored to your draft.</p>}
      <Editor key={draft.profile_id} draft={draft} effectTier={plan.success ? plan.data.plan : "free"} linkLimit={linkLimit} galleryHref={studioHref("/studio/gallery", selected)}
        schedule={schedule.success && !scheduleResponse?.error ? { current: schedule.data.schedule, automatic: schedule.data.automatic, enabled: plan.success && plan.data.capabilities.scheduledPublishing } : undefined}
        initialTemplateId={studioTemplates.find(({ id }) => id === template)?.id}
        avatar={<AvatarUpload profileId={draft.profile_id} revision={draft.revision} />}
        settings={<>{aliases.success ? <ProfileAliases profileId={draft.profile_id} inventory={aliases.data} /> : <p role="alert">Aliases are unavailable. Reload to try again.</p>}{domains.success && !domainResponse?.error ? <ProfileDomains profileId={draft.profile_id} inventory={domains.data} verificationEnabled={!!domainConfig} serviceHost={domainConfig?.serviceHost} /> : <p role="alert">Custom domains are unavailable. Reload to try again.</p>}<DeleteProfile profileId={draft.profile_id} username={draft.username} revision={draft.revision} /></>} />

    </>}
  </main>;
}
