import { receiveAnalytics } from "@/lib/analytics";
import { siteUrl } from "@/lib/env";
import { sessionClient, storageAdmin } from "@/lib/supabase";

export async function POST(request: Request) {
  return receiveAnalytics(request, siteUrl().origin, async (event) => {
    const client = await sessionClient();
    const { data, error: authError } = await client.auth.getUser();
    if (authError && (authError.status === 0 || (authError.status ?? 0) >= 500)) throw new Error("Auth unavailable");
    const { error } = await storageAdmin().rpc("record_profile_event", {
      p_username: event.username, p_event: event.id, p_kind: event.kind, p_actor: data.user?.id ?? null,
      p_position: event.kind === "click" ? event.position : null,
      p_url: event.kind === "click" ? event.url : null,
    });
    if (error) throw new Error("Analytics unavailable");
  });
}
