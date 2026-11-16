import Link from "next/link";
import { redirect } from "next/navigation";
import { Brand } from "@/components/shell";
import { ClaimForm } from "@/components/claim-form";
import { CopyLink } from "@/components/copy-link";
import { DeleteProfile } from "@/components/delete-profile";
import { Editor } from "@/components/editor";
import { Unpublish } from "@/components/unpublish";
import { AvatarUpload } from "@/components/avatar-upload";
import { supabaseUrl, supabaseKey } from "@/lib/env";
import { readStudioDraft, studioHref, type StudioProfileQuery } from "@/lib/profiles-server";
import { sessionClient } from "@/lib/supabase";
import { accountPlan } from "@/lib/entitlements";
import { freeProfileLinkLimit, maximumProfileLinkLimit } from "@/lib/profile";
import { studioTemplates } from "@/lib/studio-templates";
import { signOut } from "../auth/actions";

export const metadata = { title: "Studio", robots: { index: false, follow: false } };

export default async function Page({ searchParams }: { searchParams: Promise<StudioProfileQuery & { logout?: string; deleted?: string; restored?: string; template?: string }> }) {
  if (!supabaseUrl || !supabaseKey) redirect("/sign-in");
  const { profile, logout, deleted, restored, template } = await searchParams;
  const draft = await readStudioDraft(profile);
  const selected = profile === undefined ? undefined : draft?.profile_id;
  const response = draft && await (await sessionClient()).rpc("get_my_plan");
  const plan = accountPlan.safeParse(response?.data);
  const linkLimit = plan.success ? Math.min(plan.data.quotas.links, maximumProfileLinkLimit) : freeProfileLinkLimit;
  return <main className="shell">
    <header className="nav"><Brand /><form action={signOut}><button className="button small">Sign out</button></form></header>
    {logout === "failed" && <p role="alert">Couldn’t sign out. Try again.</p>}
    {deleted === "1" && <p role="status">Your profile was deleted. Its images are queued for removal.</p>}
    {!draft ? <section className="panel claim-panel stack">
      <p className="eyebrow">STUDIO / ONBOARDING</p>
      <h1>Claim your address</h1>
      <p className="muted">Pick the username people will use to find your page.</p>
      <ClaimForm />
    </section> : <>
      <header className="studio-heading">
        <div><p className="eyebrow">YOUR WORKSPACE</p><h1>Studio</h1><p className="muted">@{draft.username}</p></div>
        <div className="stack status-panel">
          <Link className="button small" href={studioHref("/studio/gallery", selected)}>Image gallery</Link>
          <Link className="button small" href={studioHref("/studio/history", selected)}>Publish history</Link>
          <Link className="button small" href={studioHref("/studio/plan", selected)}>Plan and usage</Link>
          <p className="status-label">{draft.published_revision === null ? "Offline · Draft only"
            : draft.revision === draft.published_revision ? "Live · Up to date" : "Live · Unpublished changes"}</p>
          {draft.published_revision !== null && <div className="actions">
            <Link className="button small" href={`/${draft.username}`}>View live page ↗</Link>
            <CopyLink path={`/${draft.username}`} />
            <Unpublish profileId={draft.profile_id} revision={draft.revision} />
          </div>}
        </div>
      </header>
      <section className="panel avatar-panel">
        <h2>Avatar</h2>
        <AvatarUpload profileId={draft.profile_id} revision={draft.revision} />
      </section>
      {restored === "1" && <p role="status">Version restored to your draft.</p>}
      <Editor key={draft.profile_id} draft={draft} linkLimit={linkLimit} galleryHref={studioHref("/studio/gallery", selected)}
        initialTemplateId={studioTemplates.find(({ id }) => id === template)?.id} />
      <DeleteProfile profileId={draft.profile_id} username={draft.username} revision={draft.revision} />
    </>}
  </main>;
}
