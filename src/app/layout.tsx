import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { siteUrl } from "@/lib/env";
import { browserThemeColour } from "@/lib/tokens";
import { CookieConsent } from "@/components/cookie-consent";
import "./styles.css";
import "./badge-restored.css";

export const dynamic = "force-dynamic";


export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: { default: "Snoozer — A place to be yourself", template: "%s · Snoozer" },
  description: "A personal page for the links, work and projects you want to share.",
  alternates: { canonical: siteUrl() },
  openGraph: {
    type: "website", siteName: "Snoozer", locale: "en_GB",
    title: "Snoozer — A place to be yourself",
    description: "A personal page for the links, work and projects you want to share.",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Snoozer — A place to be yourself" }],
  },
  twitter: {
    card: "summary_large_image", title: "Snoozer — A place to be yourself",
    description: "A personal page for the links, work and projects you want to share.",
    images: ["/opengraph-image"],
  },
};

export const viewport: Viewport = { themeColor: browserThemeColour, viewportFit: "cover" };

export default function Layout({ children }: { children: ReactNode }) {
  return <html lang="en-GB"><body>{children}<CookieConsent /></body></html>;
}
