import { ImageResponse } from "next/og";
import { readPublished } from "@/lib/profiles-server";
import { socialCardColours as colours } from "@/lib/tokens";

export const runtime = "nodejs";
export async function GET(_: Request, { params }: { params: Promise<{ username: string }> }) {
  const profile = await readPublished((await params).username);
  if (!profile) return new Response(null, { status: 404 });
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", padding: 72, background: colours.background, color: colours.text }}>
      <div style={{ display: "flex", fontSize: 30, color: colours.accent }}>snoozer.uk</div>
      <div style={{ display: "flex", flexGrow: 1, alignItems: "center", fontSize: 64, fontWeight: 700, lineHeight: 1.1 }}>{profile.seo.title || profile.display_name}</div>
      <div style={{ display: "flex", fontSize: 28, color: colours.muted }}>@{profile.username}</div>
    </div>,
    { width: 1200, height: 630, headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" } },
  );
}
