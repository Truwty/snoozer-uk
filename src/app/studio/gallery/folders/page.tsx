import { redirect } from "next/navigation";
import { studioHref, type StudioProfileQuery } from "@/lib/profiles-server";

export const metadata = { title: "Customize profile", robots: { index: false, follow: false } };

export default async function RemovedGalleryPage({ searchParams }: { searchParams: Promise<StudioProfileQuery> }) {
  const { profile } = await searchParams;
  const selectedProfile = Array.isArray(profile) ? profile[0] : profile;
  redirect(studioHref("/studio/customize", selectedProfile));
}
