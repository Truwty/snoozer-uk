import { z } from "zod";
import { boundedBody } from "./bounded-request";
import { username } from "./profile";
import { metadataProviders, metadataWidget, widgetMetadata, type MetadataProvider, type WidgetMetadata } from "./widgets";
import { WidgetBackoff, type WidgetFetchResult } from "./widget-provider";

const requestSchema = z.object({
  username, position: z.number().int().min(1).max(2000), provider: z.enum(metadataProviders), consent: z.literal(true),
}).strict();
const claimSchema = z.discriminatedUnion("state", [
  z.object({ state: z.literal("cached"), payload: widgetMetadata }),
  z.object({ state: z.literal("refresh"), lease: z.uuid() }),
  z.object({ state: z.enum(["pending", "limited", "unavailable"]), retry_after: z.number().int().min(1).max(86400).optional() }),
]);
type Dependencies = {
  getLink: (username: string, position: number) => Promise<string | null>;
  claim: (provider: MetadataProvider, resource: string) => Promise<unknown>;
  complete: (provider: MetadataProvider, resource: string, lease: string, data: WidgetMetadata | null, retryAfter: number) => Promise<boolean>;
  fetchMetadata: (provider: MetadataProvider, resource: string) => Promise<WidgetFetchResult>;
};

export async function receivePublicWidget(request: Request, origin: string, dependencies: Dependencies) {
  const reply = (status: number, data?: WidgetMetadata, retryAfter?: number) => new Response(data ? JSON.stringify(data) : null, {
    status, headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
      ...(data && { "Content-Type": "application/json" }), ...(retryAfter && { "Retry-After": String(retryAfter) }) },
  });
  if (request.headers.get("origin") !== origin) return reply(403);
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") return reply(415);
  let payload: unknown;
  try {
    const body = await boundedBody(request, 512);
    if (!body) return reply(413);
    payload = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
  } catch { return reply(400); }
  const input = requestSchema.safeParse(payload);
  if (!input.success) return reply(400);
  try {
    const url = await dependencies.getLink(input.data.username, input.data.position);
    if (!url) return reply(404);
    const widget = metadataWidget(url);
    if (!widget || widget.provider !== input.data.provider) return reply(400);
    const claimed = claimSchema.parse(await dependencies.claim(widget.provider, widget.resource));
    if (claimed.state === "cached") {
      if (claimed.payload.provider !== widget.provider || claimed.payload.resource !== widget.resource) return reply(503);
      return reply(200, claimed.payload);
    }
    if (claimed.state !== "refresh") return reply(claimed.state === "limited" ? 429 : 503, undefined, claimed.retry_after ?? 300);

    let data: WidgetMetadata | null = null;
    let delay = 0;
    try {
      const fetched = await dependencies.fetchMetadata(widget.provider, widget.resource);
      data = widgetMetadata.parse(fetched.metadata);
      delay = z.number().int().min(0).max(86400).parse(fetched.retryAfter);
      if (data.provider !== widget.provider || data.resource !== widget.resource) data = null;
    } catch (error) { delay = error instanceof WidgetBackoff ? error.seconds : 0; }
    const saved = await dependencies.complete(widget.provider, widget.resource, claimed.lease, data, delay);
    if (!saved || !data) return reply(503, undefined, delay || 300);
    return reply(200, data);
  } catch { return reply(503); }
}
