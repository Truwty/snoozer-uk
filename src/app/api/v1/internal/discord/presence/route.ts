import { receiveDiscordPresenceInternal } from "@/lib/discord-presence-internal";
import { storageAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = process.env.DISCORD_PRESENCE_INGEST_SECRET ?? "";
  if (secret.length < 64) return new Response(null, { status: 503, headers: { "Cache-Control": "no-store" } });

  return receiveDiscordPresenceInternal(request, secret, {
    async subscriptions() {
      const { data, error } = await storageAdmin().rpc("discord_presence_subscriptions");
      if (error) throw new Error("Presence subscriptions unavailable.");
      return data;
    },
    async heartbeat(connected, guildReady) {
      const { data, error } = await storageAdmin().rpc("discord_presence_heartbeat", {
        p_connected: connected,
        p_guild_ready: guildReady,
      });
      if (error) throw new Error("Presence heartbeat unavailable.");
      return data === true;
    },
    async ingest(event) {
      const { data, error } = await storageAdmin().rpc("discord_presence_ingest", {
        p_event_id: event.eventId,
        p_discord_user_id: event.discordUserId,
        p_status: event.status,
        p_activity: event.activity,
        p_custom_status: event.customStatus,
        p_observed_at: event.observedAt,
      });
      if (error) throw new Error("Presence update unavailable.");
      return data === true;
    },
    async clear(discordUserId, eventId) {
      const { data, error } = await storageAdmin().rpc("discord_presence_clear", {
        p_discord_user_id: discordUserId,
        p_event_id: eventId,
      });
      if (error) throw new Error("Presence cache clear unavailable.");
      return data === true;
    },
  });
}
