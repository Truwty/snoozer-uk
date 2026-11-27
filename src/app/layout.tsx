import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { siteUrl } from "@/lib/env";
import { browserThemeColour } from "@/lib/tokens";
import { CookieConsent } from "@/components/cookie-consent";
import { sessionClient } from "@/lib/supabase";
import { accountLocale } from "@/lib/account-locale";
import { supabaseUrl, supabaseKey } from "@/lib/env";
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

export default async function Layout({ children }: { children: ReactNode }) {
  let locale = "en-US";
  if (supabaseUrl && supabaseKey) {
    try {
      const client = await sessionClient();
      const { data } = await client.auth.getUser();
      locale = accountLocale(data.user?.user_metadata?.snoozer_locale);
    } catch {
      // Public pages remain available with the default document language.
    }
  }
  return <html lang={locale}><body>{children}<CookieConsent /></body></html>;
}
