import { StudioEditorPage } from "@/components/studio-editor-page";
import type { StudioProfileQuery } from "@/lib/profiles-server";

export const metadata = { title: "Page Builder", robots: { index: false, follow: false } };

export default function Page({ searchParams }: { searchParams: Promise<StudioProfileQuery & { template?: string; restored?: string }> }) {
  return <StudioEditorPage searchParams={searchParams} mode="builder"/>;
}
