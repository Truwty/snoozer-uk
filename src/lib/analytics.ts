import { z } from "zod";
import { boundedBody } from "./bounded-request";
import { username, safeLink, link } from "./profile";
import { trafficDevices, trafficSources } from "./analytics-context";

export type AnalyticsRange = "3d" | "7d" | "30d" | "all";

export function parseAnalyticsRange(value: string | string[] | undefined): AnalyticsRange {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate === "3d" || candidate === "7d" || candidate === "30d" || candidate === "all" ? candidate : "7d";
}

export function analyticsRangeStart(range: Exclude<AnalyticsRange, "all">, now = new Date()) {
  const days = range === "3d" ? 3 : range === "7d" ? 7 : 30;
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (days - 1)));
  return start.toISOString().slice(0, 10);
}

const attribution = { version: z.union([z.literal(2), z.literal(3)]).optional(), source: z.enum(trafficSources).optional(), campaign: z.uuid().optional(),
  browser: z.uuidv4().optional(), browserDay: z.iso.date().optional() };

export const analyticsEvent = z.discriminatedUnion("kind", [
  z.object({ username, id: z.uuid(), consent: z.literal(true), kind: z.literal("view"), ...attribution }).strict(),
  z.object({ username, id: z.uuid(), consent: z.literal(true), kind: z.literal("click"),
    position: z.number().int().min(1).max(2000), url: z.string().max(2048).refine(safeLink), ...attribution }).strict(),
]).refine((event) => (!event.browser && !event.browserDay) || (event.version === 3 && !!event.browser && !!event.browserDay));
export type AnalyticsEvent = z.infer<typeof analyticsEvent>;
export const dailyAnalytics = z.array(z.object({
  day: z.iso.date(), views: z.number().int().min(0).max(10000), clicks: z.number().int().min(0).max(10000),
}));
export const browserAnalytics = z.array(z.object({
  day: z.iso.date(), unique_browsers: z.number().int().min(0).max(10000), clicked_browsers: z.number().int().min(0).max(10000),
}).refine((row) => row.clicked_browsers <= row.unique_browsers));
export function browserCtr(unique: number, clicked: number) {
  return unique > 0 ? (clicked / unique * 100).toFixed(1) + "%" : "—";
}
export function browserAnalyticsCsv(rows: z.infer<typeof browserAnalytics>) {
  return "date_utc,daily_browsers,clicked_browsers,browser_ctr_percent\r\n" + rows.map((row) =>
    `${row.day},${row.unique_browsers},${row.clicked_browsers},${row.unique_browsers > 0 ? (row.clicked_browsers / row.unique_browsers * 100).toFixed(1) : ""}\r\n`).join("");
}
export const linkAnalytics = z.array(link.extend({ clicks: z.number().int().nonnegative().safe() })).max(100);
export const analyticsCampaigns = z.array(z.object({ id: z.uuid(), label: z.string().min(1).max(80), active: z.boolean() })).max(20);
export const trafficAnalytics = z.array(z.object({
  campaign: z.uuid().nullable(), label: z.string().min(1).max(80), source: z.enum(trafficSources), device: z.enum(trafficDevices),
  views: z.number().int().nonnegative().safe(), clicks: z.number().int().nonnegative().safe(),
})).max(1000);
export const overviewDeviceAnalytics = z.array(z.object({
  device: z.enum(trafficDevices), views: z.number().int().nonnegative().safe(),
})).max(4);

export async function receiveAnalytics(request: Request, origin: string, record: (event: AnalyticsEvent) => Promise<void>, boundUsername?: string) {
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
  if (boundUsername && parsed.data.username !== boundUsername) return reply(403);
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

export function trafficAnalyticsCsv(rows: z.infer<typeof trafficAnalytics>) {
  return "campaign,source,device,views,clicks\r\n" + rows.map((row) =>
    `${csvText(row.label)},${row.source},${row.device},${row.views},${row.clicks}\r\n`).join("");
}
