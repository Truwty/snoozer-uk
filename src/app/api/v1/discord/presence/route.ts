import { publicDomainContext } from "@/lib/domain-context";
import { discordPresencePublic } from "@/lib/discord-presence";
import { siteUrl } from "@/lib/env";
import { username } from "@/lib/profile";
import { storageAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (process.env.DISCORD_PRESENCE_ENABLED !== "true") return Response.json({ error: "Presence is not enabled." }, { status: 404, headers: { "Cache-Control": "no-store" } });
  const url = new URL(request.url);
  const name = username.safeParse(url.searchParams.get("username"));
  if (!name.success) return Response.json({ error: "Profile not found." }, { status: 400, headers: { "Cache-Control": "no-store" } });

  const domain = publicDomainContext(request, siteUrl().origin);
  if (domain && domain.username !== name.data) {
    return Response.json({ error: "Profile not found." }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }

  try {
    const { data, error } = await storageAdmin().rpc("discord_presence_public", { p_username: name.data });
    if (error) return Response.json({ error: "Presence unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });
    if (data === null) return Response.json({ error: "Presence is not enabled." }, { status: 404, headers: { "Cache-Control": "no-store" } });
    const result = discordPresencePublic.safeParse(data);
    if (!result.success) return Response.json({ error: "Presence unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });
    return Response.json(result.data, { headers: { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" } });
  } catch {
    return Response.json({ error: "Presence unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
