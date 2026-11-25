import { ImageResponse } from "next/og";
import { socialCardColours as colours } from "@/lib/tokens";

export const alt = "Snoozer — Everything you share. One Snoozer link.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    <div style={{
      width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between",
      padding: 72, background: colours.background, color: colours.text,
    }}>
      <div style={{ display: "flex", fontSize: 32, color: colours.accent, fontWeight: 700 }}>snoozer.uk</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "flex", fontSize: 82, fontWeight: 700, lineHeight: 1.05 }}>Everything you share.</div>
        <div style={{ display: "flex", fontSize: 76, fontWeight: 700, lineHeight: 1.05, color: colours.accent }}>One Snoozer link.</div>
        <div style={{ display: "flex", fontSize: 30, color: colours.muted }}>Your socials, photos and projects. All in one profile.</div>
      </div>
      <div style={{ display: "flex", fontSize: 28, color: colours.muted }}>Your page. Your style.</div>
    </div>,
    { ...size },
  );
}
