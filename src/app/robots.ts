import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/env";

export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/auth/", "/studio", "/api/", "/reset-password", "/forgot-password", "/sign-in", "/sign-up", "/store/"] },
    sitemap: new URL("/sitemap.xml", siteUrl()).href,
  };
}
