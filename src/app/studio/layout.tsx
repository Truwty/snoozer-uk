import type { ReactNode } from "react";
import Link from "next/link";
import { StudioSidebar } from "@/components/studio-sidebar";
import { StudioAccountControl } from "@/components/studio-account-control";
import { StudioCommandPalette } from "@/components/studio-command-palette";
import { readStudioDraft } from "@/lib/profiles-server";
import "./studio-dashboard.css";
import "./studio-dashboard-extra.css";
import "./studio-video-fidelity.css";
import "./studio-video-screens.css";
import "./studio-command-palette.css";

export default async function StudioLayout({ children }: { children: ReactNode }) {
  const draft = await readStudioDraft(undefined);
  const published = Boolean(draft && draft.published_revision !== null);
  const status = !published ? "Draft mode"
    : draft && draft.revision === draft.published_revision ? "Profile live"
    : "Unpublished changes";

  return <div className="studio-root">
    <StudioSidebar
      pageHref={draft ? "/" + draft.username : undefined}
      pagePublished={published}
      accountFooter={<StudioAccountControl/>}
    />
    <div className="studio-main">
      <header className="studio-app-topbar">
        <div className="studio-app-title">
          <p className="eyebrow">YOUR WORKSPACE</p>
          <strong>Snoozer Studio</strong>
        </div>
        <div className="studio-topbar-actions">
          <StudioCommandPalette/>
          <span className={"studio-profile-state" + (published ? " is-live" : "")}>
            <i aria-hidden="true"/>{status}
          </span>
          <Link className="studio-topbar-help" href="/help">Help Centre <span aria-hidden="true">↗</span></Link>
          {published && draft && <Link className="studio-topbar-preview" href={"/" + draft.username} target="_blank" rel="noreferrer">View page ↗</Link>}
        </div>
      </header>
      <div className="studio-main-content">{children}</div>
    </div>
  </div>;
}
