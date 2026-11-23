import { createHash } from "node:crypto";
import { z } from "zod";
import { readPublished } from "@/lib/profiles-server";
import { username as usernameSchema } from "@/lib/profile";
import { publicDomainContext } from "@/lib/domain-context";
import { siteUrl } from "@/lib/env";
import { storageAdmin } from "@/lib/supabase";
import { boundedBody } from "@/lib/bounded-request";

export const dynamic = "force-dynamic";
const submitSchema = z.strictObject({
  username: usernameSchema, displayName: z.string().trim().min(1).max(80),
  message: z.string().trim().min(3).max(500), visitorToken: z.uuid(), website: z.string().max(200).optional(),
});
const reply = (body: unknown, status = 200) => Response.json(body, {
  status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
});
function expectedOrigin(request: Request) {
  const domain = publicDomainContext(request, siteUrl().origin);
  return { domain, origin: domain ? "https://" + domain.host : siteUrl().origin };
}
function tokenHash(token: string) { return createHash("sha256").update(token).digest("hex"); }

export async function GET(request: Request) {
  const url = new URL(request.url);
  const name = usernameSchema.safeParse(url.searchParams.get("username"));
  if (!name.success) return reply({ error: "Invalid profile." }, 400);
  const { domain } = expectedOrigin(request);
  if (domain && domain.username !== name.data) return reply({ error: "Profile unavailable." }, 404);
  try {
    const profile = await readPublished(name.data);
    if (!profile?.widgets.guestbook.enabled) return reply({ entries: [] });
    const { data, error } = await storageAdmin().rpc("get_public_guestbook_entries", {
      p_username: name.data, p_limit: profile.widgets.guestbook.maxEntries,
    });
    if (error) return reply({ error: "Guestbook unavailable." }, 503);
    return reply({ entries: data ?? [] });
  } catch {
    return reply({ error: "Guestbook unavailable." }, 503);
  }
}

export async function POST(request: Request) {
  const { domain, origin } = expectedOrigin(request);
  if (request.headers.get("origin") !== origin) return reply({ error: "Origin denied." }, 403);
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") return reply({ error: "JSON required." }, 415);
  let raw: unknown;
  try {
    const body = await boundedBody(request, 4096);
    if (!body) return reply({ error: "Request too large." }, 413);
    raw = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
  } catch { return reply({ error: "Invalid request." }, 400); }
  const parsed = submitSchema.safeParse(raw);
  if (!parsed.success) return reply({ error: "Check your name and message." }, 400);
  if (parsed.data.website?.trim()) return reply({ accepted: true }, 202);
  if (domain && domain.username !== parsed.data.username) return reply({ error: "Profile unavailable." }, 404);
  try {
    const { data, error } = await storageAdmin().rpc("submit_profile_guestbook_entry", {
      p_username: parsed.data.username, p_display_name: parsed.data.displayName,
      p_message: parsed.data.message, p_visitor_hash: tokenHash(parsed.data.visitorToken),
    });
    if (error?.code === "P2012" || error?.code === "P2013") return reply({ error: "Guestbook submission limit reached." }, 429);
    if (error?.code === "P2011") return reply({ error: "Guestbook unavailable." }, 404);
    if (error) return reply({ error: "Submission unavailable." }, 503);
    return reply({ accepted: true, id: data }, 201);
  } catch { return reply({ error: "Submission unavailable." }, 503); }
}
