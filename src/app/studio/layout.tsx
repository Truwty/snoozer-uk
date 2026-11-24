import type { ReactNode } from "react";
import { StudioSidebar } from "@/components/studio-sidebar";
import { StudioAccountControl } from "@/components/studio-account-control";

export default function StudioLayout({ children }: { children: ReactNode }) {
  return <div className="studio-root">
    <StudioSidebar/>
    <div className="studio-main">
      <header className="studio-app-topbar">
        <div className="studio-app-title"><p className="eyebrow">YOUR WORKSPACE</p><strong>Snoozer Studio</strong></div>
        <StudioAccountControl/>
      </header>
      <div className="studio-main-content">{children}</div>
    </div>
  </div>;
}
