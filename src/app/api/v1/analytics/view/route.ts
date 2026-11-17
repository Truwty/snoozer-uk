import { receiveAnalytics } from "@/lib/analytics";
import { attributionForConsentVersion } from "@/lib/analytics-context";
import { siteUrl } from "@/lib/env";
import { sessionClient, storageAdmin } from "@/lib/supabase";

export async function POST(request: Request) {
  return receiveAnalytics(request, siteUrl().origin, async (event) => {
    const client = await sessionClient();
    const { data, error: authError } = await client.auth.getUser();
    if (authError && (authError.status === 0 || (authError.status ?? 0) >= 500)) throw new Error("Auth unavailable");
    const context = attributionForConsentVersion(event, request.headers.get("user-agent") ?? "");
    const { error } = await storageAdmin().rpc("record_profile_event_with_context", {
      p_username: event.username, p_event: event.id, p_kind: event.kind, p_actor: data.user?.id ?? null,
      p_position: event.kind === "click" ? event.position : null,
      p_url: event.kind === "click" ? event.url : null,
      p_source: context.source, p_campaign: context.campaign, p_device: context.device,
    });
    if (error) throw new Error("Analytics unavailable");
  });
}
