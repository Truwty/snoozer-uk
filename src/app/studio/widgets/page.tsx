import { StudioEditorPage } from "@/components/studio-editor-page";
import type { StudioProfileQuery } from "@/lib/profiles-server";

export const metadata = { title: "Widgets", robots: { index: false, follow: false } };

export default function Page({ searchParams }: { searchParams: Promise<StudioProfileQuery> }) {
  return <StudioEditorPage searchParams={searchParams} mode="widgets"/>;
}
