import { z } from "zod";
import { boundedBody } from "./bounded-request";
import { username, safeLink, link } from "./profile";

export const analyticsEvent = z.discriminatedUnion("kind", [
  z.object({ username, id: z.uuid(), consent: z.literal(true), kind: z.literal("view") }).strict(),
  z.object({ username, id: z.uuid(), consent: z.literal(true), kind: z.literal("click"),
    position: z.number().int().min(1).max(2000), url: z.string().max(2048).refine(safeLink) }).strict(),
]);
export type AnalyticsEvent = z.infer<typeof analyticsEvent>;
export const dailyAnalytics = z.array(z.object({
  day: z.iso.date(), views: z.number().int().min(0).max(10000), clicks: z.number().int().min(0).max(10000),
}));
export const linkAnalytics = z.array(link.extend({ clicks: z.number().int().nonnegative().safe() })).max(100);

export async function receiveAnalytics(request: Request, origin: string, record: (event: AnalyticsEvent) => Promise<void>) {
  const reply = (status: number) => new Response(null, { status, headers: { "Cache-Control": "no-store" } });
  if (request.headers.get("origin") !== origin) return reply(403);
  const agent = request.headers.get("user-agent");
  if (!agent || /bot|crawler|spider|headless|preview/i.test(agent) || request.headers.get("sec-gpc") === "1"
    || request.headers.get("dnt") === "1") return reply(204);
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") return reply(415);
  let payload: unknown;
  try {
    const body = await boundedBody(request, 4096);
    if (!body) return reply(413);
    payload = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
  } catch { return reply(400); }
  const parsed = analyticsEvent.safeParse(payload);
  if (!parsed.success) return reply(400);
  try { await record(parsed.data); } catch { return reply(503); }
  return reply(204);
}

export function analyticsCsv(rows: z.infer<typeof dailyAnalytics>) {
  // Only validated dates and integers; no formula-bearing creator input.
  return "date_utc,views,clicks\r\n" + rows.map(({ day, views, clicks }) => `${day},${views},${clicks}\r\n`).join("");
}

function csvText(value: string) {
  const neutral = /^[\s]*[=+\-@]/.test(value) || /^[\t\r\n]/.test(value) ? "'" + value : value;
  return '"' + neutral.replaceAll('"', '""') + '"';
}

export function linkAnalyticsCsv(rows: z.infer<typeof linkAnalytics>) {
  return "label,url,clicks\r\n" + rows.map(({ label, url, clicks }) =>
    `${csvText(label)},${csvText(url)},${clicks}\r\n`).join("");
}
