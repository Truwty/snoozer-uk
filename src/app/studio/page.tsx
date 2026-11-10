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
import { readDraft } from "@/lib/profiles-server";
import { signOut } from "../auth/actions";

export const metadata = { title: "Studio", robots: { index: false, follow: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ logout?: string; deleted?: string; restored?: string }> }) {
  if (!supabaseUrl || !supabaseKey) redirect("/sign-in");
  const draft = await readDraft();
  const { logout, deleted, restored } = await searchParams;
  return <main className="shell">
    <header className="nav"><Brand /><form action={signOut}><button className="button small">Sign out</button></form></header>
    {logout === "failed" && <p role="alert">Couldn’t sign out. Try again.</p>}
    {!draft ? <section className="panel claim-panel stack">
      <p className="eyebrow">STUDIO / ONBOARDING</p>
      <h1>Claim your address</h1>
      <p className="muted">Pick the username people will use to find your page.</p>
      {deleted === "1" && <p role="status">Your profile was deleted. Its images are queued for removal.</p>}
      <ClaimForm />
    </section> : <>
      <header className="studio-heading">
        <div><p className="eyebrow">YOUR WORKSPACE</p><h1>Studio</h1><p className="muted">@{draft.username}</p></div>
        <div className="stack status-panel">
          <Link className="button small" href="/studio/history">Publish history</Link>
          <p className="status-label">{draft.published_revision === null ? "Offline · Draft only"
            : draft.revision === draft.published_revision ? "Live · Up to date" : "Live · Unpublished changes"}</p>
          {draft.published_revision !== null && <div className="actions">
            <Link className="button small" href={`/${draft.username}`}>View live page ↗</Link>
            <CopyLink path={`/${draft.username}`} />
            <Unpublish revision={draft.revision} />
          </div>}
        </div>
      </header>
      <section className="panel avatar-panel">
        <h2>Avatar</h2>
        <AvatarUpload revision={draft.revision} />
      </section>
      {restored === "1" && <p role="status">Version restored to your draft.</p>}
      <Editor key={draft.username} draft={draft} />
      <DeleteProfile username={draft.username} revision={draft.revision} />
    </>}
  </main>;
}
