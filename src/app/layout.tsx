import type { Metadata, Viewport } from "next";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { siteUrl } from "@/lib/env";
import "./styles.css";

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: { default: "Snoozer — A place to be yourself", template: "%s · Snoozer" },
  description: "A personal page for the links, work and projects you want to share.",
};

export const viewport: Viewport = { themeColor: "#111116", viewportFit: "cover" };

export default async function Layout({ children }: { children: ReactNode }) {
  // Next attaches the request nonce to its bootstrap scripts during dynamic rendering.
  await connection();
  return <html lang="en-GB"><body>{children}</body></html>;
}
