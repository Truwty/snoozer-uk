import { publicDomainContext } from "@/lib/domain-context";
import { receiveAnalytics } from "@/lib/analytics";
import { attributionForConsentVersion } from "@/lib/analytics-context";
import { browserKey } from "@/lib/analytics-browser-server";
import { siteUrl } from "@/lib/env";
import { sessionClient, storageAdmin } from "@/lib/supabase";

export async function POST(request: Request) {
  const domain = publicDomainContext(request, siteUrl().origin);
  return receiveAnalytics(request, domain ? "https://" + domain.host : siteUrl().origin, async (event) => {
    const client = await sessionClient();
    const { data, error: authError } = await client.auth.getUser();
    if (authError && (authError.status === 0 || (authError.status ?? 0) >= 500)) throw new Error("Auth unavailable");
    const context = attributionForConsentVersion(event, request.headers.get("user-agent") ?? "");
    const { error } = await storageAdmin().rpc("record_profile_event_with_browser", {
      p_username: event.username, p_event: event.id, p_kind: event.kind, p_actor: data.user?.id ?? null,
      p_position: event.kind === "click" ? event.position : null,
      p_url: event.kind === "click" ? event.url : null,
      p_source: context.source, p_campaign: context.campaign, p_device: context.device,
      p_browser_key: browserKey(event),
    });
    if (error) throw new Error("Analytics unavailable");
  }, domain?.username);
}
