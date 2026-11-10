import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { siteUrl } from "@/lib/env";
import "./styles.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: { default: "Snoozer — A place to be yourself", template: "%s · Snoozer" },
  description: "A personal page for the links, work and projects you want to share.",
};

export const viewport: Viewport = { themeColor: "#111116", viewportFit: "cover" };

export default function Layout({ children }: { children: ReactNode }) {
  return <html lang="en-GB"><body>{children}</body></html>;
}
