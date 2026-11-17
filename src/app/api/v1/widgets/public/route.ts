import { receivePublicWidget } from "@/lib/public-widget";
import { fetchWidgetMetadata } from "@/lib/widget-provider";
import { readPublished } from "@/lib/profiles-server";
import { siteUrl } from "@/lib/env";
import { storageAdmin } from "@/lib/supabase";

export async function POST(request: Request) {
  return receivePublicWidget(request, siteUrl().origin, {
    async getLink(username, position) {
      const profile = await readPublished(username);
      return profile?.links[position - 1]?.url ?? null;
    },
    async claim(provider, resource) {
      const { data, error } = await storageAdmin().rpc("claim_public_widget", { p_provider: provider, p_resource: resource });
      if (error) throw new Error("Widget cache unavailable.");
      return data;
    },
    async complete(provider, resource, lease, payload, retryAfter) {
      const { data, error } = await storageAdmin().rpc("complete_public_widget", {
        p_provider: provider, p_resource: resource, p_lease: lease, p_payload: payload, p_retry_after: retryAfter,
      });
      if (error) throw new Error("Widget cache unavailable.");
      return data === true;
    },
    fetchMetadata: fetchWidgetMetadata,
  });
}
