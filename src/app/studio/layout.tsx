import type { ReactNode } from "react";
import { StudioSidebar } from "@/components/studio-sidebar";
import { StudioAccountControl } from "@/components/studio-account-control";
import { readStudioDraft } from "@/lib/profiles-server";
import "../discovery-shared.css";
import "../discovery-form-controls.css";
import "./studio-discovery.css";
import "./studio-shared.css";
import "./studio-dashboard.css";
import "./studio-dashboard-extra.css";
import "./studio-video-fidelity.css";
import "./studio-video-screens.css";
import "./studio-command-palette.css";
import "./audio/audio-library.css";

export default async function StudioLayout({ children }: { children: ReactNode }) {
  const draft = await readStudioDraft(undefined);
  const published = Boolean(draft && draft.published_revision !== null);

  return <div className="studio-root">
    <StudioSidebar
      pageHref={draft ? "/" + draft.username : undefined}
      pagePublished={published}
      accountFooter={<StudioAccountControl/>}
    />
    <div className="studio-main">
      <div className="studio-main-content">{children}</div>
    </div>
  </div>;
}
