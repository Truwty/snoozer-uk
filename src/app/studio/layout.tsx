import type { ReactNode } from "react";
import { SiteHeader } from "@/components/site-header";

export default function StudioLayout({ children }: { children: ReactNode }) {
  return <div className="studio-root"><div className="shell studio-shell"><SiteHeader /></div>{children}</div>;
}
