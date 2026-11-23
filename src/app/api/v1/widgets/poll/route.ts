import { createHash } from "node:crypto";
import { z } from "zod";
import { readPublished } from "@/lib/profiles-server";
import { username as usernameSchema } from "@/lib/profile";
import { publicDomainContext } from "@/lib/domain-context";
import { siteUrl } from "@/lib/env";
import { storageAdmin } from "@/lib/supabase";
import { boundedBody } from "@/lib/bounded-request";

export const dynamic = "force-dynamic";
const paramsSchema = z.object({ username: usernameSchema, pollId: z.uuid(), visitorToken: z.uuid().optional() });
const voteSchema = z.strictObject({
  username: usernameSchema, pollId: z.uuid(), optionId: z.uuid(), visitorToken: z.uuid(),
});
const reply = (body: unknown, status = 200) => Response.json(body, {
  status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
});
function requestContext(request: Request) {
  const domain = publicDomainContext(request, siteUrl().origin);
  return { domain, origin: domain ? "https://" + domain.host : siteUrl().origin };
}
function tokenHash(token: string) { return createHash("sha256").update(token).digest("hex"); }

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = paramsSchema.safeParse({ username: url.searchParams.get("username"), pollId: url.searchParams.get("pollId"), visitorToken: url.searchParams.get("visitorToken") ?? undefined });
  if (!parsed.success) return reply({ error: "Invalid poll." }, 400);
  const { domain } = requestContext(request);
  if (domain && domain.username !== parsed.data.username) return reply({ error: "Poll unavailable." }, 404);
  try {
    const profile = await readPublished(parsed.data.username);
    if (!profile?.widgets.poll.enabled || profile.widgets.poll.id !== parsed.data.pollId) return reply({ error: "Poll unavailable." }, 404);
    const { data, error } = await storageAdmin().rpc("get_public_poll_results", {
      p_username: parsed.data.username, p_poll: parsed.data.pollId,
      p_visitor_hash: parsed.data.visitorToken ? tokenHash(parsed.data.visitorToken) : null,
    });
    if (error) return reply({ error: "Poll results unavailable." }, 503);
    if (!data) return reply({ error: "Vote before viewing results." }, 403);
    return reply(data);
  } catch { return reply({ error: "Poll results unavailable." }, 503); }
}

export async function POST(request: Request) {
  const { domain, origin } = requestContext(request);
  if (request.headers.get("origin") !== origin) return reply({ error: "Origin denied." }, 403);
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") return reply({ error: "JSON required." }, 415);
  let raw: unknown;
  try {
    const body = await boundedBody(request, 4096);
    if (!body) return reply({ error: "Request too large." }, 413);
    raw = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
  } catch { return reply({ error: "Invalid request." }, 400); }
  const parsed = voteSchema.safeParse(raw);
  if (!parsed.success) return reply({ error: "Invalid vote." }, 400);
  if (domain && domain.username !== parsed.data.username) return reply({ error: "Poll unavailable." }, 404);
  try {
    const profile = await readPublished(parsed.data.username);
    const poll = profile?.widgets.poll;
    if (!poll?.enabled || poll.id !== parsed.data.pollId || !poll.options.some(({ id }) => id === parsed.data.optionId))
      return reply({ error: "Poll unavailable." }, 404);
    const { data, error } = await storageAdmin().rpc("submit_public_poll_vote", {
      p_username: parsed.data.username, p_poll: parsed.data.pollId,
      p_option: parsed.data.optionId, p_visitor_hash: tokenHash(parsed.data.visitorToken),
    });
    if (error?.code === "P2021") return reply({ error: "This poll has closed." }, 410);
    if (error?.code === "P2020") return reply({ error: "Poll unavailable." }, 404);
    if (error) return reply({ error: "Vote unavailable." }, 503);
    if (!data?.accepted) return reply({ error: "A vote is already recorded.", results: data }, 409);
    return reply(data);
  } catch { return reply({ error: "Vote unavailable." }, 503); }
}
