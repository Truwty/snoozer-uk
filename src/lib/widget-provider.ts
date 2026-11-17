import { z } from "zod";
import { boundedBody } from "./bounded-request";
import { widgetMetadata, type MetadataProvider, type WidgetMetadata } from "./widgets";

export class WidgetBackoff extends Error {
  constructor(readonly seconds: number) { super("Provider temporarily rate limited."); }
}

function retrySeconds(response: Response, minimum = 60, bodyRetry = 0) {
  const retry = response.headers.get("retry-after");
  const seconds = retry && /^\d+(?:\.\d+)?$/.test(retry) ? Number(retry)
    : retry ? (Date.parse(retry) - Date.now()) / 1000 : 0;
  const reset = Number(response.headers.get("x-ratelimit-reset"));
  const remaining = response.headers.get("x-ratelimit-remaining");
  const resetAfter = Number(response.headers.get("x-ratelimit-reset-after"));
  return Math.min(86400, Math.max(minimum, Number.isFinite(seconds) ? Math.ceil(seconds) : 0,
    Number.isFinite(bodyRetry) ? Math.ceil(bodyRetry) : 0,
    remaining === "0" && resetAfter > 0 ? Math.ceil(resetAfter) : 0,
    remaining === "0" && reset > 0 ? Math.ceil(reset - Date.now() / 1000) : 0));
}

export type WidgetFetchResult = { metadata: WidgetMetadata; retryAfter: number };
export async function fetchWidgetMetadata(provider: MetadataProvider, resource: string, fetcher: typeof fetch = fetch): Promise<WidgetFetchResult> {
  let endpoint: string;
  if (provider === "github" && /^[a-z0-9-]{1,39}\/[a-z0-9._-]{1,100}$/.test(resource)
    && ![".", ".."].includes(resource.split("/")[1])) endpoint = "https://api.github.com/repos/" + resource;
  else if (provider === "discord" && /^i:[A-Za-z0-9_-]{2,64}$/.test(resource))
    endpoint = "https://discord.com/api/v10/invites/" + resource.slice(2) + "?with_counts=true";
  else if (provider === "discord" && /^g:[1-9][0-9]{16,19}$/.test(resource))
    endpoint = "https://discord.com/api/v10/guilds/" + resource.slice(2) + "/widget.json";
  else throw new Error("Unsupported widget resource.");

  const response = await fetcher(endpoint, {
    redirect: "error", credentials: "omit", cache: "no-store", signal: AbortSignal.timeout(5000),
    headers: provider === "github"
      ? { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2026-03-10", "User-Agent": "Snoozer/1.0 (+https://www.snoozer.uk)" }
      : { Accept: "application/json", "User-Agent": "Snoozer/1.0 (+https://www.snoozer.uk)" },
  });
  if (response.status === 429 || (response.status === 403 && (
    response.headers.get("x-ratelimit-remaining") === "0" || response.headers.has("retry-after")
  ))) {
    let bodyRetry = 0;
    if (provider === "discord" && response.status === 429) {
      try {
        const body = await boundedBody(response, 8192);
        if (body) {
          const parsed = z.object({ retry_after: z.number().nonnegative().finite() }).safeParse(JSON.parse(new TextDecoder().decode(body)));
          if (parsed.success) bodyRetry = parsed.data.retry_after;
        }
      } catch { /* Retry headers and the conservative default still apply. */ }
    }
    throw new WidgetBackoff(retrySeconds(response, 60, bodyRetry));
  }
  if (!response.ok || !response.headers.get("content-type")?.includes("json")) throw new Error("Provider unavailable.");
  const bytes = await boundedBody(response, 100_000);
  if (!bytes) throw new Error("Provider response too large.");
  const raw: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  let title: string, description: string;
  const stats: WidgetMetadata["stats"] = [];
  if (provider === "github") {
    const repo = z.object({
      full_name: z.string().min(1).max(140), private: z.literal(false), description: z.string().nullable(),
      stargazers_count: z.number().int().nonnegative().safe(), forks_count: z.number().int().nonnegative().safe(),
    }).parse(raw);
    if (repo.full_name.toLowerCase() !== resource) throw new Error("Repository does not match.");
    title = repo.full_name; description = repo.description ?? "";
    stats.push({ label: "Stars", value: repo.stargazers_count }, { label: "Forks", value: repo.forks_count });
  } else if (resource.startsWith("i:")) {
    const invite = z.object({
      code: z.string(), guild: z.object({ name: z.string().min(1).max(140), description: z.string().nullable().optional() }),
      approximate_presence_count: z.number().int().nonnegative().safe().optional(),
      approximate_member_count: z.number().int().nonnegative().safe().optional(),
    }).parse(raw);
    if (invite.code !== resource.slice(2)) throw new Error("Invite does not match.");
    title = invite.guild.name; description = invite.guild.description ?? "";
    if (invite.approximate_presence_count !== undefined) stats.push({ label: "Online", value: invite.approximate_presence_count });
    if (invite.approximate_member_count !== undefined) stats.push({ label: "Members", value: invite.approximate_member_count });
  } else {
    const guild = z.object({
      id: z.string(), name: z.string().min(1).max(140), presence_count: z.number().int().nonnegative().safe(),
    }).parse(raw);
    if (guild.id !== resource.slice(2)) throw new Error("Guild does not match.");
    title = guild.name; description = "";
    stats.push({ label: "Online", value: guild.presence_count });
  }
  return {
    metadata: widgetMetadata.parse({ version: 1, provider, resource, title, description: description.slice(0, 500), stats, fetchedAt: new Date().toISOString() }),
    retryAfter: response.headers.get("x-ratelimit-remaining") === "0" ? retrySeconds(response, 1) : 0,
  };
}
