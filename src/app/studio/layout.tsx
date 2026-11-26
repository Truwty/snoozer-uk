import type { ReactNode } from "react";
import { StudioSidebar } from "@/components/studio-sidebar";
import { StudioAccountControl } from "@/components/studio-account-control";
import { readStudioDraft } from "@/lib/profiles-server";
import { sessionClient } from "@/lib/supabase";
import { accountLocale, type AccountLocale } from "@/lib/account-locale";
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
  let locale:AccountLocale="en-US";
  try{
    const client=await sessionClient();
    const {data}=await client.auth.getUser();
    locale=accountLocale(data.user?.user_metadata?.snoozer_locale);
  }catch{
    // Keep the dashboard available if authentication metadata cannot be read.
  }

  return <div className="studio-root">
    <StudioSidebar
      locale={locale}
      pageHref={draft ? "/" + draft.username : undefined}
      pagePublished={published}
      accountFooter={<StudioAccountControl/>}
    />
    <div className="studio-main">
      <div className="studio-main-content">{children}</div>
    </div>
  </div>;
}
