import Link from "next/link";
import { redirect } from "next/navigation";
import { domainInventory } from "@/lib/domains";
import { domainProviderConfig } from "@/lib/domain-verification";
import { publicationScheduleStatus } from "@/lib/publication-schedule";
import { aliasInventory } from "@/lib/aliases";
import { ProfileAliases } from "@/components/profile-aliases";
import { ProfileDomains } from "@/components/profile-domains";
import { ProfileUsernameChange } from "@/components/profile-username-change";
import { DeleteProfile } from "@/components/delete-profile";
import { Editor } from "@/components/editor";
import { AvatarUpload } from "@/components/avatar-upload";
import { readStudioDraft, studioHref, type StudioProfileQuery } from "@/lib/profiles-server";
import { sessionClient } from "@/lib/supabase";
import { accountPlan } from "@/lib/entitlements";
import { freeProfileLinkLimit, maximumProfileLinkLimit } from "@/lib/profile";
import { studioTemplates } from "@/lib/studio-templates";
import { imageHostLiveOffers } from "@/lib/image-host-live-service";
import { z } from "zod";

type Mode = "builder" | "customize" | "links" | "widgets" | "settings";
type Search = StudioProfileQuery & { template?: string; restored?: string };
type Tab = "Profile" | "Design" | "Links" | "Sections" | "Widgets" | "Settings";

const modeConfig: Record<Mode, { title: string; eyebrow: string; description: string; tab: Tab; panelOnly: boolean }> = {
  builder: { title: "Page Builder", eyebrow: "CREATE / PAGE BUILDER", description: "Arrange your page, add content and preview the published result.", tab: "Profile", panelOnly: false },
  customize: { title: "Customize", eyebrow: "DESIGN / APPEARANCE", description: "Fine-tune your profile's visual identity and effects.", tab: "Design", panelOnly: false },
  links: { title: "Links", eyebrow: "CONTENT / SOCIAL LINKS", description: "Manage the destinations visitors can open from your profile.", tab: "Links", panelOnly: false },
  widgets: { title: "Widgets", eyebrow: "CONTENT / INTERACTIVE WIDGETS", description: "Configure the visitor interactions shown on your published profile.", tab: "Widgets", panelOnly: false },
  settings: { title: "Profile settings", eyebrow: "PROFILE / SETTINGS", description: "Manage your username, search visibility, aliases, custom domains and profile lifecycle.", tab: "Settings", panelOnly: true },
};

export async function StudioEditorPage({ searchParams, mode }: { searchParams: Promise<Search>; mode: Mode }) {
  const params = await searchParams;
  const draft = await readStudioDraft(params.profile);
  if (!draft) redirect("/studio");
  const selected = params.profile === undefined ? undefined : draft.profile_id;
  const client = await sessionClient();
  const [response, aliasResponse, scheduleResponse, domainResponse,imageHostStatusResponse,imageHostOffers] = await Promise.all([
    client.rpc("get_my_plan"),
    client.rpc("list_my_aliases", { p_profile: draft.profile_id }),
    client.rpc("get_my_publication_schedule", { p_profile: draft.profile_id }),
    client.rpc("list_my_domains", { p_profile: draft.profile_id }),
    client.rpc("get_my_image_host_status"),
    imageHostLiveOffers(),
  ]);
  const aliases = aliasInventory.safeParse(aliasResponse.data);
  const domains = domainInventory.safeParse(domainResponse.data);
  const schedule = publicationScheduleStatus.safeParse(scheduleResponse.data);
  const plan = accountPlan.safeParse(response.data);
  const linkLimit = plan.success ? Math.min(plan.data.quotas.links, maximumProfileLinkLimit) : freeProfileLinkLimit;
  const template = typeof params.template === "string" ? studioTemplates.find(({ id }) => id === params.template) : undefined;
  const config = modeConfig[mode];
  const domainConfig = domainProviderConfig();
  const imageHostAccess = z.object({active:z.boolean()}).safeParse(imageHostStatusResponse.data);
  const imageHostActive = !imageHostStatusResponse.error&&imageHostAccess.success&&imageHostAccess.data.active;
  const imageHostOffer = imageHostOffers[0]??null;

  return <main className="shell studio-shell studio-editor-page">
    <header className="studio-page-heading">
      <div><p className="eyebrow">{config.eyebrow}</p><h1>{config.title}</h1><p className="muted">{config.description}</p></div>
      <div className="actions studio-page-heading-actions">
        {draft.published_revision !== null && <Link className="button small" href={"/" + draft.username}>View live profile ↗</Link>}
        <Link className="button small" href={studioHref("/studio", selected)}>Overview</Link>
      </div>
    </header>
    {params.restored === "1" && <p className="message" role="status">Version restored to your draft.</p>}
    <Editor key={draft.profile_id + ":" + mode} draft={draft}
      effectTier={plan.success && plan.data.capabilities.advancedEffects ? plan.data.plan : "free"}
      linkLimit={linkLimit}
      imageHostOffer={imageHostOffer} imageHostActive={imageHostActive}
      initialTemplateId={template?.id ?? ""} initialTab={config.tab} panelOnly={config.panelOnly}
      schedule={schedule.success && !scheduleResponse.error
        ? { current: schedule.data.schedule, automatic: schedule.data.automatic, enabled: plan.success && plan.data.capabilities.scheduledPublishing }
        : undefined}
      avatar={<AvatarUpload profileId={draft.profile_id} revision={draft.revision}/>}
      settings={<>
        <ProfileUsernameChange profileId={draft.profile_id} username={draft.username}/>
        {aliases.success && !aliasResponse.error ? <ProfileAliases profileId={draft.profile_id} inventory={aliases.data}/>
          : <p role="alert">Aliases are unavailable. Reload to try again.</p>}
        {domains.success && !domainResponse.error ? <ProfileDomains profileId={draft.profile_id} inventory={domains.data}
          verificationEnabled={!!domainConfig} serviceHost={domainConfig?.serviceHost}/>
          : <p role="alert">Custom domains are unavailable. Reload to try again.</p>}
        <DeleteProfile profileId={draft.profile_id} username={draft.username} revision={draft.revision}/>
      </>}/>
  </main>;
}
